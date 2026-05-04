/**
 * DocProcessorBridge
 *
 * Hidden 1×1 WebView that runs the document image-processing pipeline.
 * Exposes an imperative handle with processImage() returning a Promise.
 *
 * Communication:
 *   RN → WebView : webViewRef.postMessage(JSON string)
 *   WebView → RN : onMessage callback (window.ReactNativeWebView.postMessage)
 */

import React, { useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { DOC_PROCESSOR_HTML } from "./docProcessorHtml";

// ─── Public types ─────────────────────────────────────────────────────────────

export type DocType =
  | "aadhaar_front"
  | "aadhaar_back"
  | "bank_passbook"
  | "education_cert"
  | "caste_cert"
  | "other"
  | "card"   // backward-compat alias (same dims as aadhaar_*)
  | "page";  // backward-compat alias (A4)

export interface DocPoint { x: number; y: number }

export interface ProcessOptions {
  docType:        DocType;
  guideCorners?:  DocPoint[];   // fallback if auto-detect fails
  enhance?:       boolean;      // default true
  brightness?:    number;       // 0..2, default 1.08
  contrast?:      number;       // 0..2, default 1.12
  sharpness?:     number;       // 0..2, default 1.35
}

export interface ProcessResult {
  imageDataUri:  string;        // full data:image/jpeg;base64,… URI
  autoDetected:  boolean;       // true if edges were detected
  corners?:      DocPoint[];    // used corners (detected or guide)
}

export interface DocProcessorHandle {
  processImage(base64OrDataUri: string, opts: ProcessOptions): Promise<ProcessResult>;
  isReady(): boolean;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

interface PendingEntry {
  resolve: (r: ProcessResult) => void;
  reject:  (e: Error)         => void;
  timer:   ReturnType<typeof setTimeout>;
}

const TIMEOUT_MS = 45_000;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onReady?: () => void;
}

const DocProcessorBridge = React.forwardRef<DocProcessorHandle, Props>(
  function DocProcessorBridge({ onReady }, ref) {
    const wvRef        = useRef<WebView>(null);
    const readyRef     = useRef(false);
    const readyWaiters = useRef<Array<{ resolve: () => void; reject: (e: Error) => void }>>([]);
    const pending      = useRef<Map<string, PendingEntry>>(new Map());

    // Wait until the WebView has posted its 'ready' message
    const waitReady = useCallback(
      () =>
        new Promise<void>((resolve, reject) => {
          if (readyRef.current) { resolve(); return; }
          readyWaiters.current.push({ resolve, reject });
        }),
      [],
    );

    const processImage = useCallback(
      async (base64OrDataUri: string, opts: ProcessOptions): Promise<ProcessResult> => {
        await waitReady();

        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        return new Promise<ProcessResult>((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.current.delete(id);
            reject(new Error("DocProcessor: timeout after 45s"));
          }, TIMEOUT_MS);

          pending.current.set(id, { resolve, reject, timer });

          const msg = JSON.stringify({
            id,
            action:       "process",
            imageBase64:  base64OrDataUri,
            docType:      opts.docType,
            guideCorners: opts.guideCorners,
            enhance:      opts.enhance    ?? true,
            brightness:   opts.brightness ?? 1.08,
            contrast:     opts.contrast   ?? 1.12,
            sharpness:    opts.sharpness  ?? 1.35,
          });

          wvRef.current?.postMessage(msg);
        });
      },
      [waitReady],
    );

    useImperativeHandle(
      ref,
      () => ({
        processImage,
        isReady: () => readyRef.current,
      }),
      [processImage],
    );

    const handleMessage = useCallback(
      (e: { nativeEvent: { data: string } }) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(e.nativeEvent.data) as Record<string, unknown>; }
        catch { return; }

        // ── Ready signal ─────────────────────────────────────────────────────
        if (msg.type === "ready") {
          readyRef.current = true;
          readyWaiters.current.forEach((w) => w.resolve());
          readyWaiters.current = [];
          onReady?.();
          return;
        }

        if (msg.type === "pong") return;

        const id = msg.id as string | undefined;
        if (!id) return;
        const entry = pending.current.get(id);
        if (!entry) return;
        clearTimeout(entry.timer);
        pending.current.delete(id);

        if (msg.type === "processed") {
          entry.resolve({
            imageDataUri: msg.imageDataUri as string,
            autoDetected: msg.autoDetected as boolean,
            corners:      msg.corners as DocPoint[] | undefined,
          });
        } else {
          entry.reject(new Error((msg.error as string) || "Processing failed"));
        }
      },
      [onReady],
    );

    // Cleanup on unmount: reject all in-flight and waiting operations
    useEffect(() => {
      return () => {
        const unmountErr = new Error("DocProcessorBridge unmounted");
        pending.current.forEach(({ timer, reject }) => {
          clearTimeout(timer);
          reject(unmountErr);
        });
        pending.current.clear();
        // Also reject any callers still waiting for the bridge to be ready
        readyWaiters.current.forEach((w) => w.reject(unmountErr));
        readyWaiters.current = [];
      };
    }, []);

    return (
      <View style={styles.hidden}>
        <WebView
          ref={wvRef}
          source={{ html: DOC_PROCESSOR_HTML }}
          onMessage={handleMessage}
          javaScriptEnabled
          originWhitelist={["*"]}
          scrollEnabled={false}
          domStorageEnabled={false}
          mixedContentMode="always"
        />
      </View>
    );
  },
);

export default DocProcessorBridge;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hidden: {
    position:   "absolute",
    width:      10,
    height:     10,
    overflow:   "hidden",
    opacity:    0,
  },
});
