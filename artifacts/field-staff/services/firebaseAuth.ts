import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  type ConfirmationResult,
  type Auth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const existingApps = getApps();
  const app = existingApps.length > 0 ? existingApps[0]! : initializeApp(firebaseConfig);
  if (Platform.OS === "web") {
    _auth = getAuth(app);
  } else {
    // React Native persistence via AsyncStorage
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnModule = require("@firebase/auth/react-native") as {
      getReactNativePersistence: (s: unknown) => import("firebase/auth").Persistence;
    };
    _auth = initializeAuth(app, {
      persistence: rnModule.getReactNativePersistence(AsyncStorage),
    });
  }
  return _auth!;
}

let _confirmationResult: ConfirmationResult | null = null;

export async function sendFirebaseOtp(phone: string): Promise<void> {
  const auth = getFirebaseAuth();
  const e164 = `+91${phone}`;

  if (Platform.OS === "web") {
    const { RecaptchaVerifier } = await import("firebase/auth");
    if (!(window as any).__recaptchaVerifier) {
      (window as any).__recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" },
      );
    }
    _confirmationResult = await signInWithPhoneNumber(
      auth,
      e164,
      (window as any).__recaptchaVerifier,
    );
  } else {
    throw new Error(
      "NATIVE_OTP: Use verificationId flow for native platforms.",
    );
  }
}

export async function confirmFirebaseOtp(otp: string): Promise<string> {
  if (!_confirmationResult) {
    throw new Error("No OTP was sent. Please request a new code.");
  }
  const result = await _confirmationResult.confirm(otp);
  return await result.user.getIdToken();
}

export function clearOtpState() {
  _confirmationResult = null;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    (window as any).__recaptchaVerifier = null;
  }
}
