/**
 * QR Card Attendance Scanner
 *
 * Admin / trainer / MIS staff scan a ground staff member's printed QR card.
 * Steps:
 *   1. Scanner takes a selfie (anti-fraud proof)
 *   2. Point camera at QR card → auto-decoded
 *   3. GPS is captured in background
 *   4. POST /api/qr-attendance/checkin or /checkout
 *
 * Accessible from the admin dashboard via the "QR Scan" button.
 */

import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";

import { Button } from "@/components/Button";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

type Phase = "selfie" | "scan" | "confirming" | "done";
type ScanMode = "checkin" | "checkout";

type ScanResult = {
  staffName: string;
  type: "checkin" | "checkout";
  occurredAt: string;
  scannedBy: string;
};

export default function QrScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<ScanMode>(
    params.mode === "checkout" ? "checkout" : "checkin",
  );
  const [phase, setPhase] = useState<Phase>("selfie");
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [loc, setLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scannedPayload, setScannedPayload] = useState<string | null>(null);
  const [scanLocked, setScanLocked] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const API_BASE = getApiBase();

  // Grab GPS in background as soon as screen opens
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          setLoc({ latitude: 28.6139, longitude: 77.209 });
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const cur = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLoc({ latitude: cur.coords.latitude, longitude: cur.coords.longitude });
      } catch {
        // GPS unavailable — server will accept without geo-fence check
      }
    })();
  }, []);

  // ── Selfie capture ────────────────────────────────────────────────────────

  const captureSelfie = async () => {
    if (!cameraRef.current) return;
    try {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.55,
        skipProcessing: true,
      });
      if (result?.uri) {
        setSelfieUri(result.uri);
        setPhase("scan");
      }
    } catch {
      Alert.alert("Camera error", "Could not capture selfie. Please try again.");
    }
  };

  // ── QR decode callback ────────────────────────────────────────────────────

  const onQrScanned = useCallback(
    async (data: string) => {
      if (scanLocked || submitting) return;
      // Validate format: "<uuid>:<32hex>"
      if (!/^[0-9a-fA-F-]{36}:[0-9a-fA-F]{32}$/.test(data)) return;

      setScanLocked(true);
      setScannedPayload(data);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      await submitScan(data);
    },
    [scanLocked, submitting, mode, selfieUri, loc, user],
  );

  // ── Submit scan to API ────────────────────────────────────────────────────

  const submitScan = async (payload: string) => {
    if (!user?.phone) {
      Alert.alert("Not logged in", "Please log in first.");
      setScanLocked(false);
      return;
    }

    setSubmitting(true);
    setPhase("confirming");
    try {
      const endpoint = mode === "checkin" ? "checkin" : "checkout";

      // Upload selfie to get URL (reuse the verify-face storage endpoint trick)
      // We just send base64 selfie inline in the body for now
      let selfieBase64: string | null = null;
      if (selfieUri && Platform.OS !== "web") {
        try {
          selfieBase64 = await FileSystem.readAsStringAsync(selfieUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {
          // selfie upload is best-effort
        }
      }

      const res = await fetch(`${API_BASE}/api/qr-attendance/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-phone": user.phone,
        },
        body: JSON.stringify({
          qrPayload: payload,
          lat: loc?.latitude ?? null,
          lng: loc?.longitude ?? null,
          scannerSelfieBase64: selfieBase64,
        }),
      });

      const json = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        const title = (json.title as string | undefined) ?? "Error";
        const detail = (json.detail as string | undefined) ?? `HTTP ${res.status}`;
        Alert.alert(title, detail, [
          {
            text: "Scan another",
            onPress: () => {
              setScanLocked(false);
              setScannedPayload(null);
              setPhase("scan");
            },
          },
        ]);
        return;
      }

      setResult({
        staffName: String(json.staffName ?? ""),
        type: String(json.type ?? mode) as "checkin" | "checkout",
        occurredAt: String(json.occurredAt ?? ""),
        scannedBy: String(json.scannedBy ?? user.name),
      });
      setPhase("done");
    } catch {
      Alert.alert("Network error", "Could not reach server. Check your internet and try again.", [
        {
          text: "Retry",
          onPress: () => {
            setScanLocked(false);
            setScannedPayload(null);
            setPhase("scan");
          },
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const webPad = Platform.OS === "web" ? 67 : 0;

  // ── Permission gates ──────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fullCenter, { backgroundColor: colors.background, paddingHorizontal: 22, paddingTop: insets.top + 24 }]}>
        <View style={[styles.permIcon, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "22" }]}>
          <Feather name="camera" size={26} color={colors.primary} />
        </View>
        <Text style={[styles.permTitle, { color: colors.foreground }]}>Camera permission required</Text>
        <Text style={[styles.permText, { color: colors.mutedForeground }]}>
          Camera is needed to capture your selfie (anti-fraud) and scan the QR card.
        </Text>
        <Button label="Allow camera access" onPress={requestPermission} size="lg" fullWidth style={{ marginTop: 18 }} />
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }} hitSlop={8}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium" }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────

  if (phase === "done" && result) {
    const isCheckin = result.type === "checkin";
    return (
      <View style={[styles.fullCenter, { backgroundColor: "#000", paddingTop: insets.top + webPad }]}>
        {selfieUri && (
          <Image source={{ uri: selfieUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={12} />
        )}
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.82)" }} />

        <View style={styles.doneCard}>
          <View style={[styles.doneIcon, { backgroundColor: isCheckin ? "#16A34A22" : "#DC262622", borderColor: isCheckin ? "#16A34A" : "#DC2626" }]}>
            <Feather name={isCheckin ? "log-in" : "log-out"} size={32} color={isCheckin ? "#16A34A" : "#DC2626"} />
          </View>
          <Text style={styles.doneTitle}>{isCheckin ? "Checked In!" : "Checked Out!"}</Text>
          <Text style={styles.doneStaff}>{result.staffName}</Text>
          <Text style={styles.doneTime}>
            {new Date(result.occurredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </Text>
          <Text style={styles.doneBy}>Scanned by: {result.scannedBy}</Text>

          <View style={{ gap: 10, width: "100%", marginTop: 8 }}>
            <Button
              label={isCheckin ? "Scan another check-in" : "Scan another check-out"}
              onPress={() => {
                setSelfieUri(null);
                setScannedPayload(null);
                setResult(null);
                setScanLocked(false);
                setPhase("selfie");
              }}
              size="lg"
              fullWidth
            />
            <Button
              label={`Switch to ${isCheckin ? "check-out" : "check-in"}`}
              onPress={() => {
                setMode(isCheckin ? "checkout" : "checkin");
                setSelfieUri(null);
                setScannedPayload(null);
                setResult(null);
                setScanLocked(false);
                setPhase("selfie");
              }}
              size="lg"
              fullWidth
              variant="secondary"
            />
            <Pressable onPress={() => router.back()} style={{ alignSelf: "center", marginTop: 4 }} hitSlop={8}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontFamily: "Inter_500Medium" }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Confirming / loading screen ───────────────────────────────────────────

  if (phase === "confirming") {
    return (
      <View style={[styles.fullCenter, { backgroundColor: "#000" }]}>
        {selfieUri && (
          <Image source={{ uri: selfieUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={12} />
        )}
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.82)" }} />
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 16 }}>
          Marking {mode === "checkin" ? "check-in" : "check-out"}…
        </Text>
      </View>
    );
  }

  // ── Selfie phase ──────────────────────────────────────────────────────────

  if (phase === "selfie") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 + webPad }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={6}
          >
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
            QR Attendance — Step 1 of 2
          </Text>
          <View style={styles.iconBtn} />
        </View>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          {(["checkin", "checkout"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[
                styles.modeBtn,
                mode === m && { backgroundColor: mode === "checkin" ? "#16A34A" : "#DC2626" },
              ]}
            >
              <Feather name={m === "checkin" ? "log-in" : "log-out"} size={13} color="#fff" />
              <Text style={styles.modeBtnText}>{m === "checkin" ? "Check-In" : "Check-Out"}</Text>
            </Pressable>
          ))}
        </View>

        {/* Camera */}
        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
          <View style={styles.frameOverlay} pointerEvents="none">
            <View style={styles.frameOval} />
            <Text style={styles.framePrompt}>Take a quick selfie first</Text>
          </View>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0) }]}>
          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" }}>
            Your selfie is recorded as proof that you performed the scan.
          </Text>
          <View style={{ alignItems: "center" }}>
            <Pressable
              onPress={captureSelfie}
              style={({ pressed }) => [styles.shutter, { opacity: pressed ? 0.85 : 1 }]}
              hitSlop={10}
            >
              <View style={styles.shutterInner} />
            </Pressable>
            <Text style={styles.shutterHint}>Tap to capture selfie</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── QR scan phase ─────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 + webPad }]}>
        <Pressable
          onPress={() => { setSelfieUri(null); setPhase("selfie"); }}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={6}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
          Scan QR Card — Step 2 of 2
        </Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Selfie thumbnail */}
      {selfieUri && (
        <View style={styles.selfiePill}>
          <Image source={{ uri: selfieUri }} style={styles.selfieThumb} contentFit="cover" />
          <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" }}>Selfie ✓</Text>
        </View>
      )}

      {/* QR Scanner */}
      <View style={{ flex: 1 }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanLocked ? undefined : (e) => { void onQrScanned(e.data); }}
        />

        {/* Scan frame overlay */}
        <View style={styles.scanOverlay} pointerEvents="none">
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.scanHint}>
            Point camera at ground staff's QR card
          </Text>
        </View>
      </View>

      {/* Bottom info bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 + (Platform.OS === "web" ? 34 : 0) }]}>
        <View style={[styles.modePill, { backgroundColor: mode === "checkin" ? "#16A34A22" : "#DC262222", borderColor: mode === "checkin" ? "#16A34A" : "#DC2626" }]}>
          <Feather name={mode === "checkin" ? "log-in" : "log-out"} size={13} color={mode === "checkin" ? "#16A34A" : "#DC2626"} />
          <Text style={[styles.modePillText, { color: mode === "checkin" ? "#16A34A" : "#DC2626" }]}>
            {mode === "checkin" ? "Marking Check-In" : "Marking Check-Out"}
          </Text>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" }}>
          GPS: {loc ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : "Locating…"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  modeToggle: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  modeBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  cameraWrap: { flex: 1, position: "relative" },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  frameOval: {
    width: 180,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "transparent",
  },
  framePrompt: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 14,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
  shutterHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  scanFrame: {
    width: 220,
    height: 220,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#fff",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
  },
  selfiePill: {
    position: "absolute",
    top: 0,
    right: 16,
    zIndex: 20,
    alignItems: "center",
    gap: 4,
    marginTop: 60,
  },
  selfieThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#34D399",
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "center",
  },
  modePillText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  // Done screen
  doneCard: {
    alignItems: "center",
    gap: 10,
    padding: 24,
    width: "100%",
    maxWidth: 360,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  doneTitle: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  doneStaff: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  doneTime: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  doneBy: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  permIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  permTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  permText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
