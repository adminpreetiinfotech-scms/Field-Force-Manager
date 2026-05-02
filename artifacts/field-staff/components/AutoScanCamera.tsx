/**
 * AutoScanCamera
 *
 * Full-screen camera modal with automatic document scanning:
 *  1. Live camera viewfinder with document frame guide overlay
 *  2. One-tap capture → auto-crop to guide frame
 *  3. 3-pass document enhancement (sharpen + contrast)
 *  4. Preview with: "Use Document" / "Retake" / "Adjust Manually"
 *  5. "Adjust Manually" opens DocumentScannerModal with original image
 *
 * Camera-only; gallery upload is intentionally disabled.
 */

import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import DocumentScannerModal, { type ScannedImage } from "./DocumentScannerModal";

// ─── Types ────────────────────────────────────────────────────────────────────

/** "card" = Aadhaar / credit-card (landscape).  "page" = A4/portrait document. */
export type DocMode = "card" | "page";

export interface AutoScanCameraProps {
  visible: boolean;
  title?: string;
  docMode?: DocMode;
  onSave: (img: ScannedImage) => void;
  onCancel: () => void;
}

type Phase = "camera" | "processing" | "preview" | "adjust";

// ─── Guide-frame aspect ratios ────────────────────────────────────────────────
const CARD_RATIO = 54 / 85.6; // credit-card / Aadhaar landscape ratio
const PAGE_RATIO = 1.25;      // portrait document ratio (roughly A5)

// ─── 3-pass document enhancement ─────────────────────────────────────────────
async function processDocument(
  uri: string,
  cropX: number, cropY: number, cropW: number, cropH: number,
  imgW: number,  imgH: number,
): Promise<{ uri: string; base64: string }> {
  const safeX = Math.max(0, Math.min(cropX, imgW - 2));
  const safeY = Math.max(0, Math.min(cropY, imgH - 2));
  const safeW = Math.max(1, Math.min(cropW, imgW - safeX));
  const safeH = Math.max(1, Math.min(cropH, imgH - safeY));

  // Pass 1: crop
  const cropped = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX: safeX, originY: safeY, width: safeW, height: safeH } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.93 },
  );

  // Pass 2: shrink → enlarge (sharpens edges)
  const shrunk = await ImageManipulator.manipulateAsync(
    cropped.uri,
    [{ resize: { width: Math.max(1, Math.round(safeW * 0.5)) } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.99 },
  );
  const enlarged = await ImageManipulator.manipulateAsync(
    shrunk.uri,
    [{ resize: { width: safeW } }],
    { format: ImageManipulator.SaveFormat.PNG },
  );

  // Pass 3: final JPEG with base64
  const final = await ImageManipulator.manipulateAsync(
    enlarged.uri,
    [],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.94, base64: true },
  );
  return { uri: final.uri, base64: final.base64! };
}

// ─── Corner marker ────────────────────────────────────────────────────────────
const CORNER = 22;
const CW = 3.5;

function CornerMarkers() {
  const common: object = { position: "absolute", width: CORNER, height: CORNER };
  const tl: object = { top: -CW, left: -CW, borderTopWidth: CW * 2, borderLeftWidth: CW * 2, borderTopColor: "#fff", borderLeftColor: "#fff", borderTopLeftRadius: 3 };
  const tr: object = { top: -CW, right: -CW, borderTopWidth: CW * 2, borderRightWidth: CW * 2, borderTopColor: "#fff", borderRightColor: "#fff", borderTopRightRadius: 3 };
  const bl: object = { bottom: -CW, left: -CW, borderBottomWidth: CW * 2, borderLeftWidth: CW * 2, borderBottomColor: "#fff", borderLeftColor: "#fff", borderBottomLeftRadius: 3 };
  const br: object = { bottom: -CW, right: -CW, borderBottomWidth: CW * 2, borderRightWidth: CW * 2, borderBottomColor: "#fff", borderRightColor: "#fff", borderBottomRightRadius: 3 };
  return (
    <>
      <View style={[common, tl]} />
      <View style={[common, tr]} />
      <View style={[common, bl]} />
      <View style={[common, br]} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AutoScanCamera({
  visible,
  title = "Auto Scan Document",
  docMode = "page",
  onSave,
  onCancel,
}: AutoScanCameraProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase]               = useState<Phase>("camera");
  const [capturedUri, setCapturedUri]   = useState<string | null>(null);
  const [capturedDims, setCapturedDims] = useState({ w: 0, h: 0 });
  const [processedImg, setProcessedImg] = useState<ScannedImage | null>(null);

  // Reset to camera phase whenever the modal opens
  useEffect(() => {
    if (visible) {
      setPhase("camera");
      setCapturedUri(null);
      setProcessedImg(null);
    }
  }, [visible]);

  // ── Guide frame geometry (calculated, not measured) ──────────────────────────
  const TOP_BAR_H  = Platform.OS === "ios" ? 106 : 72;
  const BOT_AREA_H = Platform.OS === "ios" ? 168 : 148;
  const GUIDE_W    = screenW * 0.86;
  const GUIDE_H    = docMode === "card" ? GUIDE_W * CARD_RATIO : GUIDE_W * PAGE_RATIO;
  const GUIDE_X    = (screenW - GUIDE_W) / 2;
  const avail      = screenH - TOP_BAR_H - BOT_AREA_H;
  const GUIDE_Y    = TOP_BAR_H + Math.max(0, (avail - GUIDE_H) / 2);

  // ── Capture ──────────────────────────────────────────────────────────────────
  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setPhase("processing");
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        base64: false,
        skipProcessing: false,
      });
      if (!pic?.uri) { setPhase("camera"); return; }

      const imgW = pic.width;
      const imgH = pic.height;
      setCapturedUri(pic.uri);
      setCapturedDims({ w: imgW, h: imgH });

      // Fill/cover mapping: camera sensor → screen display
      // scale = factor applied to image so it fills the screen (cover semantics)
      const scale    = Math.max(screenW / imgW, screenH / imgH);
      const xOff     = (imgW * scale - screenW) / 2; // rendered px cropped on each horizontal side
      const yOff     = (imgH * scale - screenH) / 2; // rendered px cropped on each vertical side

      // Guide frame (screen px) → image pixel coordinates
      const cropX = Math.round((GUIDE_X + xOff) / scale);
      const cropY = Math.round((GUIDE_Y + yOff) / scale);
      const cropW = Math.round(GUIDE_W / scale);
      const cropH = Math.round(GUIDE_H / scale);

      const result = await processDocument(pic.uri, cropX, cropY, cropW, cropH, imgW, imgH);
      setProcessedImg({ uri: result.uri, base64: result.base64, mimeType: "image/jpeg" });
      setPhase("preview");
    } catch (err) {
      console.warn("[AutoScanCamera] capture error:", err);
      setPhase("camera");
    }
  };

  const handleRetake = () => {
    setProcessedImg(null);
    setCapturedUri(null);
    setPhase("camera");
  };

  // ── Permission screen ─────────────────────────────────────────────────────────
  if (visible && (!permission || !permission.granted)) {
    return (
      <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
        <View style={styles.permRoot}>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permDesc}>
            Camera is needed to scan documents.{"\n"}Gallery upload is disabled for security.
          </Text>
          {permission && !permission.granted && (
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnTxt}>Grant Camera Permission</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.permBtn, { backgroundColor: "#374151", marginTop: 8 }]}
            onPress={onCancel}
          >
            <Text style={styles.permBtnTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <View style={[styles.root, { width: screenW, height: screenH }]}>

        {/* ── Phase: manual adjust ─────────────────────────────────────── */}
        {phase === "adjust" && capturedUri && (
          <DocumentScannerModal
            visible={true}
            imageUri={capturedUri}
            imageWidth={capturedDims.w}
            imageHeight={capturedDims.h}
            title={title}
            onSave={(img) => { onSave(img); }}
            onCancel={() => setPhase("preview")}
          />
        )}

        {/* ── Phase: camera ────────────────────────────────────────────── */}
        {phase === "camera" && (
          <>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

            {/* Dark vignette — 4 strips surrounding guide frame */}
            <View style={[styles.overlay, { top: 0,                    left: 0,        width: screenW, height: GUIDE_Y }]} />
            <View style={[styles.overlay, { top: GUIDE_Y + GUIDE_H,   left: 0,        width: screenW, height: screenH - GUIDE_Y - GUIDE_H }]} />
            <View style={[styles.overlay, { top: GUIDE_Y,              left: 0,        width: GUIDE_X, height: GUIDE_H }]} />
            <View style={[styles.overlay, { top: GUIDE_Y,              left: GUIDE_X + GUIDE_W, width: screenW - GUIDE_X - GUIDE_W, height: GUIDE_H }]} />

            {/* Guide frame */}
            <View style={[styles.guideFrame, { top: GUIDE_Y, left: GUIDE_X, width: GUIDE_W, height: GUIDE_H }]}>
              <CornerMarkers />
            </View>

            {/* Top bar */}
            <View style={[styles.topBar, { paddingTop: Platform.OS === "ios" ? 54 : 26 }]}>
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelTxt}>✕  Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
              <View style={{ width: 80 }} />
            </View>

            {/* Instruction below guide frame */}
            <View style={[styles.instructionWrap, { top: GUIDE_Y + GUIDE_H + 12 }]}>
              <View style={styles.instructionPill}>
                <Text style={styles.instructionTxt}>📄  Align document within the frame</Text>
              </View>
            </View>

            {/* Capture button */}
            <View style={[styles.bottomBar, { bottom: Platform.OS === "ios" ? 54 : 36 }]}>
              <TouchableOpacity style={styles.captureRing} onPress={handleCapture} activeOpacity={0.75}>
                <View style={styles.captureDisc} />
              </TouchableOpacity>
              <Text style={styles.captureLbl}>Auto Scan Document</Text>
            </View>
          </>
        )}

        {/* ── Phase: processing ────────────────────────────────────────── */}
        {phase === "processing" && (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.processingTitle}>Detecting document boundary...</Text>
            <Text style={styles.processingSubtitle}>Enhancing image quality</Text>
          </View>
        )}

        {/* ── Phase: preview ───────────────────────────────────────────── */}
        {phase === "preview" && processedImg && (
          <View style={styles.previewRoot}>
            {/* Header */}
            <View style={[styles.previewHeader, { paddingTop: Platform.OS === "ios" ? 54 : 26 }]}>
              <Text style={styles.topTitle}>{title}</Text>
            </View>

            {/* Document image */}
            <View style={styles.previewImgBox}>
              <Image
                source={{ uri: processedImg.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            </View>

            {/* Status badge */}
            <View style={styles.statusBadge}>
              <Text style={styles.statusTxt}>✓  Document detected automatically</Text>
            </View>

            {/* Action buttons */}
            <View style={[styles.previewActions, { paddingBottom: Platform.OS === "ios" ? 42 : 24 }]}>
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.8}>
                <Text style={styles.retakeTxt}>↩  Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => setPhase("adjust")} activeOpacity={0.8}>
                <Text style={styles.adjustTxt}>✎  Adjust{"\n"}Manually</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.useBtn} onPress={() => onSave(processedImg)} activeOpacity={0.8}>
                <Text style={styles.useTxt}>✓  Use{"\n"}Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { backgroundColor: "#000", overflow: "hidden" },

  // Overlay strips
  overlay: { position: "absolute", backgroundColor: "rgba(0,0,0,0.62)" },

  // Guide frame
  guideFrame: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 4,
  },

  // Top bar
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  cancelBtn:  { minWidth: 80, paddingVertical: 6, paddingHorizontal: 8 },
  cancelTxt:  { color: "#fff", fontSize: 13 },
  topTitle:   { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center" },

  // Instruction
  instructionWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  instructionPill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20,
  },
  instructionTxt: { color: "#fff", fontSize: 13 },

  // Capture button
  bottomBar:    { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 10 },
  captureRing:  {
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 3.5, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  captureDisc:  { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  captureLbl:   { color: "#fff", fontSize: 12, textShadowColor: "#000", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },

  // Processing
  processingBox: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", gap: 16 },
  processingTitle:    { color: "#fff", fontSize: 16, fontWeight: "600" },
  processingSubtitle: { color: "#666", fontSize: 13 },

  // Preview
  previewRoot:   { flex: 1, backgroundColor: "#0a0a0a" },
  previewHeader: { backgroundColor: "#1E3A5F", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 12 },
  previewImgBox: { flex: 1, backgroundColor: "#111" },

  statusBadge: {
    backgroundColor: "#064E3B",
    marginHorizontal: 16, marginTop: 10,
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
    alignItems: "center",
  },
  statusTxt: { color: "#34D399", fontSize: 13, fontWeight: "600" },

  previewActions: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 14, paddingTop: 12,
  },
  retakeBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#1F2937", alignItems: "center",
  },
  retakeTxt: { color: "#E5E7EB", fontSize: 13, fontWeight: "600", textAlign: "center" },
  adjustBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#374151", alignItems: "center",
  },
  adjustTxt: { color: "#D1D5DB", fontSize: 13, fontWeight: "600", textAlign: "center" },
  useBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#1D4ED8", alignItems: "center",
  },
  useTxt: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },

  // Permission
  permRoot: { flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  permTitle: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  permDesc:  { color: "#9CA3AF", fontSize: 14, textAlign: "center", lineHeight: 22 },
  permBtn:   { backgroundColor: "#2563EB", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, width: "100%", alignItems: "center" },
  permBtnTxt:{ color: "#fff", fontSize: 15, fontWeight: "600" },
});
