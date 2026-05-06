import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Lang = "en" | "hi";

// ─── All app strings ─────────────────────────────────────────────────────────
const strings = {
  en: {
    // Welcome
    developedBy: "Developed by Anil Yadav",
    welcomeTitle: "Welcome to the Skill Center Management System",
    welcomeSub: "Please log in or register your account.",
    login: "Login",
    register: "Register",
    registerAdmin: "Register as Admin",
    registerAdminSub: "Manage your team, view live map & activity feed",
    registerStaff: "Register as Mobilizer",
    registerStaffSub: "Register candidates & track field activities",
    alreadyRegistered: "Already registered? Sign in",
    demoHint: "Demo: use 9999999999 (admin) or 9876543210 (staff). Login with your 4-digit MPIN.",

    // Auth
    enterPhone: "Enter your mobile number",
    phonePlaceholder: "10-digit mobile number",
    sendOtp: "Send OTP",
    sending: "Sending…",
    enterOtp: "Enter OTP",
    otpSentTo: "OTP sent to",
    verify: "Verify & Sign In",
    verifying: "Verifying…",
    resendOtp: "Resend OTP",
    back: "Back",

    // Language
    language: "Language",
    english: "English",
    hindi: "हिंदी",

    // Profile / Settings
    accountSettings: "Account Settings",
    changePassword: "Change Password",
    changeName: "Change Display Name",
    currentPassword: "Current Password / PIN",
    newPassword: "New Password / PIN",
    confirmPassword: "Confirm Password / PIN",
    saveChanges: "Save Changes",
    saving: "Saving…",
    passwordChanged: "Password updated successfully.",
    passwordMismatch: "New password and confirmation do not match.",
    passwordTooShort: "Password must be at least 4 characters.",
    wrongPassword: "Current password is incorrect.",
    setPasswordFirst: "Set a password for your account",
    noPasswordSet: "No password set yet. Set one for extra security.",
    displayName: "Display Name",
    phone: "Phone",
    role: "Role",
    empCode: "Employee Code",
    signOut: "Sign Out",
    profile: "Profile",
    settings: "Settings",

    // Nav
    dashboard: "Dashboard",
    shift: "Shift",
    attendance: "Attendance",
    trips: "Trips",
    meter: "Meter",
    candidates: "Candidates",
    reports: "Reports",
    map: "Map",
    notifications: "Notifications",

    // Common
    cancel: "Cancel",
    confirm: "Confirm",
    ok: "OK",
    error: "Error",
    success: "Success",
    loading: "Loading…",
    required: "Required",
    optional: "Optional",
    or: "OR",

    // Documents
    myDocuments: "My Documents",
    myDocumentsSub: "Upload Aadhaar, certificates and other identity proofs",
    uploadDocument: "Upload Document",
    docTypeAadhaar: "Aadhaar Card",
    docTypeCertificate: "Certificate",
    docTypePhoto: "Photo",
    docTypeOther: "Other",
    docLabel: "Document Name",
    docLabelPlaceholder: "e.g. Aadhaar Front, Degree Certificate",
    selectDocType: "Select document type",
    chooseImage: "Choose from Gallery",
    takePhoto: "Take Photo",
    uploading: "Uploading…",
    uploadSuccess: "Document uploaded successfully.",
    uploadError: "Failed to upload document. Please try again.",
    noDocuments: "No documents uploaded yet.",
    deleteDoc: "Delete",
    confirmDeleteDoc: "Delete this document?",
    docUploadedOn: "Uploaded on",
  },
  hi: {
    // Welcome
    developedBy: "Developed by Anil Yadav",
    welcomeTitle: "स्किल सेंटर मैनेजमेंट सिस्टम में आपका स्वागत है",
    welcomeSub: "कृपया लॉगिन करें या अपना खाता पंजीकृत करें।",
    login: "लॉगिन",
    register: "रजिस्टर",
    registerAdmin: "एडमिन के रूप में रजिस्टर करें",
    registerAdminSub: "अपनी टीम प्रबंधित करें, लाइव मैप देखें",
    registerStaff: "मोबिलाइज़र के रूप में रजिस्टर करें",
    registerStaffSub: "उम्मीदवार पंजीकृत करें और क्षेत्र गतिविधियाँ ट्रैक करें",
    alreadyRegistered: "पहले से पंजीकृत हैं? लॉगिन करें",
    demoHint: "डेमो: 9999999999 (एडमिन) या 9876543210 (स्टाफ) उपयोग करें। 4-अंक MPIN से लॉगिन करें।",

    // Auth
    enterPhone: "अपना मोबाइल नंबर दर्ज करें",
    phonePlaceholder: "10 अंकों का मोबाइल नंबर",
    sendOtp: "OTP भेजें",
    sending: "भेज रहे हैं…",
    enterOtp: "OTP दर्ज करें",
    otpSentTo: "OTP भेजा गया",
    verify: "सत्यापित करें और लॉगिन करें",
    verifying: "सत्यापित हो रहा है…",
    resendOtp: "OTP पुनः भेजें",
    back: "वापस",

    // Language
    language: "भाषा",
    english: "English",
    hindi: "हिंदी",

    // Profile / Settings
    accountSettings: "खाता सेटिंग",
    changePassword: "पासवर्ड बदलें",
    changeName: "नाम बदलें",
    currentPassword: "वर्तमान पासवर्ड / PIN",
    newPassword: "नया पासवर्ड / PIN",
    confirmPassword: "पासवर्ड की पुष्टि करें",
    saveChanges: "बदलाव सहेजें",
    saving: "सहेज रहे हैं…",
    passwordChanged: "पासवर्ड सफलतापूर्वक अपडेट हो गया।",
    passwordMismatch: "नया पासवर्ड और पुष्टि मेल नहीं खाती।",
    passwordTooShort: "पासवर्ड कम से कम 4 अक्षर का होना चाहिए।",
    wrongPassword: "वर्तमान पासवर्ड गलत है।",
    setPasswordFirst: "अपने खाते के लिए पासवर्ड सेट करें",
    noPasswordSet: "अभी तक कोई पासवर्ड सेट नहीं। अतिरिक्त सुरक्षा के लिए एक सेट करें।",
    displayName: "प्रदर्शन नाम",
    phone: "फ़ोन",
    role: "भूमिका",
    empCode: "कर्मचारी कोड",
    signOut: "साइन आउट",
    profile: "प्रोफाइल",
    settings: "सेटिंग",

    // Nav
    dashboard: "डैशबोर्ड",
    shift: "शिफ्ट",
    attendance: "उपस्थिति",
    trips: "यात्राएँ",
    meter: "मीटर",
    candidates: "उम्मीदवार",
    reports: "रिपोर्ट",
    map: "मानचित्र",
    notifications: "सूचनाएँ",

    // Common
    cancel: "रद्द करें",
    confirm: "पुष्टि करें",
    ok: "ठीक है",
    error: "त्रुटि",
    success: "सफलता",
    loading: "लोड हो रहा है…",
    required: "आवश्यक",
    optional: "वैकल्पिक",
    or: "या",

    // Documents
    myDocuments: "मेरे दस्तावेज़",
    myDocumentsSub: "आधार, प्रमाण-पत्र और अन्य पहचान पत्र अपलोड करें",
    uploadDocument: "दस्तावेज़ अपलोड करें",
    docTypeAadhaar: "आधार कार्ड",
    docTypeCertificate: "प्रमाण-पत्र",
    docTypePhoto: "फोटो",
    docTypeOther: "अन्य",
    docLabel: "दस्तावेज़ का नाम",
    docLabelPlaceholder: "जैसे: आधार फ्रंट, डिग्री सर्टिफिकेट",
    selectDocType: "दस्तावेज़ प्रकार चुनें",
    chooseImage: "गैलरी से चुनें",
    takePhoto: "फोटो खींचें",
    uploading: "अपलोड हो रहा है…",
    uploadSuccess: "दस्तावेज़ सफलतापूर्वक अपलोड हो गया।",
    uploadError: "दस्तावेज़ अपलोड नहीं हो सका। पुनः प्रयास करें।",
    noDocuments: "अभी तक कोई दस्तावेज़ अपलोड नहीं हुआ।",
    deleteDoc: "हटाएँ",
    confirmDeleteDoc: "इस दस्तावेज़ को हटाएँ?",
    docUploadedOn: "अपलोड किया",
  },
};

export type StringKey = keyof typeof strings.en;

// ─── Context ──────────────────────────────────────────────────────────────────
type LanguageContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANG_KEY = "@field-staff/language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v === "hi" || v === "en") setLangState(v);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback(
    (key: StringKey): string => strings[lang][key] ?? strings.en[key] ?? key,
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
