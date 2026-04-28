import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { GeoPoint, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function MeterAddScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, addMeterReading } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [reading, setReading] = useState("");
  const [consumerNo, setConsumerNo] = useState("");
  const [notes, setNotes] = useState("");
  const [loc, setLoc] = useState<GeoPoint | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "web") {
          setLoc({ latitude: 28.6139, longitude: 77.209 });
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const cur = await Location.getCurrentPositionAsync({});
        setLoc({
          latitude: cur.coords.latitude,
          longitude: cur.coords.longitude,
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const openCamera = async () => {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        Alert.alert("Camera needed", "Photo proof of the meter is required.");
        return;
      }
    }
    setShowCamera(true);
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync().catch(() => {});
      }
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      if (result?.uri) {
        setPhoto(result.uri);
        setShowCamera(false);
      }
    } catch {
      Alert.alert("Camera error", "Could not capture. Try again.");
    }
  };

  const submit = async () => {
    if (!user) return;
    if (!photo) {
      Alert.alert("Photo required", "Capture the meter face for proof.");
      return;
    }
    const num = Number(reading);
    if (!reading || Number.isNaN(num) || num < 0) {
      Alert.alert("Invalid reading", "Enter a numeric meter reading in kWh.");
      return;
    }
    if (!consumerNo || consumerNo.length < 4) {
      Alert.alert("Consumer required", "Enter the consumer number.");
      return;
    }
    setSubmitting(true);
    try {
      await addMeterReading({
        staffId: user.id,
        staffName: user.name,
        consumerNo,
        reading: num,
        photoUri: photo,
        notes: notes.trim() || undefined,
        timestamp: Date.now(),
        location: loc,
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  if (showCamera) {
    if (!permission) {
      return (
        <View style={styles.fullCenter}>
          <ActivityIndicator color="#fff" />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View
          style={[
            styles.cameraTopBar,
            { paddingTop: insets.top + 8 + (Platform.OS === "web" ? 67 : 0) },
          ]}
        >
          <Pressable
            onPress={() => setShowCamera(false)}
            style={styles.iconBtn}
            hitSlop={6}
          >
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.cameraHint}>Frame the meter display</Text>
          <View style={styles.iconBtn} />
        </View>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
        />
        <View
          style={styles.meterFrame}
          pointerEvents="none"
        >
          <View style={styles.meterBox} />
        </View>
        <View
          style={[
            styles.cameraBottomBar,
            { paddingBottom: insets.bottom + 24 + (Platform.OS === "web" ? 34 : 0) },
          ]}
        >
          <Pressable
            onPress={capture}
            style={({ pressed }) => [
              styles.shutter,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </View>
    );
  }

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBottom = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12 + webTop,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: 999,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            hitSlop={8}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Meter reading
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Photo + reading + GPS = tamper-proof
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 22,
            paddingBottom: insets.bottom + 32 + webBottom,
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={openCamera}
            style={({ pressed }) => [
              styles.photoTile,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius + 4,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {photo ? (
              <>
                <Image
                  source={{ uri: photo }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                <View style={styles.photoBadge}>
                  <Feather name="refresh-cw" size={12} color="#fff" />
                  <Text style={styles.photoBadgeText}>Retake</Text>
                </View>
              </>
            ) : (
              <View style={styles.photoEmpty}>
                <View
                  style={[
                    styles.cameraIcon,
                    {
                      backgroundColor: colors.primary + "12",
                      borderRadius: 999,
                    },
                  ]}
                >
                  <Feather name="camera" size={22} color={colors.primary} />
                </View>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontFamily: "Inter_700Bold",
                    marginTop: 12,
                  }}
                >
                  Capture meter photo
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    fontFamily: "Inter_400Regular",
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  Required · A clear shot of the meter display
                </Text>
              </View>
            )}
          </Pressable>

          <Field
            label="Consumer number"
            value={consumerNo}
            onChangeText={(v) => setConsumerNo(v.replace(/\s/g, ""))}
            placeholder="e.g. 218450"
            keyboardType="number-pad"
            icon="hash"
          />

          <Field
            label="Reading (kWh)"
            value={reading}
            onChangeText={(v) =>
              setReading(v.replace(/[^0-9.]/g, ""))
            }
            placeholder="e.g. 4287"
            keyboardType="decimal-pad"
            icon="zap"
          />

          <Field
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything unusual?"
            icon="message-square"
            multiline
          />

          <View
            style={[
              styles.locCard,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather
              name="map-pin"
              size={14}
              color={loc ? colors.success : colors.warning}
            />
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                flex: 1,
              }}
            >
              {loc
                ? `GPS locked · ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`
                : "GPS unavailable — reading will save without location"}
            </Text>
          </View>

          <Button
            label="Submit reading"
            onPress={submit}
            loading={submitting}
            size="lg"
            fullWidth
            icon={<Feather name="check" size={18} color="#fff" />}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  icon,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  icon: keyof typeof Feather.glyphMap;
  multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 12,
          fontFamily: "Inter_600SemiBold",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            alignItems: multiline ? "flex-start" : "center",
            paddingTop: multiline ? 14 : 0,
          },
        ]}
      >
        <Feather
          name={icon}
          size={16}
          color={colors.mutedForeground}
          style={{ marginTop: multiline ? 1 : 0 }}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType}
          multiline={multiline}
          style={[
            styles.input,
            {
              color: colors.foreground,
              minHeight: multiline ? 70 : 48,
              textAlignVertical: multiline ? "top" : "center",
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullCenter: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  photoTile: {
    height: 180,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  photoEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  cameraIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
  },
  photoBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  inputWrap: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    paddingVertical: 12,
  },
  locCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cameraTopBar: {
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
  cameraHint: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  meterFrame: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  meterBox: {
    width: "78%",
    height: 200,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 14,
    borderStyle: "dashed",
  },
  cameraBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 18,
    backgroundColor: "rgba(0,0,0,0.7)",
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
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
});
