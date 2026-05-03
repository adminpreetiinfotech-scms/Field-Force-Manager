/**
 * AutoScanCamera — v3  (Deep Auto Document Scanner)
 *
 * Full-screen camera modal with a real document-processing pipeline:
 *  1. Live camera viewfinder with document-type-specific guide frame
 *  2. Torch toggle for low-light
 *  3. One-tap capture → resize to transport size → WebView processing:
 *       a. Grayscale → Gaussian blur → Sobel edges → dilation
 *       b. Projection-profile quad detection + corner refinement
 *       c. Homography (DLT) + perspective warp
 *       d. Brightness / contrast / unsharp-mask enhancement
 *  4. Preview with "Use Document" / "Retake" / "Adjust Manually"
 *  5. DocumentScannerModal fallback for manual corner adjustment
 *
 * Camera-only — gallery upload intentionally disabled.
 */

import { CameraView, useCameraPermissions } from "expo-camera";
import { writeAsStringAsync, cacheDirectory, EncodingType } from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

import DocProcessorBridge, {
  type DocProcessorHandle,
  type DocPoint,
} from "./DocProcessorBridge";
import DocumentScannerModal, { type ScannedImage } from "./DocumentScannerModal";

// ─── Re-export DocType so callers can import it from here ─────────────────────
export type { DocType } from "./DocProcessorBridge";
import type { DocType } from "./DocProcessorBridge";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AutoScanCameraProps {
  visible:   boolean;
  title?:    string;
  docType?:  DocType;
  onSave:    (img: ScannedImage) => void;
  onCancel:  () => void;
}

// ─── Phase & step types ───────────────────────────────────────────────────────

type Phase = "camera" | "processing" | "preview" | "adjust";

const PROC_STEPS = [
  "Reading image…",
  "Detecting document edges…",
  "Correcting perspective…",
  "Enhancing document quality…",
] as const;

// ─── Document-type specifications ─────────────────────────────────────────────

interface DocSpec {
  ratio:  number;   // guide frame h/w ratio
  hint:   string;   // instruction text
  orient: "land" | "port";
}

const DOC_SPECS: Record<DocType, DocSpec> = {
  aadhaar_front:  { ratio: 54 / 85.6, hint: "Hold phone upright — Aadhaar in landscape",          orient: "land" },
  aadhaar_back:   { ratio: 54 / 85.6, hint: "Hold phone upright — Aadhaar in landscape",          orient: "land" },
  bank_passbook:  { ratio: 148 / 105, hint: "Open passbook flat on dark surface, fill the frame", orient: "port" },
  education_cert: { ratio: 297 / 210, hint: "Lay certificate flat on dark surface",               orient: "port" },
  caste_cert:     { ratio: 297 / 210, hint: "Lay certificate flat on dark surface",               orient: "port" },
  other:          { ratio: 297 / 210, hint: "Position document flat to fill the frame",           orient: "port" },
  card:           { ratio: 54 / 85.6, hint: "Hold phone upright — card in landscape",             orient: "land" },
  page:           { ratio: 297 / 210, hint: "Lay document flat on dark surface",                  orient: "port" },
};

// ─── Corner markers ───────────────────────────────────────────────────────────

const CORNER = 22;
const CW     = 3.5;

function CornerMarkers({ color }: { color: string }) {
  const s: object = { position: "absolute", width: CORNER, height: CORNER };
  const tl: object = { top: -CW, left: -CW,     borderTopWidth: CW*2,    borderLeftWidth: CW*2,   borderTopColor: color,    borderLeftColor: color,   borderTopLeftRadius: 3   };
  const tr: object = { top: -CW, right: -CW,    borderTopWidth: CW*2,    borderRightWidth: CW*2,  borderTopColor: color,    borderRightColor: color,  borderTopRightRadius: 3  };
  const bl: object = { bottom: -CW, left: -CW,  borderBottomWidth: CW*2, borderLeftWidth: CW*2,   borderBottomColor: color, borderLeftColor: color,   borderBottomLeftRadius: 3  };
  const br: object = { bottom: -CW, right: -CW, borderBottomWidth: CW*2, borderRightWidth: CW*2,  borderBottomColor: color, borderRightColor: color,  borderBottomRightRadius: 3 };
  return (
    <>
      <View style={[s, tl]} />
      <View style={[s, tr]} />
      <View style={[s, bl]} />
      <View style={[s, br]} />
    </>
  );
}

// ─── Animated scan line ───────────────────────────────────────────────────────

function ScanLine({ guideH }: { guideH: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [2, guideH - 4] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", left: 6, right: 6, height: 2.5,
        backgroundColor: "rgba(100,255,130,0.7)",
        borderRadius: 2,
        transform: [{ translateY }],
        shadowColor: "#4ade80", shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AutoScanCamera({
  visible,
  title    = "Scan Document",
  docType  = "page",
  onSave,
  onCancel,
}: AutoScanCameraProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [permission, requestPermission]     = useCameraPermissions();
  const cameraRef    = useRef<CameraView>(null);
  const processorRef = useRef<DocProcessorHandle>(null);
  // cancelledRef lets handleCapture know the user cancelled mid-processing
  const cancelledRef = useRef(false);

  const [phase,         setPhase]        = useState<Phase>("camera");
  const [stepIdx,       setStepIdx]      = useState(0);
  const [capturedUri,   setCapturedUri]  = useState<string | null>(null);
  const [capturedDims,  setCapturedDims] = useState({ w: 0, h: 0 });
  const [processedImg,  setProcessedImg] = useState<ScannedImage | null>(null);
  const [torchOn,       setTorchOn]      = useState(false);
  const [autoDetected,  setAutoDetected] = useState(true);
  const [bridgeReady,   setBridgeReady]  = useState(false);
  const [error,         setError]        = useState<string | null>(null);

  // Border glow animation on guide frame
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);
  const borderOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.95] });

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPhase("camera");
      setCapturedUri(null);
      setProcessedImg(null);
      setAutoDetected(true);
      setTorchOn(false);
      setError(null);
      setStepIdx(0);
    }
  }, [visible]);

  // Animate processing steps
  useEffect(() => {
    if (phase !== "processing") { setStepIdx(0); return; }
    setStepIdx(0);
    const t1 = setTimeout(() => setStepIdx(1), 700);
    const t2 = setTimeout(() => setStepIdx(2), 1800);
    const t3 = setTimeout(() => setStepIdx(3), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase]);

  // ── Guide frame geometry ───────────────────────────────────────────────────
  const spec       = DOC_SPECS[docType] ?? DOC_SPECS.page;
  const TOP_BAR_H  = Platform.OS === "ios" ? 110 : 76;
  const BOT_AREA_H = Platform.OS === "ios" ? 180 : 158;
  const GUIDE_W    = screenW * 0.87;
  const avail      = screenH - TOP_BAR_H - BOT_AREA_H;
  // Clamp height so the guide frame never overflows the available vertical space
  const GUIDE_H    = Math.min(GUIDE_W * spec.ratio, Math.max(60, avail - 16));
  const GUIDE_X    = (screenW - GUIDE_W) / 2;
  const GUIDE_Y    = TOP_BAR_H + Math.max(8, (avail - GUIDE_H) / 2);

  // ── Compute guide-frame corners in image space ────────────────────────────
  const buildGuideCorners = useCallback(
    (imgW: number, imgH: number): DocPoint[] => {
      const coverScale = Math.max(screenW / imgW, screenH / imgH);
      const xOff       = (imgW - screenW / coverScale) / 2;
      const yOff       = (imgH - screenH / coverScale) / 2;
      const toImgX     = (sx: number) => xOff + sx / coverScale;
      const toImgY     = (sy: number) => yOff + sy / coverScale;
      return [
        { x: toImgX(GUIDE_X),            y: toImgY(GUIDE_Y)            },
        { x: toImgX(GUIDE_X + GUIDE_W),  y: toImgY(GUIDE_Y)            },
        { x: toImgX(GUIDE_X + GUIDE_W),  y: toImgY(GUIDE_Y + GUIDE_H) },
        { x: toImgX(GUIDE_X),            y: toImgY(GUIDE_Y + GUIDE_H)  },
      ];
    },
    [screenW, screenH, GUIDE_X, GUIDE_Y, GUIDE_W, GUIDE_H],
  );

  // ── Cancel during processing ──────────────────────────────────────────────
  const handleCancelProcessing = useCallback(() => {
    // Signal to handleCapture that it should not commit results to state
    cancelledRef.current = true;
    setPhase("camera");
    setError(null);
  }, []);

  // ── Capture & process ─────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    cancelledRef.current = false; // reset cancellation flag for this capture
    setPhase("processing");
    setTorchOn(false);
    setError(null);

    try {
      // 1 — Take picture
      const pic = await cameraRef.current.takePictureAsync({
        quality: 0.95, base64: false, skipProcessing: false,
      });
      if (!pic?.uri) { setPhase("camera"); return; }

      setCapturedUri(pic.uri);
      setCapturedDims({ w: pic.width, h: pic.height });

      // 2 — Resize to transport size (max 2400 px wide)
      const MAX_W  = 2400;
      const tgtW   = Math.min(MAX_W, pic.width);
      const resized = await ImageManipulator.manipulateAsync(
        pic.uri,
        tgtW < pic.width ? [{ resize: { width: tgtW } }] : [],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.92, base64: true },
      );
      const base64 = resized.base64!;
      const imgW   = resized.width;
      const imgH   = resized.height;

      // 3 — Compute guide corners (fallback for auto-detect failures)
      const guideCorners = buildGuideCorners(imgW, imgH);

      // 4 — Send to WebView processor
      if (!processorRef.current) throw new Error("Processor not mounted");
      const result = await processorRef.current.processImage(base64, {
        docType,
        guideCorners,
        enhance:    true,
        brightness: 1.08,
        contrast:   1.12,
        sharpness:  1.35,
      });

      // 5 — If user cancelled while we were waiting, discard the result
      if (cancelledRef.current) return;

      // 6 — Save data URI to temp file so we have a real file URI
      const b64     = result.imageDataUri.replace(/^data:image\/\w+;base64,/, "");
      const tmpPath = `${cacheDirectory ?? ""}scan_${Date.now()}.jpg`;
      await writeAsStringAsync(tmpPath, b64, {
        encoding: EncodingType.Base64,
      });

      // 7 — One final cancellation check before committing state
      if (cancelledRef.current) return;

      setAutoDetected(result.autoDetected);
      setProcessedImg({ uri: tmpPath, base64: b64, mimeType: "image/jpeg" });
      setPhase("preview");

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      setError(msg);
      setPhase("camera");
    }
  }, [docType, buildGuideCorners]);

  const handleRetake = useCallback(() => {
    setProcessedImg(null);
    setCapturedUri(null);
    setError(null);
    setPhase("camera");
  }, []);

  // ── Permission screen ─────────────────────────────────────────────────────
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

  // ── Full render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden image-processor WebView — always mounted for instant readiness */}
      <DocProcessorBridge
        ref={processorRef}
        onReady={() => setBridgeReady(true)}
      />

      <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
        <View style={[styles.root, { width: screenW, height: screenH }]}>

          {/* ── Manual adjust phase ─────────────────────────────────────── */}
          {phase === "adjust" && capturedUri && (
            <DocumentScannerModal
              visible
              imageUri={capturedUri}
              imageWidth={capturedDims.w}
              imageHeight={capturedDims.h}
              title={title}
              onSave={(img) => onSave(img)}
              onCancel={() => setPhase("preview")}
            />
          )}

          {/* ── Camera phase ────────────────────────────────────────────── */}
          {phase === "camera" && (
            <>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torchOn}
              />

              {/* Dark vignette strips around guide frame */}
              <View style={[styles.overlay, { top: 0,                  left: 0, width: screenW, height: GUIDE_Y }]} />
              <View style={[styles.overlay, { top: GUIDE_Y + GUIDE_H,  left: 0, width: screenW, height: screenH - GUIDE_Y - GUIDE_H }]} />
              <View style={[styles.overlay, { top: GUIDE_Y,            left: 0, width: GUIDE_X, height: GUIDE_H }]} />
              <View style={[styles.overlay, { top: GUIDE_Y,            left: GUIDE_X + GUIDE_W, width: screenW - GUIDE_X - GUIDE_W, height: GUIDE_H }]} />

              {/* Animated guide frame */}
              <Animated.View
                style={[styles.guideFrame, {
                  top: GUIDE_Y, left: GUIDE_X,
                  width: GUIDE_W, height: GUIDE_H,
                  opacity: borderOpacity,
                }]}
              >
                <CornerMarkers color="#fff" />
                <ScanLine guideH={GUIDE_H} />
              </Animated.View>

              {/* Top bar */}
              <View style={[styles.topBar, { paddingTop: Platform.OS === "ios" ? 56 : 28 }]}>
                <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} hitSlop={10}>
                  <Text style={styles.cancelTxt}>✕  Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
                <TouchableOpacity
                  style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
                  onPress={() => setTorchOn((v) => !v)}
                  hitSlop={10}
                >
                  <Text style={styles.torchIcon}>{torchOn ? "🔦" : "💡"}</Text>
                </TouchableOpacity>
              </View>

              {/* Instruction */}
              <View style={[styles.instructionWrap, { top: GUIDE_Y + GUIDE_H + 12 }]}>
                <View style={styles.instructionPill}>
                  <Text style={styles.instructionTxt}>
                    📄  {spec.hint}
                  </Text>
                </View>
                {!bridgeReady && (
                  <View style={styles.initPill}>
                    <ActivityIndicator size="small" color="#4ade80" style={{ marginRight: 6 }} />
                    <Text style={styles.initTxt}>Initialising scanner…</Text>
                  </View>
                )}
                {error && (
                  <View style={[styles.initPill, { backgroundColor: "rgba(127,29,29,0.85)" }]}>
                    <Text style={[styles.initTxt, { color: "#FCA5A5" }]}>⚠  {error}</Text>
                  </View>
                )}
              </View>

              {/* Capture button */}
              <View style={[styles.bottomBar, { bottom: Platform.OS === "ios" ? 56 : 40 }]}>
                <TouchableOpacity
                  style={[styles.captureRing, !bridgeReady && styles.captureRingDim]}
                  onPress={handleCapture}
                  activeOpacity={0.75}
                  disabled={!bridgeReady}
                >
                  <View style={[styles.captureDisc, !bridgeReady && styles.captureDiscDim]} />
                </TouchableOpacity>
                <Text style={styles.captureLbl}>
                  {bridgeReady ? "Tap to Scan" : "Initialising…"}
                </Text>
              </View>
            </>
          )}

          {/* ── Processing phase ─────────────────────────────────────────── */}
          {phase === "processing" && (
            <View style={styles.processingBox}>
              <ActivityIndicator size="large" color="#4ade80" />
              <Text style={styles.processingTitle}>Scanning Document</Text>
              <Text style={styles.processingStep}>{PROC_STEPS[stepIdx]}</Text>
              <View style={styles.stepDots}>
                {PROC_STEPS.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.stepDot,
                      i === stepIdx && styles.stepDotActive,
                      i < stepIdx   && styles.stepDotDone,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.processingHint}>
                Detecting edges · Correcting perspective · Enhancing quality
              </Text>
              <TouchableOpacity
                style={styles.cancelProcBtn}
                onPress={handleCancelProcessing}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelProcTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Preview phase ─────────────────────────────────────────────── */}
          {phase === "preview" && processedImg && (
            <View style={styles.previewRoot}>

              <View style={[styles.previewHeader, { paddingTop: Platform.OS === "ios" ? 56 : 28 }]}>
                <Text style={styles.topTitle}>{title}</Text>
              </View>

              <View style={styles.previewImgBox}>
                <Image
                  source={{ uri: processedImg.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
              </View>

              {/* Detection badge */}
              <View style={[styles.statusBadge, !autoDetected && styles.statusBadgeWarn]}>
                {autoDetected
                  ? <Text style={styles.statusTxt}>✓  Document edges auto-detected & corrected</Text>
                  : <Text style={[styles.statusTxt, { color: "#FCD34D" }]}>⚠  Guide frame used — tap "Adjust Manually" if crop is off</Text>
                }
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
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { backgroundColor: "#000", overflow: "hidden" },

  overlay: { position: "absolute", backgroundColor: "rgba(0,0,0,0.65)" },

  guideFrame: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.75)",
    borderRadius: 4,
    overflow: "hidden",
  },

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cancelBtn:  { paddingVertical: 6, paddingHorizontal: 8, minWidth: 72 },
  cancelTxt:  { color: "#fff", fontSize: 13 },
  topTitle:   { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600", textAlign: "center" },
  torchBtn:   { paddingVertical: 6, paddingHorizontal: 8, minWidth: 42, borderRadius: 8, alignItems: "center" },
  torchBtnOn: { backgroundColor: "rgba(253,224,71,0.22)" },
  torchIcon:  { fontSize: 18 },

  instructionWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 8 },
  instructionPill: {
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22,
  },
  instructionTxt:  { color: "#fff", fontSize: 12.5, textAlign: "center" },
  initPill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  initTxt: { color: "#D1FAE5", fontSize: 12 },

  bottomBar:   { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 10 },
  captureRing: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 3.5, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  captureRingDim: { borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.05)" },
  captureDisc:    { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },
  captureDiscDim: { backgroundColor: "rgba(255,255,255,0.5)" },
  captureLbl: {
    color: "#fff", fontSize: 12, letterSpacing: 0.3,
    textShadowColor: "#000", textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },

  processingBox: {
    flex: 1, backgroundColor: "#060612",
    alignItems: "center", justifyContent: "center",
    gap: 14, paddingHorizontal: 32,
  },
  processingTitle:  { color: "#fff", fontSize: 19, fontWeight: "700" },
  processingStep:   { color: "#9CA3AF", fontSize: 13.5, textAlign: "center" },
  processingHint:   { color: "#4B5563", fontSize: 11, textAlign: "center", marginTop: 4 },
  stepDots:         { flexDirection: "row", gap: 8, marginTop: 4 },
  stepDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: "#374151" },
  stepDotActive:    { backgroundColor: "#4ade80", width: 24, borderRadius: 4 },
  stepDotDone:      { backgroundColor: "#065F46" },
  cancelProcBtn:    { marginTop: 18, paddingVertical: 11, paddingHorizontal: 36, borderRadius: 10, borderWidth: 1, borderColor: "#374151" },
  cancelProcTxt:    { color: "#9CA3AF", fontSize: 13, textAlign: "center" },

  previewRoot:   { flex: 1, backgroundColor: "#060612" },
  previewHeader: {
    backgroundColor: "#1E3A5F",
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 12,
  },
  previewImgBox: { flex: 1, backgroundColor: "#111" },

  statusBadge: {
    backgroundColor: "#064E3B",
    marginHorizontal: 14, marginTop: 10, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 16, alignItems: "center",
  },
  statusBadgeWarn: { backgroundColor: "#78350F" },
  statusTxt: { color: "#34D399", fontSize: 12.5, fontWeight: "600", textAlign: "center" },

  previewActions: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 14, paddingTop: 12,
    alignItems: "center",
  },
  retakeBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#1F2937", alignItems: "center",
  },
  retakeTxt: { color: "#D1D5DB", fontSize: 13.5, fontWeight: "600" },

  adjustBtn: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: "#1E3A5F", alignItems: "center",
  },
  adjustTxt: { color: "#93C5FD", fontSize: 12.5, fontWeight: "600", textAlign: "center", lineHeight: 18 },

  useBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#065F46", alignItems: "center",
  },
  useTxt: { color: "#D1FAE5", fontSize: 13.5, fontWeight: "700", textAlign: "center", lineHeight: 18 },

  // Permission screen
  permRoot: {
    flex: 1, backgroundColor: "#0B1A2E",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 14,
  },
  permIcon:   { fontSize: 52 },
  permTitle:  { color: "#F9FAFB", fontSize: 20, fontWeight: "700", textAlign: "center" },
  permDesc:   { color: "#9CA3AF", fontSize: 14, textAlign: "center", lineHeight: 22 },
  permBtn:    {
    backgroundColor: "#1E40AF",
    paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: 12, minWidth: 220, alignItems: "center",
  },
  permBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
