import { Feather } from "@expo/vector-icons";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

import { Button } from "@/components/Button";
import { GeoPoint, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function CheckInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, addAttendance } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const [locStatus, setLocStatus] = useState<"loading" | "ok" | "denied">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [facing, setFacing] = useState<CameraType>("front");
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          // Web: simulate a Delhi-region location
          setLoc({ latitude: 28.6139, longitude: 77.209 });
          setLocStatus("ok");
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocStatus("denied");
          return;
        }
        const cur = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLoc({
          latitude: cur.coords.latitude,
          longitude: cur.coords.longitude,
        });
        setLocStatus("ok");
      } catch {
        setLocStatus("denied");
      }
    })();
  }, []);

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync().catch(() => {});
      }
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.55,
        skipProcessing: true,
      });
      if (result?.uri) setPhoto(result.uri);
    } catch (e) {
      Alert.alert("Camera error", "Could not capture photo. Please try again.");
    }
  };

  const submit = async () => {
    if (!photo) return;
    if (!user) return;
    setSubmitting(true);
    try {
      await addAttendance({
        staffId: user.id,
        staffName: user.name,
        type: "in",
        timestamp: Date.now(),
        location: loc,
        selfieUri: photo,
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      }
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  if (!permission) {
    return (
      <View
        style={[
          styles.fullCenter,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.fullCenter,
          {
            backgroundColor: colors.background,
            paddingHorizontal: 22,
            paddingTop: insets.top + 24,
          },
        ]}
      >
        <View
          style={[
            styles.permIcon,
            {
              backgroundColor: colors.primary + "12",
              borderColor: colors.primary + "22",
              borderRadius: 999,
            },
          ]}
        >
          <Feather name="camera" size={26} color={colors.primary} />
        </View>
        <Text style={[styles.permTitle, { color: colors.foreground }]}>
          Camera permission required
        </Text>
        <Text style={[styles.permText, { color: colors.mutedForeground }]}>
          A live selfie is mandatory for every check-in. This proves you're at
          the field site, not someone else clocking in for you.
        </Text>
        <Button
          label="Allow camera access"
          onPress={requestPermission}
          size="lg"
          fullWidth
          style={{ marginTop: 18 }}
        />
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }} hitSlop={8}>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 13,
              fontFamily: "Inter_500Medium",
            }}
          >
            Cancel
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8 + (Platform.OS === "web" ? 67 : 0),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.iconBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          hitSlop={6}
        >
          <Feather name="x" size={20} color="#fff" />
        </Pressable>
        <View style={styles.locPill}>
          <Feather
            name="map-pin"
            size={11}
            color={
              locStatus === "ok"
                ? "#34D399"
                : locStatus === "loading"
                  ? "#FCD34D"
                  : "#FCA5A5"
            }
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
            style={({ pressed }) => [
              styles.iconBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
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
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
          />
        )}
        <View style={styles.frameOverlay} pointerEvents="none">
          <View style={styles.frameOval} />
          <Text style={styles.framePrompt}>
            {photo ? "Looks good?" : "Center your face in the oval"}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0) },
        ]}
      >
        <View style={styles.checklist}>
          <Check ok={!!photo} label="Live selfie captured" />
          <Check ok={locStatus === "ok"} label="GPS location locked" />
          <Check ok={true} label="Timestamp signed" />
        </View>

        {photo ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => setPhoto(null)}
              style={({ pressed }) => [
                styles.retake,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="refresh-cw" size={16} color="#fff" />
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
            <Button
              label="Confirm check-in"
              onPress={submit}
              loading={submitting}
              size="lg"
              style={{ flex: 1 }}
              icon={<Feather name="check" size={18} color="#fff" />}
            />
          </View>
        ) : (
          <View style={{ alignItems: "center" }}>
            <Pressable
              onPress={capture}
              style={({ pressed }) => [
                styles.shutter,
                { opacity: pressed ? 0.85 : 1 },
              ]}
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
      <View
        style={[
          styles.checkDot,
          { backgroundColor: ok ? "#34D399" : "rgba(255,255,255,0.2)" },
        ]}
      >
        {ok ? <Feather name="check" size={10} color="#0B2545" /> : null}
      </View>
      <Text
        style={[
          styles.checkText,
          { color: ok ? "#fff" : "rgba(255,255,255,0.5)" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fullCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  permIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 18,
  },
  permTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  permText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    textAlign: "center",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
  locPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
  },
  locText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  cameraWrap: { flex: 1, backgroundColor: "#111" },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  frameOval: {
    width: 240,
    height: 320,
    borderRadius: 200,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    borderStyle: "dashed",
  },
  framePrompt: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  bottomBar: {
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 16,
  },
  checklist: { gap: 8 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { fontSize: 12, fontFamily: "Inter_500Medium" },
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
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  shutterHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 10,
  },
  actions: { flexDirection: "row", gap: 10 },
  retake: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  retakeText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
