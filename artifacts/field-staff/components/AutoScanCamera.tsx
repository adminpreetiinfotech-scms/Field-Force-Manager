/**
 * AutoScanCamera — v6 (ML Kit + Image Picker hybrid)
 *
 * Two-mode operation — automatically detected at runtime:
 *
 *  MODE A — EAS / Production APK  (react-native-document-scanner-plugin available):
 *    Launches Google ML Kit Document Scanner directly.
 *    • Real-time edge detection + perspective correction
 *    • Native Google UI — no custom camera code needed
 *    • Android: ML Kit (on-device, offline)
 *    • iOS: VisionKit
 *
 *  MODE B — Expo Go  (native module unavailable):
 *    Falls back to a clean expo-image-picker bottom sheet:
 *    • 📷 Take Photo   — device camera
 *    • 🖼️ Gallery      — existing photo
 *
 * register.tsx and all callers need zero changes — same props interface.
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

// ─── ML Kit detection ─────────────────────────────────────────────────────────
// Dynamic require so Metro / Expo Go does not crash when the native module is absent.

type MlKitScanner = {
  scanDocument: (opts: {
    croppedImageQuality: number;
    maxNumDocuments: number;
    letUserAdjustCrop: boolean;
  }) => Promise<{ scannedImages: string[] }>;
};

let MlKit: MlKitScanner | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MlKit = (
    require("react-native-document-scanner-plugin") as {
      default: MlKitScanner;
    }
  ).default;
  // Validate: the module may be present but the native bridge absent (old RN arch)
  if (typeof MlKit?.scanDocument !== "function") MlKit = null;
} catch {
  MlKit = null;
}

// ─── DocType (kept for API compat — callers still pass it) ────────────────────

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

const MAX_WIDTH = 1600;

async function compressUri(uri: string, width?: number): Promise<ScannedImage> {
  const actions: ImageManipulator.Action[] =
    (width ?? MAX_WIDTH) > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];

  const out = await ImageManipulator.manipulateAsync(uri, actions, {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.9,
    base64: true,
  });
  return { uri: out.uri, base64: out.base64!, mimeType: "image/jpeg" };
}

// ─── MODE A: ML Kit scanner ───────────────────────────────────────────────────

function MlKitMode({
  visible,
  onSave,
  onCancel,
}: Pick<AutoScanCameraProps, "visible" | "onSave" | "onCancel">) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Launch ML Kit automatically as soon as the component becomes visible.
  useEffect(() => {
    if (!visible) return;
    setBusy(true);
    setError(null);
    launchMlKit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function launchMlKit() {
    try {
      const { scannedImages } = await MlKit!.scanDocument({
        croppedImageQuality: 100,
        maxNumDocuments: 1,
        letUserAdjustCrop: true,
      });

      if (!scannedImages?.length) {
        // User pressed the back button inside ML Kit — treat as cancel.
        setBusy(false);
        onCancel();
        return;
      }

      const img = await compressUri(scannedImages[0]!);
      setBusy(false);
      onSave(img);
    } catch (err) {
      setBusy(false);
      const msg =
        err instanceof Error ? err.message : "Scanner failed. Please retry.";
      setError(msg);
    }
  }

  // Minimal overlay — ML Kit draws its own full-screen camera UI on top.
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.mlBackdrop}>
        {busy && !error && (
          <View style={styles.mlBox}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.mlTxt}>Opening document scanner…</Text>
          </View>
        )}

        {error && (
          <View style={styles.mlErrorBox}>
            <Text style={styles.mlErrorTitle}>⚠️  Scan Failed</Text>
            <Text style={styles.mlErrorMsg}>{error}</Text>

            <TouchableOpacity
              style={styles.mlBtn}
              onPress={() => {
                setBusy(true);
                setError(null);
                launchMlKit();
              }}
            >
              <Text style={styles.mlBtnTxt}>Try Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mlBtn, styles.mlBtnCancel]}
              onPress={onCancel}
            >
              <Text style={[styles.mlBtnTxt, { color: "#6B7280" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── MODE B: expo-image-picker bottom sheet ───────────────────────────────────

function PickerMode({
  visible,
  title,
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
        setBusy(false);
        return;
      }

      const asset = result.assets[0];
      const img = await compressUri(asset.uri, asset.width);
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
          <View style={styles.handle} />
          <Text style={styles.title}>{title ?? "Capture Document"}</Text>

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

// ─── Main export — picks the right mode at runtime ────────────────────────────

export default function AutoScanCamera(props: AutoScanCameraProps) {
  if (MlKit) {
    return <MlKitMode {...props} />;
  }
  return <PickerMode {...props} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── ML Kit overlay ──
  mlBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  mlBox: {
    alignItems: "center",
    gap: 16,
  },
  mlTxt: { color: "#fff", fontSize: 15, fontWeight: "500" },
  mlErrorBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    alignItems: "center",
    gap: 10,
  },
  mlErrorTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  mlErrorMsg: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
  },
  mlBtn: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    marginTop: 4,
  },
  mlBtnCancel: { backgroundColor: "#F3F4F6" },
  mlBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // ── Picker bottom sheet ──
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
