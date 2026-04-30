import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithPhoneNumber,
  signInWithCredential,
  PhoneAuthProvider,
  type ConfirmationResult,
  type Auth,
  type ApplicationVerifier,
} from "firebase/auth";
import { Platform } from "react-native";

export const firebaseConfig = {
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

// Web flow: stores the ConfirmationResult from signInWithPhoneNumber
let _confirmationResult: ConfirmationResult | null = null;
// Native flow: stores the verificationId from PhoneAuthProvider.verifyPhoneNumber
let _verificationId: string | null = null;

/**
 * Send OTP.
 * - Web: uses invisible RecaptchaVerifier (recaptcha-container div must be in DOM)
 * - Native: uses expo-firebase-recaptcha verifier modal ref passed from the component
 */
export async function sendFirebaseOtp(
  phone: string,
  verifier?: ApplicationVerifier,
): Promise<void> {
  const auth = getFirebaseAuth();

  if (Platform.OS === "web") {
    const { RecaptchaVerifier } = await import("firebase/auth");

    // Clear any stale reCAPTCHA before creating a new one
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
    _verificationId = null;
  } else {
    // Native — requires the FirebaseRecaptchaVerifierModal ref from expo-firebase-recaptcha
    if (!verifier) {
      throw new Error(
        "reCAPTCHA verifier not ready. Please wait a moment and try again.",
      );
    }
    const phoneProvider = new PhoneAuthProvider(auth);
    _verificationId = await phoneProvider.verifyPhoneNumber(`+91${phone}`, verifier);
    _confirmationResult = null;
  }
}

/**
 * Confirm OTP code.
 * Returns the Firebase ID token on success.
 */
export async function confirmFirebaseOtp(otp: string): Promise<string> {
  const auth = getFirebaseAuth();

  if (_confirmationResult) {
    // Web flow
    const result = await _confirmationResult.confirm(otp);
    return await result.user.getIdToken();
  }

  if (_verificationId) {
    // Native flow
    const credential = PhoneAuthProvider.credential(_verificationId, otp);
    const result = await signInWithCredential(auth, credential);
    return await result.user.getIdToken();
  }

  throw new Error("No OTP was sent. Please request a new OTP.");
}

export function clearOtpState(): void {
  _confirmationResult = null;
  _verificationId = null;
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
