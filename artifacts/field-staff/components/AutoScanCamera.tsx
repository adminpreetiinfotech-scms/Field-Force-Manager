/**
 * AutoScanCamera — v2
 *
 * Full-screen camera modal with automatic document scanning:
 *  1. Live camera viewfinder with animated document-frame guide
 *  2. Torch / flash toggle for low-light environments
 *  3. One-tap capture → smart auto-crop to guide frame
 *  4. 4-pass document enhancement (denoise → sharpen → resize → re-encode)
 *  5. Preview with: "Use Document" / "Retake" / "Adjust Manually"
 *  6. "Adjust Manually" opens DocumentScannerModal with original raw image
 *
 * Camera-only — gallery upload intentionally disabled.
 */

import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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

/** "card" = Aadhaar / credit-card landscape.  "page" = A4/portrait document. */
export type DocMode = "card" | "page";

export interface AutoScanCameraProps {
  visible: boolean;
  title?: string;
  docMode?: DocMode;
  onSave: (img: ScannedImage) => void;
  onCancel: () => void;
}

type Phase = "camera" | "processing" | "preview" | "adjust";
type ProcessStep = "cropping" | "denoising" | "enhancing" | "finalising";

// ─── Aspect ratios ────────────────────────────────────────────────────────────
const CARD_RATIO = 54 / 85.6;   // Aadhaar / credit-card landscape (h/w)
const PAGE_RATIO = 297 / 210;   // A4 portrait (h/w)

// ─── Standard output sizes ────────────────────────────────────────────────────
const CARD_OUT_W = 1280;
const CARD_OUT_H = Math.round(CARD_OUT_W * CARD_RATIO);   // ≈ 809
const PAGE_OUT_W = 1240;
const PAGE_OUT_H = Math.round(PAGE_OUT_W * PAGE_RATIO);   // ≈ 1754

// ─── 4-pass document enhancement ─────────────────────────────────────────────
async function processDocument(
  uri: string,
  cropX: number, cropY: number, cropW: number, cropH: number,
  imgW: number,  imgH: number,
  docMode: DocMode,
  onStep: (s: ProcessStep) => void,
): Promise<{ uri: string; base64: string }> {
  // Safety-clamp crop region
  const safeX = Math.max(0, Math.min(Math.round(cropX), imgW - 2));
  const safeY = Math.max(0, Math.min(Math.round(cropY), imgH - 2));
  const safeW = Math.max(4, Math.min(Math.round(cropW), imgW - safeX));
  const safeH = Math.max(4, Math.min(Math.round(cropH), imgH - safeY));

  // Pass 1 — crop
  onStep("cropping");
  const cropped = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX: safeX, originY: safeY, width: safeW, height: safeH } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.97 },
  );

  // Pass 2 — denoise: shrink to 50 % (JPEG lossy compression reduces sensor noise)
  onStep("denoising");
  const shrunk = await ImageManipulator.manipulateAsync(
    cropped.uri,
    [{ resize: { width: Math.max(4, Math.round(safeW * 0.5)) } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.99 },
  );

  // Pass 3 — sharpen: enlarge back to original size (accentuates edges)
  onStep("enhancing");
  const enlarged = await ImageManipulator.manipulateAsync(
    shrunk.uri,
    [{ resize: { width: safeW } }],
    { format: ImageManipulator.SaveFormat.PNG },
  );

  // Pass 4 — resize to standard output resolution + encode JPEG + base64
  onStep("finalising");
  const outW = docMode === "card" ? CARD_OUT_W : PAGE_OUT_W;
  const outH = docMode === "card" ? CARD_OUT_H : PAGE_OUT_H;

  const final = await ImageManipulator.manipulateAsync(
    enlarged.uri,
    [{ resize: { width: outW, height: outH } }],
    { format: ImageManipulator.SaveFormat.JPEG, compress: 0.93, base64: true },
  );

  return { uri: final.uri, base64: final.base64! };
}

// ─── Corner markers ───────────────────────────────────────────────────────────
const CORNER = 22;
const CW = 3.5;

function CornerMarkers({ color }: { color: string }) {
  const cs: object = { position: "absolute", width: CORNER, height: CORNER };
  const tl: object = { top: -CW, left: -CW, borderTopWidth: CW * 2, borderLeftWidth: CW * 2, borderTopColor: color, borderLeftColor: color, borderTopLeftRadius: 3 };
  const tr: object = { top: -CW, right: -CW, borderTopWidth: CW * 2, borderRightWidth: CW * 2, borderTopColor: color, borderRightColor: color, borderTopRightRadius: 3 };
  const bl: object = { bottom: -CW, left: -CW, borderBottomWidth: CW * 2, borderLeftWidth: CW * 2, borderBottomColor: color, borderLeftColor: color, borderBottomLeftRadius: 3 };
  const br: object = { bottom: -CW, right: -CW, borderBottomWidth: CW * 2, borderRightWidth: CW * 2, borderBottomColor: color, borderRightColor: color, borderBottomRightRadius: 3 };
  return (
    <>
      <View style={[cs, tl]} />
      <View style={[cs, tr]} />
      <View style={[cs, bl]} />
      <View style={[cs, br]} />
    </>
  );
}

// ─── Scanning line animation ──────────────────────────────────────────────────
function ScanLine({ guideH }: { guideH: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, guideH - 4] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", left: 6, right: 6, height: 2,
        backgroundColor: "rgba(100,255,120,0.65)",
        borderRadius: 1,
        transform: [{ translateY }],
        shadowColor: "#4ade80", shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

// ─── Process step label ───────────────────────────────────────────────────────
const STEP_LABELS: Record<ProcessStep, string> = {
  cropping:   "Cropping document area…",
  denoising:  "Removing background noise…",
  enhancing:  "Enhancing clarity & sharpness…",
  finalising: "Finalising output…",
};

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

  const [phase, setPhase]                   = useState<Phase>("camera");
  const [processStep, setProcessStep]       = useState<ProcessStep>("cropping");
  const [capturedUri, setCapturedUri]       = useState<string | null>(null);
  const [capturedDims, setCapturedDims]     = useState({ w: 0, h: 0 });
  const [processedImg, setProcessedImg]     = useState<ScannedImage | null>(null);
  const [torchOn, setTorchOn]               = useState(false);
  const [autoDetected, setAutoDetected]     = useState(true);

  // Animated border glow for guide frame
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);
  const borderOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.95] });

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setPhase("camera");
      setCapturedUri(null);
      setProcessedImg(null);
      setAutoDetected(true);
      setTorchOn(false);
    }
  }, [visible]);

  // ── Guide frame geometry ───────────────────────────────────────────────────
  const TOP_BAR_H  = Platform.OS === "ios" ? 110 : 76;
  const BOT_AREA_H = Platform.OS === "ios" ? 174 : 154;
  const GUIDE_W    = screenW * 0.88;
  const GUIDE_H    = docMode === "card" ? GUIDE_W * CARD_RATIO : GUIDE_W * PAGE_RATIO;
  const GUIDE_X    = (screenW - GUIDE_W) / 2;
  const avail      = screenH - TOP_BAR_H - BOT_AREA_H;
  const GUIDE_Y    = TOP_BAR_H + Math.max(8, (avail - GUIDE_H) / 2);

  // ── Capture ────────────────────────────────────────────────────────────────
  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setPhase("processing");
    setProcessStep("cropping");
    setTorchOn(false);
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 0.95,
        base64: false,
        skipProcessing: false,
        exif: true,
      });
      if (!pic?.uri) { setPhase("camera"); return; }

      const imgW = pic.width;
      const imgH = pic.height;
      setCapturedUri(pic.uri);
      setCapturedDims({ w: imgW, h: imgH });

      // Cover-mode mapping: camera sensor → screen display
      // scale = how much the image is magnified so it fills the screen
      const scale = Math.max(screenW / imgW, screenH / imgH);
      // How many image-space pixels are hidden on each side (cover overflow)
      const xOff  = (imgW - screenW / scale) / 2;
      const yOff  = (imgH - screenH / scale) / 2;

      // Guide frame screen coords → image pixel coords
      const cropX = xOff + GUIDE_X / scale;
      const cropY = yOff + GUIDE_Y / scale;
      const cropW = GUIDE_W / scale;
      const cropH = GUIDE_H / scale;

      const result = await processDocument(
        pic.uri, cropX, cropY, cropW, cropH, imgW, imgH,
        docMode,
        (step) => setProcessStep(step),
      );

      setProcessedImg({ uri: result.uri, base64: result.base64, mimeType: "image/jpeg" });
      setAutoDetected(true);
      setPhase("preview");
    } catch {
      setAutoDetected(false);
      setPhase("camera");
    }
  };

  const handleRetake = () => {
    setProcessedImg(null);
    setCapturedUri(null);
    setPhase("camera");
  };

  // ── Permission screen ───────────────────────────────────────────────────────
  if (visible && (!permission || !permission.granted)) {
    return (
      <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
        <View style={styles.permRoot}>
          <Text style={styles.permIcon}>📷</Text>
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permDesc}>
            Camera permission is needed to scan documents.{"\n"}
            Gallery upload is disabled for security.
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

        {/* ── Adjust manually phase ──────────────────────────────────────── */}
        {phase === "adjust" && capturedUri && (
          <DocumentScannerModal
            visible
            imageUri={capturedUri}
            imageWidth={capturedDims.w}
            imageHeight={capturedDims.h}
            title={title}
            onSave={(img) => { onSave(img); }}
            onCancel={() => setPhase("preview")}
          />
        )}

        {/* ── Camera phase ──────────────────────────────────────────────── */}
        {phase === "camera" && (
          <>
            {/* Camera viewfinder */}
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torchOn}
            />

            {/* Dark vignette strips around guide frame */}
            <View style={[styles.overlay, { top: 0,                    left: 0,        width: screenW, height: GUIDE_Y }]} />
            <View style={[styles.overlay, { top: GUIDE_Y + GUIDE_H,   left: 0,        width: screenW, height: screenH - GUIDE_Y - GUIDE_H }]} />
            <View style={[styles.overlay, { top: GUIDE_Y,              left: 0,        width: GUIDE_X, height: GUIDE_H }]} />
            <View style={[styles.overlay, { top: GUIDE_Y,              left: GUIDE_X + GUIDE_W, width: screenW - GUIDE_X - GUIDE_W, height: GUIDE_H }]} />

            {/* Guide frame with animated opacity */}
            <Animated.View
              style={[
                styles.guideFrame,
                { top: GUIDE_Y, left: GUIDE_X, width: GUIDE_W, height: GUIDE_H, opacity: borderOpacity },
              ]}
            >
              <CornerMarkers color="#fff" />
              {/* Scanning line */}
              <ScanLine guideH={GUIDE_H} />
            </Animated.View>

            {/* Top bar */}
            <View style={[styles.topBar, { paddingTop: Platform.OS === "ios" ? 56 : 28 }]}>
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} hitSlop={10}>
                <Text style={styles.cancelTxt}>✕  Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
              {/* Torch toggle */}
              <TouchableOpacity
                style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
                onPress={() => setTorchOn((v) => !v)}
                hitSlop={10}
              >
                <Text style={styles.torchIcon}>{torchOn ? "🔦" : "💡"}</Text>
              </TouchableOpacity>
            </View>

            {/* Instruction below guide frame */}
            <View style={[styles.instructionWrap, { top: GUIDE_Y + GUIDE_H + 10 }]}>
              <View style={styles.instructionPill}>
                <Text style={styles.instructionTxt}>
                  📄  Align document within the frame, then tap capture
                </Text>
              </View>
              {docMode === "card" && (
                <Text style={styles.instructionSub}>Hold phone in portrait — card in landscape</Text>
              )}
            </View>

            {/* Bottom bar: capture button */}
            <View style={[styles.bottomBar, { bottom: Platform.OS === "ios" ? 56 : 40 }]}>
              <TouchableOpacity style={styles.captureRing} onPress={handleCapture} activeOpacity={0.75}>
                <View style={styles.captureDisc} />
              </TouchableOpacity>
              <Text style={styles.captureLbl}>Auto Scan Document</Text>
            </View>
          </>
        )}

        {/* ── Processing phase ──────────────────────────────────────────── */}
        {phase === "processing" && (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.processingTitle}>Scanning Document</Text>
            <Text style={styles.processingStep}>{STEP_LABELS[processStep]}</Text>
            <View style={styles.stepDots}>
              {(["cropping", "denoising", "enhancing", "finalising"] as ProcessStep[]).map((s) => (
                <View
                  key={s}
                  style={[
                    styles.stepDot,
                    processStep === s && styles.stepDotActive,
                    ["denoising", "enhancing", "finalising"].indexOf(s) <
                    ["denoising", "enhancing", "finalising"].indexOf(processStep)
                      ? styles.stepDotDone
                      : null,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Preview phase ─────────────────────────────────────────────── */}
        {phase === "preview" && processedImg && (
          <View style={styles.previewRoot}>
            {/* Header */}
            <View style={[styles.previewHeader, { paddingTop: Platform.OS === "ios" ? 56 : 28 }]}>
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
            <View style={[styles.statusBadge, !autoDetected && styles.statusBadgeWarn]}>
              {autoDetected
                ? <Text style={styles.statusTxt}>✓  Document detected automatically</Text>
                : <Text style={[styles.statusTxt, { color: "#FCD34D" }]}>⚠  Use "Adjust Manually" if crop is off</Text>}
            </View>

            {/* Action buttons */}
            <View style={[styles.previewActions, { paddingBottom: Platform.OS === "ios" ? 44 : 26 }]}>
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} activeOpacity={0.8}>
                <Text style={styles.retakeTxt}>↩  Retake</Text>
              </TouchableOpacity>
              {capturedUri && (
                <TouchableOpacity style={styles.adjustBtn} onPress={() => setPhase("adjust")} activeOpacity={0.8}>
                  <Text style={styles.adjustTxt}>✎  Adjust{"\n"}Manually</Text>
                </TouchableOpacity>
              )}
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
  root:    { backgroundColor: "#000", overflow: "hidden" },

  // Overlay strips
  overlay: { position: "absolute", backgroundColor: "rgba(0,0,0,0.65)" },

  // Guide frame
  guideFrame: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 4,
    overflow: "hidden",
  },

  // Top bar
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  cancelBtn:  { paddingVertical: 6, paddingHorizontal: 8, minWidth: 72 },
  cancelTxt:  { color: "#fff", fontSize: 13 },
  topTitle:   { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center" },

  // Torch
  torchBtn:    { paddingVertical: 6, paddingHorizontal: 8, minWidth: 42, borderRadius: 8, alignItems: "center" },
  torchBtnOn:  { backgroundColor: "rgba(253,224,71,0.22)" },
  torchIcon:   { fontSize: 18 },

  // Instruction
  instructionWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 6 },
  instructionPill: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 22,
  },
  instructionTxt: { color: "#fff", fontSize: 12.5, textAlign: "center" },
  instructionSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, textAlign: "center" },

  // Capture button
  bottomBar:    { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 10 },
  captureRing:  {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 3.5, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  captureDisc:  { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },
  captureLbl:   { color: "#fff", fontSize: 12, letterSpacing: 0.3,
                  textShadowColor: "#000", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },

  // Processing
  processingBox: {
    flex: 1, backgroundColor: "#060612",
    alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32,
  },
  processingTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  processingStep:  { color: "#9CA3AF", fontSize: 13, textAlign: "center" },
  stepDots: { flexDirection: "row", gap: 8, marginTop: 4 },
  stepDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: "#374151" },
  stepDotActive: { backgroundColor: "#4ade80", width: 22, borderRadius: 4 },
  stepDotDone:   { backgroundColor: "#065F46" },

  // Preview
  previewRoot:   { flex: 1, backgroundColor: "#060612" },
  previewHeader: { backgroundColor: "#1E3A5F", flexDirection: "row", alignItems: "center",
                   paddingHorizontal: 14, paddingBottom: 12 },
  previewImgBox: { flex: 1, backgroundColor: "#111" },

  statusBadge: {
    backgroundColor: "#064E3B",
    marginHorizontal: 14, marginTop: 10,
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16,
    alignItems: "center",
  },
  statusBadgeWarn: { backgroundColor: "#78350F" },
  statusTxt: { color: "#34D399", fontSize: 13, fontWeight: "600" },

  previewActions: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 14, paddingTop: 10,
  },
  retakeBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 12,
    backgroundColor: "#1F2937", alignItems: "center",
  },
  retakeTxt: { color: "#E5E7EB", fontSize: 13, fontWeight: "600", textAlign: "center" },
  adjustBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 12,
    backgroundColor: "#374151", alignItems: "center",
  },
  adjustTxt: { color: "#D1D5DB", fontSize: 13, fontWeight: "600", textAlign: "center" },
  useBtn: {
    flex: 1.2, paddingVertical: 16, borderRadius: 12,
    backgroundColor: "#1D4ED8", alignItems: "center",
  },
  useTxt: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },

  // Permission
  permRoot:    { flex: 1, backgroundColor: "#060612", alignItems: "center", justifyContent: "center",
                 paddingHorizontal: 32, gap: 14 },
  permIcon:    { fontSize: 52 },
  permTitle:   { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  permDesc:    { color: "#9CA3AF", fontSize: 14, textAlign: "center", lineHeight: 22 },
  permBtn:     { backgroundColor: "#2563EB", paddingHorizontal: 28, paddingVertical: 14,
                 borderRadius: 12, width: "100%", alignItems: "center" },
  permBtnTxt:  { color: "#fff", fontSize: 15, fontWeight: "600" },
});
