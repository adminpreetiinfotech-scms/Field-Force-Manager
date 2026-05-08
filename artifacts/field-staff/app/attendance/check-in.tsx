import { Feather } from "@expo/vector-icons";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { GeoPoint, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}
const API_BASE = getApiBase();

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Phase = "selfie" | "vehicle" | "odometer" | "meter-capture";
type FaceVerifyStatus = "idle" | "verifying" | "match" | "mismatch" | "no_reference" | "error";

export default function CheckInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, addAttendance } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("selfie");
  const [photo, setPhoto] = useState<string | null>(null);
  const [meterPhotoUri, setMeterPhotoUri] = useState<string | null>(null);
  const [odometerKm, setOdometerKm] = useState("");
  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const [locStatus, setLocStatus] = useState<"loading" | "ok" | "denied">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [facing, setFacing] = useState<CameraType>("front");
  const cameraRef = useRef<CameraView>(null);
  const [faceStatus, setFaceStatus] = useState<FaceVerifyStatus>("idle");
  const [faceScore, setFaceScore] = useState<number | null>(null);
  const [facePhotoUrl, setFacePhotoUrl] = useState<string | null>(null);
  // Per-check-in vehicle type (can be changed even if profile has a default)
  const [selectedVehicleType, setSelectedVehicleType] = useState<"2-wheeler" | "4-wheeler" | null>(
    user?.vehicleType ?? null,
  );

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          setLoc({ latitude: 28.6139, longitude: 77.209 });
          setLocStatus("ok");
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setLocStatus("denied"); return; }
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLoc({ latitude: cur.coords.latitude, longitude: cur.coords.longitude });
        setLocStatus("ok");
      } catch { setLocStatus("denied"); }
    })();
  }, []);

  const verifyFace = async (uri: string) => {
    if (!user?.phone || Platform.OS === "web") {
      setFaceStatus("no_reference");
      return;
    }
    setFaceStatus("verifying");
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await fetch(`${API_BASE}/api/activity/verify-face`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-phone": user.phone,
        },
        body: JSON.stringify({ base64, mimeType: "image/jpeg" }),
      });
      if (!res.ok) { setFaceStatus("error"); return; }
      const data = (await res.json()) as {
        score: number | null;
        status: string;
        matched: boolean | null;
        checkinPhotoUrl?: string | null;
      };
      setFaceScore(data.score);
      setFacePhotoUrl(data.checkinPhotoUrl ?? null);
      if (data.status === "no_reference") setFaceStatus("no_reference");
      else if (data.status === "match") setFaceStatus("match");
      else if (data.status === "mismatch") setFaceStatus("mismatch");
      else setFaceStatus("error");
    } catch {
      setFaceStatus("error");
    }
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      const result = await cameraRef.current.takePictureAsync({ quality: 0.55, skipProcessing: true });
      if (result?.uri) {
        if (phase === "meter-capture") {
          setMeterPhotoUri(result.uri);
          setPhase("odometer");
        } else {
          setPhoto(result.uri);
          // Trigger face verification after selfie capture
          verifyFace(result.uri);
        }
      }
    } catch {
      Alert.alert("Camera error", "Could not capture photo. Please try again.");
    }
  };

  const centerGeofenceWarning: { outside: boolean; distanceM: number } | null = (() => {
    if (user?.staffCategory !== "center") return null;
    if (!loc || user.companyCenterLat == null || user.companyCenterLng == null || user.companyCenterRadiusMeters == null) return null;
    const d = haversineM(loc.latitude, loc.longitude, user.companyCenterLat, user.companyCenterLng);
    return { outside: d > user.companyCenterRadiusMeters, distanceM: Math.round(d) };
  })();

  const confirmSelfie = () => {
    if (!photo) return;
    // If face mismatch, warn but allow proceed (admin reviews via audit log)
    if (faceStatus === "mismatch") {
      Alert.alert(
        "Face Mismatch Warning",
        `Your selfie doesn't match the reference photo (score: ${faceScore ?? "—"}/100). You can still check in, but this will be flagged for admin review.`,
        [
          { text: "Retake Selfie", style: "cancel", onPress: () => { setPhoto(null); setFaceStatus("idle"); } },
          { text: "Proceed Anyway", style: "destructive", onPress: () => _doConfirmSelfie() },
        ],
      );
      return;
    }
    _doConfirmSelfie();
  };

  const _doConfirmSelfie = () => {
    if (!photo) return;
    // Center staff do not have vehicle / odometer — skip directly to submit
    if (user?.staffCategory === "center") {
      submitFinal();
      return;
    }
    // Always show vehicle selector so staff can confirm / change vehicle type
    setPhase("vehicle");
  };

  const confirmVehicle = () => {
    if (!selectedVehicleType) return;
    setPhase("odometer");
  };

  const submitFinal = async () => {
    if (!photo || !user) return;
    if (selectedVehicleType && !meterPhotoUri) {
      Alert.alert("Odometer photo required", "Please capture the odometer photo before submitting check-in.");
      return;
    }
    setSubmitting(true);
    try {
      const kmVal = odometerKm.trim() ? parseFloat(odometerKm.trim()) : null;
      await addAttendance({
        staffId: user.id,
        staffName: user.name,
        type: "in",
        timestamp: Date.now(),
        location: loc,
        selfieUri: photo,
        checkinVehicleType: selectedVehicleType,
        ...(selectedVehicleType
          ? {
              startOdometerKm: Number.isFinite(kmVal as number) ? (kmVal as number) : null,
              vehicleMeterPhotoUri: meterPhotoUri,
            }
          : {}),
      });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const webPad = Platform.OS === "web" ? 67 : 0;

  if (!permission) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: colors.background, paddingHorizontal: 22, paddingTop: insets.top + 24 }]}>
        <View style={[styles.permIcon, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "22", borderRadius: 999 }]}>
          <Feather name="camera" size={26} color={colors.primary} />
        </View>
        <Text style={[styles.permTitle, { color: colors.foreground }]}>Camera permission required</Text>
        <Text style={[styles.permText, { color: colors.mutedForeground }]}>
          A live selfie is mandatory for every check-in. This proves you're at the field site.
        </Text>
        <Button label="Allow camera access" onPress={requestPermission} size="lg" fullWidth style={{ marginTop: 18 }} />
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }} hitSlop={8}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium" }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "meter-capture") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 + webPad }]}>
          <Pressable
            onPress={() => { setFacing("front"); setPhase("odometer"); }}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={6}
          >
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Capture Odometer Photo</Text>
          <View style={styles.iconBtn} />
        </View>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0) }]}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" }}>
            Point camera at vehicle odometer display
          </Text>
          <View style={{ alignItems: "center" }}>
            <Pressable onPress={capture} style={({ pressed }) => [styles.shutter, { opacity: pressed ? 0.85 : 1 }]} hitSlop={10}>
              <View style={styles.shutterInner} />
            </Pressable>
            <Text style={styles.shutterHint}>Tap to capture</Text>
          </View>
        </View>
      </View>
    );
  }

  if (phase === "vehicle") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {photo && <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={8} />}
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.78)" }} />
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 32 + (Platform.OS === "web" ? 34 : 0) }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" }}>2</Text>
                </View>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Select Vehicle Type</Text>
              </View>
              <Pressable onPress={() => setPhase("selfie")} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter_500Medium" }}>Back</Text>
              </Pressable>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
              Choose the vehicle you are using today
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {(["2-wheeler", "4-wheeler"] as const).map((v) => {
                const selected = selectedVehicleType === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setSelectedVehicleType(v)}
                    style={({ pressed }) => ({
                      flex: 1, padding: 18, borderRadius: 16,
                      borderWidth: 2,
                      borderColor: selected ? "#3B82F6" : "rgba(255,255,255,0.2)",
                      backgroundColor: selected ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.06)",
                      alignItems: "center", gap: 8,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 32 }}>{v === "2-wheeler" ? "🏍️" : "🚗"}</Text>
                    <Text style={{ color: selected ? "#60A5FA" : "rgba(255,255,255,0.7)", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                      {v === "2-wheeler" ? "2-Wheeler" : "4-Wheeler"}
                    </Text>
                    {selected && (
                      <View style={{ position: "absolute", top: 10, right: 10 }}>
                        <Feather name="check-circle" size={16} color="#3B82F6" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Button
              label="Next: Odometer Reading"
              onPress={confirmVehicle}
              size="lg"
              fullWidth
              icon={<Feather name="arrow-right" size={18} color="#fff" />}
            />
          </View>
        </View>
      </View>
    );
  }

  if (phase === "odometer") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {photo && <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={8} />}
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.72)" }} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0) }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" }}>3</Text>
                  </View>
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Vehicle Odometer</Text>
                </View>
                <Pressable onPress={() => setPhase("vehicle")} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter_500Medium" }}>Back</Text>
                </Pressable>
              </View>

              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                {selectedVehicleType === "2-wheeler" ? "🏍️ 2-Wheeler" : "🚗 4-Wheeler"}
                {user?.vehicleNumber ? `  ·  ${user.vehicleNumber}` : ""}
              </Text>

              <View>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 6, letterSpacing: 0.4 }}>
                  START ODOMETER READING (KM)
                </Text>
                <TextInput
                  value={odometerKm}
                  onChangeText={setOdometerKm}
                  placeholder="e.g. 23450"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  style={styles.odoInput}
                />
              </View>

              <Pressable
                onPress={() => { setFacing("back"); setPhase("meter-capture"); }}
                style={({ pressed }) => [
                  styles.photoRow,
                  {
                    borderColor: meterPhotoUri ? "#34D399" : "rgba(255,255,255,0.2)",
                    backgroundColor: meterPhotoUri ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.05)",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather name={meterPhotoUri ? "check-circle" : "camera"} size={16} color={meterPhotoUri ? "#34D399" : "rgba(255,255,255,0.6)"} />
                <Text style={{ color: meterPhotoUri ? "#34D399" : "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>
                  {meterPhotoUri ? "Odometer photo captured" : "Capture odometer photo *"}
                </Text>
                {meterPhotoUri && (
                  <Pressable onPress={() => setMeterPhotoUri(null)} hitSlop={8}>
                    <Feather name="x" size={14} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                )}
              </Pressable>

              <Button
                label="Submit check-in"
                onPress={submitFinal}
                loading={submitting}
                size="lg"
                fullWidth
                icon={<Feather name="check" size={18} color="#fff" />}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 + webPad }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={6}
        >
          <Feather name="x" size={20} color="#fff" />
        </Pressable>
        <View style={styles.locPill}>
          <Feather
            name="map-pin"
            size={11}
            color={locStatus === "ok" ? "#34D399" : locStatus === "loading" ? "#FCD34D" : "#FCA5A5"}
          />
          <Text style={styles.locText}>
            {locStatus === "loading"
              ? "Locating…"
              : locStatus === "ok" && loc
                ? `${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)}`
                : "GPS unavailable"}
          </Text>
        </View>
        {!photo ? (
          <Pressable
            onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={6}
          >
            <Feather name="refresh-cw" size={18} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <View style={styles.cameraWrap}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
        )}
        <View style={styles.frameOverlay} pointerEvents="none">
          <View style={styles.frameOval} />
          <Text style={styles.framePrompt}>{photo ? "Looks good?" : "Center your face in the oval"}</Text>
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0) }]}>
        <View style={styles.checklist}>
          <Check ok={!!photo} label="Live selfie captured" />
          <Check ok={locStatus === "ok"} label="GPS location locked" />
          <Check ok={true} label="Timestamp signed" />
          {user?.staffCategory !== "center" && <Check ok={false} label="Vehicle + Odometer (Steps 2–3)" />}
        </View>

        {centerGeofenceWarning && centerGeofenceWarning.outside && (
          <View style={[styles.geofenceWarning, { backgroundColor: "rgba(220,38,38,0.12)", borderColor: "#DC2626" }]}>
            <Feather name="x-circle" size={14} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#DC2626", fontSize: 12, fontFamily: "Inter_700Bold" }}>
                Outside geo-fence — Check-in blocked
              </Text>
              <Text style={{ color: "#FCA5A5", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                You are {centerGeofenceWarning.distanceM} m from center. Move closer to check in.
              </Text>
            </View>
          </View>
        )}
        {centerGeofenceWarning && !centerGeofenceWarning.outside && (
          <View style={[styles.geofenceWarning, { backgroundColor: "#34D39918", borderColor: "#34D399" }]}>
            <Feather name="check-circle" size={14} color="#34D399" />
            <Text style={{ color: "#34D399", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
              Inside geo-fence ({centerGeofenceWarning.distanceM} m from center)
            </Text>
          </View>
        )}
        {/* Face match result badge */}
        {photo && faceStatus !== "idle" && (
          <View style={[
            styles.faceBadge,
            faceStatus === "verifying" ? { backgroundColor: "rgba(99,102,241,0.18)", borderColor: "rgba(99,102,241,0.5)" }
            : faceStatus === "match" ? { backgroundColor: "rgba(52,211,153,0.15)", borderColor: "#34D399" }
            : faceStatus === "mismatch" ? { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "#EF4444" }
            : { backgroundColor: "rgba(107,114,128,0.15)", borderColor: "rgba(107,114,128,0.4)" },
          ]}>
            {faceStatus === "verifying" ? (
              <>
                <ActivityIndicator size="small" color="#818CF8" />
                <Text style={[styles.faceText, { color: "#818CF8" }]}>Verifying face…</Text>
              </>
            ) : faceStatus === "match" ? (
              <>
                <Feather name="check-circle" size={14} color="#34D399" />
                <Text style={[styles.faceText, { color: "#34D399" }]}>
                  Face matched{faceScore != null ? ` (${faceScore}/100)` : ""}
                </Text>
              </>
            ) : faceStatus === "mismatch" ? (
              <>
                <Feather name="alert-triangle" size={14} color="#EF4444" />
                <Text style={[styles.faceText, { color: "#EF4444" }]}>
                  Face mismatch{faceScore != null ? ` (${faceScore}/100)` : ""} — will be flagged
                </Text>
              </>
            ) : faceStatus === "no_reference" ? (
              <>
                <Feather name="user" size={14} color="rgba(255,255,255,0.4)" />
                <Text style={[styles.faceText, { color: "rgba(255,255,255,0.4)" }]}>No reference photo set</Text>
              </>
            ) : (
              <>
                <Feather name="wifi-off" size={14} color="rgba(255,255,255,0.4)" />
                <Text style={[styles.faceText, { color: "rgba(255,255,255,0.4)" }]}>Face check skipped</Text>
              </>
            )}
          </View>
        )}

        {photo ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => { setPhoto(null); setFaceStatus("idle"); setFaceScore(null); }}
              style={({ pressed }) => [styles.retake, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
            <Button
              label={user?.staffCategory !== "center" ? "Next: Vehicle" : "Confirm check-in"}
              onPress={confirmSelfie}
              disabled={!!(centerGeofenceWarning?.outside) || faceStatus === "verifying"}
              loading={submitting}
              size="lg"
              style={{ flex: 1, opacity: (centerGeofenceWarning?.outside || faceStatus === "verifying") ? 0.4 : 1 }}
              icon={<Feather name={user?.staffCategory !== "center" ? "arrow-right" : "check"} size={18} color="#fff" />}
            />
          </View>
        ) : (
          <View style={{ alignItems: "center" }}>
            <Pressable
              onPress={capture}
              style={({ pressed }) => [styles.shutter, { opacity: pressed ? 0.85 : 1 }]}
              hitSlop={10}
            >
              <View style={styles.shutterInner} />
            </Pressable>
            <Text style={styles.shutterHint}>Tap to capture selfie</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkDot, { backgroundColor: ok ? "#34D399" : "rgba(255,255,255,0.2)" }]}>
        {ok ? <Feather name="check" size={10} color="#0B2545" /> : null}
      </View>
      <Text style={[styles.checkText, { color: ok ? "#fff" : "rgba(255,255,255,0.5)" }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fullCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  permIcon: { width: 64, height: 64, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, marginBottom: 18 },
  permTitle: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.4, marginBottom: 8, textAlign: "center" },
  permText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, textAlign: "center" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  locPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999 },
  locText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cameraWrap: { flex: 1, backgroundColor: "#111" },
  frameOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frameOval: { width: 240, height: 320, borderRadius: 200, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)", borderStyle: "dashed" },
  framePrompt: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 16, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  bottomBar: { backgroundColor: "rgba(0,0,0,0.85)", paddingHorizontal: 18, paddingTop: 18, gap: 16 },
  checklist: { gap: 8 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkDot: { width: 18, height: 18, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  checkText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  shutter: { width: 76, height: 76, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 60, height: 60, borderRadius: 999, backgroundColor: "#fff" },
  shutterHint: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 10 },
  actions: { flexDirection: "row", gap: 10 },
  retake: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  retakeText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  odoInput: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    letterSpacing: 1,
  },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  geofenceWarning: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  faceBadge: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  faceText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
});
