/**
 * AutoScanCamera — v5 (Simple & Fast)
 *
 * Replaces the previous WebView + native-plugin hybrid with a clean
 * expo-image-picker bottom sheet:
 *   • 📷 Take Photo  — opens the device camera
 *   • 🖼️ Choose from Gallery — picks an existing photo
 *
 * No WebView. No native scanner plugin. No multi-pass processing.
 * Works on Expo Go and EAS builds alike, with zero performance overhead.
 */

import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { ScannedImage } from "./DocumentScannerModal";

// ─── DocType ─────────────────────────────────────────────────────────────────
// Kept for API compatibility with callers (register.tsx passes docType).
// No longer drives any special processing logic.

export type DocType =
  | "aadhaar_front"
  | "aadhaar_back"
  | "bank_passbook"
  | "education_cert"
  | "caste_cert"
  | "other"
  | "card"
  | "page";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AutoScanCameraProps {
  visible: boolean;
  title?: string;
  docType?: DocType;
  onSave: (img: ScannedImage) => void;
  onCancel: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_WIDTH = 1600; // px — keeps files sharp but not massive

async function compressAsset(
  uri: string,
  width: number,
): Promise<ScannedImage> {
  const actions: ImageManipulator.Action[] =
    width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];

  const out = await ImageManipulator.manipulateAsync(uri, actions, {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.88,
    base64: true,
  });

  return { uri: out.uri, base64: out.base64!, mimeType: "image/jpeg" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AutoScanCamera({
  visible,
  title = "Capture Document",
  onSave,
  onCancel,
}: AutoScanCameraProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setBusy(false);
      setError(null);
    }
  }, [visible]);

  async function handle(source: "camera" | "gallery") {
    setBusy(true);
    setError(null);

    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          setError("Camera permission is required to take a photo.");
          setBusy(false);
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"] as ImagePicker.MediaType[],
          quality: 1,
          base64: false,
          allowsEditing: true,
        });
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          setError("Gallery permission is required to pick a photo.");
          setBusy(false);
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"] as ImagePicker.MediaType[],
          quality: 1,
          base64: false,
          allowsEditing: true,
        });
      }

      if (result.canceled || !result.assets?.[0]) {
        // User pressed back inside the picker — stay on the choice sheet.
        setBusy(false);
        return;
      }

      const asset = result.assets[0];
      const img = await compressAsset(asset.uri, asset.width ?? MAX_WIDTH);
      onSave(img);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {busy ? (
            <View style={styles.busyBox}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.busyTxt}>Processing image…</Text>
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTxt}>⚠️  {error}</Text>
                </View>
              ) : null}

              {/* Camera option */}
              <TouchableOpacity
                style={styles.btn}
                onPress={() => handle("camera")}
                activeOpacity={0.7}
              >
                <Text style={styles.btnIcon}>📷</Text>
                <View style={styles.btnTextWrap}>
                  <Text style={styles.btnLabel}>Take Photo</Text>
                  <Text style={styles.btnSub}>
                    Open camera and capture document
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Gallery option */}
              <TouchableOpacity
                style={styles.btn}
                onPress={() => handle("gallery")}
                activeOpacity={0.7}
              >
                <Text style={styles.btnIcon}>🖼️</Text>
                <View style={styles.btnTextWrap}>
                  <Text style={styles.btnLabel}>Choose from Gallery</Text>
                  <Text style={styles.btnSub}>Pick an existing photo</Text>
                </View>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 20,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 16,
  },
  btnIcon: { fontSize: 34 },
  btnTextWrap: { flex: 1 },
  btnLabel: { fontSize: 16, fontWeight: "600", color: "#111827" },
  btnSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: -20,
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelTxt: { fontSize: 15, fontWeight: "600", color: "#6B7280" },
  busyBox: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 14,
  },
  busyTxt: { fontSize: 14, color: "#6B7280" },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorTxt: { color: "#DC2626", fontSize: 13, lineHeight: 18 },
});
