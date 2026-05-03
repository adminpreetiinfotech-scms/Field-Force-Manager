import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
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

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CheckOutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { gpsKm } = useLocalSearchParams<{ gpsKm: string }>();
  const { user, addAttendance, endTrip } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [odometerKm, setOdometerKm] = useState("");
  const [meterPhotoUri, setMeterPhotoUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const isCenterStaff = user?.staffCategory === "center";
  const [phase, setPhase] = useState<"selfie" | "input" | "camera">(
    () => (isCenterStaff ? "selfie" : "input")
  );
  const [submitting, setSubmitting] = useState(false);
  const [currentLoc, setCurrentLoc] = useState<GeoPoint | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") return;
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLoc({ latitude: cur.coords.latitude, longitude: cur.coords.longitude });
      } catch { /* ignore */ }
    })();
  }, []);

  const gpsKmNum = parseFloat(gpsKm || "0") || 0;

  const captureSelfie = async () => {
    if (!cameraRef.current) return;
    try {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      const result = await cameraRef.current.takePictureAsync({ quality: 0.55, skipProcessing: true });
      if (result?.uri) {
        setSelfieUri(result.uri);
        setPhase("input");
      }
    } catch {
      Alert.alert("Camera error", "Could not capture selfie.");
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      const result = await cameraRef.current.takePictureAsync({ quality: 0.55, skipProcessing: true });
      if (result?.uri) {
        setMeterPhotoUri(result.uri);
        setPhase("input");
      }
    } catch {
      Alert.alert("Camera error", "Could not capture photo.");
    }
  };

  const submit = async () => {
    if (!user) return;
    if (isCenterStaff && !selfieUri) {
      Alert.alert("Selfie required", "Please capture a selfie to complete your check-out.");
      setPhase("selfie");
      return;
    }
    setSubmitting(true);
    try {
      let loc: GeoPoint | null = currentLoc;
      try {
        if (Platform.OS !== "web") {
          const cur = await Location.getCurrentPositionAsync({});
          loc = { latitude: cur.coords.latitude, longitude: cur.coords.longitude };
        }
      } catch { /* ignore */ }

      const kmVal = odometerKm.trim() ? parseFloat(odometerKm.trim()) : null;
      await addAttendance({
        staffId: user.id,
        staffName: user.name,
        type: "out",
        timestamp: Date.now(),
        location: loc,
        selfieUri: isCenterStaff ? selfieUri : null,
        endOdometerKm: !isCenterStaff && Number.isFinite(kmVal as number) ? (kmVal as number) : null,
        vehicleMeterPhotoUri: !isCenterStaff ? meterPhotoUri : null,
      });
      await endTrip(gpsKmNum, loc);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const webPad = Platform.OS === "web" ? 67 : 0;

  const centerGeofenceWarning: { outside: boolean; distanceM: number } | null = (() => {
    if (!isCenterStaff) return null;
    if (!currentLoc || user?.companyCenterLat == null || user?.companyCenterLng == null || user?.companyCenterRadiusMeters == null) return null;
    const d = haversineM(currentLoc.latitude, currentLoc.longitude, user.companyCenterLat, user.companyCenterLng);
    return { outside: d > user.companyCenterRadiusMeters, distanceM: Math.round(d) };
  })();

  if (phase === "selfie") {
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
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Check-Out Selfie</Text>
          <View style={styles.iconBtn} />
        </View>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 }}>
            <Feather name="camera-off" size={40} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", fontFamily: "Inter_400Regular" }}>
              Camera permission is required to capture your check-out selfie.
            </Text>
            <Pressable
              onPress={requestPermission}
              style={({ pressed }) => ({
                backgroundColor: "#fff",
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 10,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: "#000", fontFamily: "Inter_600SemiBold" }}>Grant Permission</Text>
            </Pressable>
          </View>
        )}
        <View style={[styles.bottomBarDark, { paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0) }]}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" }}>
            Look at the camera and take a selfie to confirm your check-out
          </Text>
          <View style={{ alignItems: "center" }}>
            <Pressable
              onPress={captureSelfie}
              style={({ pressed }) => [styles.shutter, { opacity: pressed ? 0.85 : 1 }]}
              hitSlop={10}
              disabled={!permission?.granted}
            >
              <View style={styles.shutterInner} />
            </Pressable>
            <Text style={styles.shutterHint}>Tap to capture</Text>
          </View>
        </View>
      </View>
    );
  }

  if (phase === "camera") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 + webPad }]}>
          <Pressable
            onPress={() => setPhase("input")}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={6}
          >
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Capture Odometer Photo</Text>
          <View style={styles.iconBtn} />
        </View>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        <View style={[styles.bottomBarDark, { paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0) }]}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" }}>
            Point camera at vehicle odometer display
          </Text>
          <View style={{ alignItems: "center" }}>
            <Pressable
              onPress={capturePhoto}
              style={({ pressed }) => [styles.shutter, { opacity: pressed ? 0.85 : 1 }]}
              hitSlop={10}
            >
              <View style={styles.shutterInner} />
            </Pressable>
            <Text style={styles.shutterHint}>Tap to capture</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8 + webPad,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} hitSlop={8}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>End Shift</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flex: 1, padding: 22, gap: 18 }}>
          {/* Vehicle info pill — field staff only */}
          {!isCenterStaff && (
            <View style={[styles.infoPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="truck" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  {user?.vehicleType === "2-wheeler" ? "2-Wheeler" : "4-Wheeler"}
                  {user?.vehicleNumber ? `  ·  ${user.vehicleNumber}` : ""}
                </Text>
                {gpsKmNum > 0 && (
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                    GPS tracked: {gpsKmNum.toFixed(1)} km today
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Selfie preview — center staff */}
          {isCenterStaff && selfieUri && (
            <View style={{ alignItems: "center", gap: 10 }}>
              <Image
                source={{ uri: selfieUri }}
                style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: colors.primary }}
              />
              <Pressable onPress={() => setPhase("selfie")} hitSlop={6}>
                <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_500Medium" }}>Retake selfie</Text>
              </Pressable>
            </View>
          )}

          {/* Center staff info pill */}
          {isCenterStaff && (
            <View style={[styles.infoPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="home" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                  Center Staff Check-Out
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 }}>
                  Your GPS location will be recorded for geo-fence verification
                </Text>
              </View>
            </View>
          )}

          {/* Odometer input — field staff only */}
          {!isCenterStaff && (
            <View>
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 8 }}>
                End Odometer Reading (km)
              </Text>
              <TextInput
                value={odometerKm}
                onChangeText={setOdometerKm}
                placeholder="e.g. 23520"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                style={[
                  styles.odoInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>
          )}

          {/* Meter photo — field staff only */}
          {!isCenterStaff && (
            <Pressable
              onPress={() => {
                if (!permission?.granted) {
                  requestPermission();
                  return;
                }
                setPhase("camera");
              }}
              style={({ pressed }) => [
                styles.photoBtn,
                {
                  borderColor: meterPhotoUri ? colors.success : colors.border,
                  backgroundColor: meterPhotoUri ? colors.success + "12" : colors.card,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name={meterPhotoUri ? "check-circle" : "camera"}
                size={18}
                color={meterPhotoUri ? colors.success : colors.mutedForeground}
              />
              <Text
                style={{
                  color: meterPhotoUri ? colors.success : colors.mutedForeground,
                  fontSize: 14,
                  fontFamily: "Inter_500Medium",
                  flex: 1,
                }}
              >
                {meterPhotoUri ? "Odometer photo captured" : "Capture odometer photo (optional)"}
              </Text>
              {meterPhotoUri && (
                <Pressable onPress={() => setMeterPhotoUri(null)} hitSlop={8}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </Pressable>
          )}

          <View style={{ flex: 1 }} />

          {/* Geo-fence warning for center staff */}
          {isCenterStaff && centerGeofenceWarning && centerGeofenceWarning.outside && (
            <View style={[styles.geofenceWarning, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED" }]}>
              <Feather name="alert-triangle" size={14} color="#A78BFA" />
              <Text style={{ color: "#A78BFA", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
                You are {centerGeofenceWarning.distanceM} m from center. Check-out will be flagged outside geo-fence.
              </Text>
            </View>
          )}
          {isCenterStaff && centerGeofenceWarning && !centerGeofenceWarning.outside && (
            <View style={[styles.geofenceWarning, { backgroundColor: "#34D39918", borderColor: "#34D399" }]}>
              <Feather name="check-circle" size={14} color="#34D399" />
              <Text style={{ color: "#34D399", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
                Inside geo-fence ({centerGeofenceWarning.distanceM} m from center)
              </Text>
            </View>
          )}

          <Button
            label="End shift"
            onPress={submit}
            loading={submitting}
            size="lg"
            fullWidth
            icon={<Feather name="log-out" size={18} color="#fff" />}
            style={{ backgroundColor: "#DC2626" }}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  bottomBarDark: {
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 16,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 60, height: 60, borderRadius: 999, backgroundColor: "#fff" },
  shutterHint: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  odoInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  geofenceWarning: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
});
