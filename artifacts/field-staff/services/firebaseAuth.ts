import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type Auth,
} from "firebase/auth";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env["EXPO_PUBLIC_FIREBASE_API_KEY"],
  authDomain: process.env["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"],
  projectId: process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"],
  storageBucket: process.env["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"],
  messagingSenderId: process.env["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"],
  appId: process.env["EXPO_PUBLIC_FIREBASE_APP_ID"],
};

let _auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  const apps = getApps();
  const app = apps.length > 0 ? apps[0]! : initializeApp(firebaseConfig);
  _auth = getAuth(app);
  return _auth;
}

let _confirmationResult: ConfirmationResult | null = null;

export async function sendFirebaseOtp(phone: string): Promise<void> {
  if (Platform.OS !== "web") {
    throw new Error(
      "OTP verification requires the web version of this app. Please open it in a browser.",
    );
  }

  const auth = getFirebaseAuth();
  const { RecaptchaVerifier } = await import("firebase/auth");

  // Clear any stale reCAPTCHA instance before creating a new one
  if ((window as any).__recaptchaVerifier) {
    try {
      (window as any).__recaptchaVerifier.clear();
    } catch {
      // ignore
    }
    (window as any).__recaptchaVerifier = null;
  }

  (window as any).__recaptchaVerifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container",
    { size: "invisible" },
  );

  _confirmationResult = await signInWithPhoneNumber(
    auth,
    `+91${phone}`,
    (window as any).__recaptchaVerifier,
  );
}

export async function confirmFirebaseOtp(otp: string): Promise<string> {
  if (!_confirmationResult) {
    throw new Error("No OTP was sent. Please request a new code.");
  }
  const result = await _confirmationResult.confirm(otp);
  return await result.user.getIdToken();
}

export function clearOtpState(): void {
  _confirmationResult = null;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if ((window as any).__recaptchaVerifier) {
      try {
        (window as any).__recaptchaVerifier.clear();
      } catch {
        // ignore
      }
      (window as any).__recaptchaVerifier = null;
    }
  }
}
