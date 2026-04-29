import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as Network from "expo-network";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";

// ─── Constants ──────────────────────────────────────────────────────────────

type ImageData = { uri: string; base64: string; mimeType: string };
type SubmittedDto = { id: string; name: string; phone: string; status: string; pdfUrl?: string | null };

// ─── Multi-draft store ────────────────────────────────────────────────────────
const DRAFTS_STORE_KEY = "@candidate-drafts-v1";

type CandidateDraft = {
  id: string;
  savedAt: string;
  pendingSync: boolean;
  // text / radio fields
  name: string; phone: string; email: string;
  fatherName: string; motherName: string; dob: string;
  gender: string | null; maritalStatus: string | null;
  religion: string | null; caste: string | null;
  pwd: string | null; disabilityType: string;
  address: string; village: string; policeStation: string;
  postOffice: string; district: string; state: string; pin: string; area: string;
  course: string; skillCentreName: string; aadhaarNumber: string;
  bpl: string | null; bplNumber: string;
  education: string | null; yearOfPassing: string;
  bankAccount: string; bankName: string; bankBranch: string; ifsc: string;
  mobilizer: string;
  // images
  photo: ImageData | null;
  aadhaarFront: ImageData | null;
  aadhaarBack: ImageData | null;
  educationCert: ImageData | null;
  bankPassbook: ImageData | null;
  casteCert: ImageData | null;
  signature: ImageData | null;
};

async function loadAllDrafts(): Promise<CandidateDraft[]> {
  try {
    const s = await AsyncStorage.getItem(DRAFTS_STORE_KEY);
    return s ? (JSON.parse(s) as CandidateDraft[]) : [];
  } catch { return []; }
}

async function upsertDraft(draft: CandidateDraft): Promise<void> {
  const all = await loadAllDrafts();
  const idx = all.findIndex((d) => d.id === draft.id);
  if (idx >= 0) all[idx] = draft;
  else all.unshift(draft);
  await AsyncStorage.setItem(DRAFTS_STORE_KEY, JSON.stringify(all));
}

async function removeDraftById(id: string): Promise<void> {
  const all = await loadAllDrafts();
  await AsyncStorage.setItem(DRAFTS_STORE_KEY, JSON.stringify(all.filter((d) => d.id !== id)));
}

function makeDraftId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const FORM_BG = "#FFFDF6";
const BORDER = "#1a1a1a";
const HEADER_BG = "#1E3A5F";
const SECTION_BG = "#1E3A5F";
const LABEL_COLOR = "#444";
const VALUE_COLOR = "#111";
const MUTED = "#888";
const ERROR_RED = "#D32F2F";
const SUCCESS_GREEN = "#1B5E20";
const ACCENT = "#1E3A5F";

const GENDERS = ["Male", "Female", "Other"] as const;
const MARITAL = ["Single", "Married", "Divorced", "Widowed"] as const;
const CASTES = ["General", "OBC", "SC", "ST"] as const;
const RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other"] as const;
const EDUCATIONS = ["Class 5", "Class 8", "Class 10", "Class 12", "Diploma", "Graduate", "Post-Graduate"] as const;
const PWD_OPTIONS = ["No", "Yes"] as const;
const BPL_OPTIONS = ["No", "Yes"] as const;

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

function formatRelTime(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

async function pickImage(setter: (img: ImageData | null) => void): Promise<void> {
  if (Platform.OS !== "web") {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Please allow photo library access.");
      return;
    }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"] as ImagePicker.MediaType[],
    base64: true,
    quality: 0.65,
    allowsEditing: false,
  });
  if (!result.canceled && result.assets[0]) {
    const a = result.assets[0];
    const MAX_BYTES = 5 * 1024 * 1024;
    if (a.fileSize && a.fileSize > MAX_BYTES) {
      Alert.alert("File Too Large", "Please select an image smaller than 5 MB.");
      return;
    }
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const mime = (a.mimeType ?? "image/jpeg").toLowerCase();
    if (!allowedMimes.includes(mime)) {
      Alert.alert("Invalid File Type", "Only JPEG, PNG, and WebP images are accepted.");
      return;
    }
    setter({ uri: a.uri, base64: a.base64 ?? "", mimeType: mime });
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FormHeader() {
  return (
    <View style={styles.formHeader}>
      <View style={styles.formHeaderInner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orgTitle}>JHARKHAND SKILL DEVELOPMENT MISSION SOCIETY</Text>
          <Text style={styles.orgSub}>Deen Dayal Upadhyay Grameen Kaushalya Yojana (DDU-GKY)</Text>
          <Text style={styles.orgSub}>Deen Dayal Upadhyay Kaushal Kendra (DDUKK)</Text>
          <View style={styles.hRule} />
          <Text style={styles.formTitle}>STUDENT / CANDIDATE REGISTRATION FORM</Text>
          <Text style={styles.formTitleHindi}>छात्र / अभ्यर्थी पंजीकरण फॉर्म</Text>
        </View>
      </View>
    </View>
  );
}

function SectionBand({ title, onToggle, expanded }: { title: string; onToggle: () => void; expanded: boolean }) {
  return (
    <Pressable onPress={onToggle} style={styles.sectionBand}>
      <Text style={styles.sectionBandText}>{title}</Text>
      <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color="#fff" />
    </Pressable>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required ? <Text style={{ color: ERROR_RED }}> *</Text> : null}
    </Text>
  );
}

function TextBox({
  label, value, onChangeText, placeholder, keyboardType = "default", required, multiline, error,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: "default" | "numeric" | "phone-pad" | "email-address";
  required?: boolean; multiline?: boolean; error?: string;
}) {
  return (
    <View style={styles.fieldCell}>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ""}
        placeholderTextColor={MUTED}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.textBox, multiline && { height: 54, textAlignVertical: "top" }, error ? { borderColor: "#DC2626", borderWidth: 1.5 } : {}]}
      />
      {error ? <Text style={{ color: "#DC2626", fontSize: 11, marginTop: 3, fontFamily: "Inter_400Regular" }}>{error}</Text> : null}
    </View>
  );
}

function HalfRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.halfRow}>{children}</View>;
}

function HalfField({
  label, value, onChangeText, placeholder, keyboardType = "default", required, error,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: "default" | "numeric" | "phone-pad" | "email-address";
  required?: boolean; error?: string;
}) {
  return (
    <View style={styles.halfCell}>
      <FieldLabel label={label} required={required} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ""}
        placeholderTextColor={MUTED}
        keyboardType={keyboardType}
        style={[styles.textBox, error ? { borderColor: "#DC2626", borderWidth: 1.5 } : {}]}
      />
      {error ? <Text style={{ color: "#DC2626", fontSize: 11, marginTop: 3, fontFamily: "Inter_400Regular" }}>{error}</Text> : null}
    </View>
  );
}

function RadioRow({
  label, options, value, onSelect, required,
}: {
  label: string; options: readonly string[]; value: string | null;
  onSelect: (v: string) => void; required?: boolean;
}) {
  return (
    <View style={styles.fieldCell}>
      <FieldLabel label={label} required={required} />
      <View style={styles.radioRow}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable key={opt} onPress={() => onSelect(opt)} style={styles.radioItem}>
              <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={[styles.radioLabel, active && styles.radioLabelActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function HalfRadio({
  label, options, value, onSelect,
}: {
  label: string; options: readonly string[]; value: string | null; onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.halfCell}>
      <FieldLabel label={label} />
      <View style={styles.radioRow}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable key={opt} onPress={() => onSelect(opt)} style={styles.radioItem}>
              <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                {active ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={[styles.radioLabel, active && styles.radioLabelActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AadhaarInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = value.replace(/\D/g, "").padEnd(12, "").split("").slice(0, 12);
  const refs = useRef<Array<TextInput | null>>([]);

  function handleDigit(idx: number, char: string) {
    const clean = char.replace(/\D/g, "");
    if (clean.length === 0) {
      const arr = digits.map((d) => d || "");
      arr[idx] = "";
      onChange(arr.join("").trim());
      refs.current[idx - 1]?.focus();
    } else {
      const ch = clean[clean.length - 1] ?? "";
      const arr = digits.map((d) => d || "");
      arr[idx] = ch;
      onChange(arr.join("").trim());
      if (idx < 11) refs.current[idx + 1]?.focus();
    }
  }

  return (
    <View style={styles.fieldCell}>
      <FieldLabel label="Aadhaar Number / आधार नं." />
      <View style={styles.aadhaarRow}>
        {Array.from({ length: 12 }, (_, i) => (
          <React.Fragment key={i}>
            <TextInput
              ref={(r) => { refs.current[i] = r; }}
              value={digits[i] !== "" ? digits[i] : ""}
              onChangeText={(t) => handleDigit(i, t)}
              keyboardType="numeric"
              maxLength={1}
              style={styles.aadhaarBox}
              textAlign="center"
              selectTextOnFocus
            />
            {(i === 3 || i === 7) ? <View style={styles.aadhaarSep} /> : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function PhotoBox({ label, value, onPick, onClear }: {
  label: string; value: ImageData | null;
  onPick: () => void; onClear: () => void;
}) {
  if (value) {
    return (
      <View style={styles.photoBoxFilled}>
        <Image source={{ uri: value.uri }} style={styles.photoImg} resizeMode="cover" />
        <TouchableOpacity onPress={onClear} style={styles.photoClearBtn}>
          <Feather name="x" size={14} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.photoLabel}>{label}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity onPress={onPick} style={styles.photoBoxEmpty}>
      <View style={styles.photoIcon}>
        <Feather name="camera" size={24} color={MUTED} />
      </View>
      <Text style={styles.photoBoxLabel}>{label}</Text>
      <Text style={styles.photoBoxSub}>3.5 × 4.5 cm</Text>
      <Text style={styles.photoBoxTap}>Tap to upload</Text>
    </TouchableOpacity>
  );
}

function DocUploadCard({ label, value, onPick, onClear, checked }: {
  label: string; value: ImageData | null; onPick: () => void; onClear: () => void; checked?: boolean;
}) {
  return (
    <View style={[styles.docCard, value && styles.docCardDone]}>
      <View style={styles.docCheck}>
        {value || checked
          ? <Feather name="check-square" size={16} color={SUCCESS_GREEN} />
          : <Feather name="square" size={16} color={MUTED} />}
      </View>
      <Text style={[styles.docLabel, value && styles.docLabelDone]} numberOfLines={2}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value ? (
        <View style={styles.docRight}>
          <Image source={{ uri: value.uri }} style={styles.docThumb} />
          <TouchableOpacity onPress={onClear} style={styles.docClearBtn}>
            <Feather name="x-circle" size={16} color={ERROR_RED} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onPick} style={styles.docUploadBtn}>
          <Feather name="upload" size={13} color={ACCENT} />
          <Text style={styles.docUploadText}>Upload</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CandidateRegisterScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const { draftId: paramDraftId } = useLocalSearchParams<{ draftId?: string }>();

  // Collapsible section states
  const [secA, setSecA] = useState(true);
  const [secB, setSecB] = useState(true);
  const [secC, setSecC] = useState(true);
  const [secD, setSecD] = useState(true);
  const [secE, setSecE] = useState(true);
  const [secF, setSecF] = useState(true);
  const [secG, setSecG] = useState(true);

  // Form validation errors (shown inline under fields)
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) e.name = "पूरा नाम जरूरी है (न्यूनतम 2 अक्षर)";
    if (!phone.trim() || !/^\d{10}$/.test(phone.trim())) e.phone = "10 अंकों का मोबाइल नंबर जरूरी है";
    if (aadhaarNumber.replace(/\D/g, "").length > 0 && aadhaarNumber.replace(/\D/g, "").length !== 12) {
      e.aadhaarNumber = "आधार नंबर 12 अंकों का होना चाहिए";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = "Valid email address enter करें";
    }
    if (dob.trim() && !/^\d{2}\/\d{2}\/\d{4}$/.test(dob.trim())) {
      e.dob = "Format: DD/MM/YYYY";
    }
    if (pin.trim() && !/^\d{6}$/.test(pin.trim())) {
      e.pin = "PIN code 6 अंकों का होना चाहिए";
    }
    if (ifsc.trim() && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim())) {
      e.ifsc = "IFSC code सही नहीं है (जैसे: SBIN0001234)";
    }
    if (bankAccount.trim() && !/^\d{6,18}$/.test(bankAccount.trim())) {
      e.bankAccount = "Valid bank account number enter करें";
    }
    return e;
  }

  // ─ Personal
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [maritalStatus, setMaritalStatus] = useState<string | null>(null);
  const [religion, setReligion] = useState<string | null>(null);
  const [caste, setCaste] = useState<string | null>(null);
  const [pwd, setPwd] = useState<string | null>("No");
  const [disabilityType, setDisabilityType] = useState("");

  // ─ Address
  const [address, setAddress] = useState("");
  const [village, setVillage] = useState("");
  const [policeStation, setPoliceStation] = useState("");
  const [postOffice, setPostOffice] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("Jharkhand");
  const [pin, setPin] = useState("");
  const [area, setArea] = useState("");

  // ─ Course
  const [course, setCourse] = useState("");
  const [skillCentreName, setSkillCentreName] = useState("");

  // ─ Identity
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [bpl, setBpl] = useState<string | null>("No");
  const [bplNumber, setBplNumber] = useState("");

  // ─ Education
  const [education, setEducation] = useState<string | null>(null);
  const [yearOfPassing, setYearOfPassing] = useState("");

  // ─ Bank
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [ifsc, setIfsc] = useState("");

  // ─ Mobilizer
  const [mobilizer, setMobilizer] = useState(user?.name ?? "");

  // ─ Documents
  const [photo, setPhoto] = useState<ImageData | null>(null);
  const [aadhaarFront, setAadhaarFront] = useState<ImageData | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<ImageData | null>(null);
  const [educationCert, setEducationCert] = useState<ImageData | null>(null);
  const [bankPassbook, setBankPassbook] = useState<ImageData | null>(null);
  const [casteCert, setCasteCert] = useState<ImageData | null>(null);
  const [signature, setSignature] = useState<ImageData | null>(null);

  // ─ UI state
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedDto | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [approvalBlocked, setApprovalBlocked] = useState(false);
  const networkPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─ Draft state
  const [draftId] = useState<string>(() => makeDraftId());
  const activeDraftId = useRef<string>(draftId);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pendingSync, setPendingSync] = useState(false);
  const pendingSyncRef = useRef(false);
  const [draftCount, setDraftCount] = useState(0);
  const autoSyncTriggeredRef = useRef(false);

  // ── Draft helpers ───────────────────────────────────────────────────────────

  const buildDraft = useCallback((): CandidateDraft => ({
    id: activeDraftId.current,
    savedAt: new Date().toISOString(),
    pendingSync: pendingSyncRef.current,
    name, phone, email, fatherName, motherName, dob,
    gender, maritalStatus, religion, caste, pwd, disabilityType,
    address, village, policeStation, postOffice, district, state, pin, area,
    course, skillCentreName, aadhaarNumber, bpl, bplNumber,
    education, yearOfPassing, bankAccount, bankName, bankBranch, ifsc, mobilizer,
    photo, aadhaarFront, aadhaarBack, educationCert, bankPassbook, casteCert, signature,
  }), [name, phone, email, fatherName, motherName, dob, gender, maritalStatus,
    religion, caste, pwd, disabilityType, address, village, policeStation,
    postOffice, district, state, pin, area, course, skillCentreName,
    aadhaarNumber, bpl, bplNumber, education, yearOfPassing, bankAccount,
    bankName, bankBranch, ifsc, mobilizer,
    photo, aadhaarFront, aadhaarBack, educationCert, bankPassbook, casteCert, signature]);

  const restoreDraft = useCallback((d: CandidateDraft) => {
    activeDraftId.current = d.id;
    pendingSyncRef.current = d.pendingSync;
    setPendingSync(d.pendingSync);
    setName(d.name ?? ""); setPhone(d.phone ?? ""); setEmail(d.email ?? "");
    setFatherName(d.fatherName ?? ""); setMotherName(d.motherName ?? "");
    setDob(d.dob ?? ""); setGender(d.gender ?? null);
    setMaritalStatus(d.maritalStatus ?? null); setReligion(d.religion ?? null);
    setCaste(d.caste ?? null); setPwd(d.pwd ?? "No");
    setDisabilityType(d.disabilityType ?? "");
    setAddress(d.address ?? ""); setVillage(d.village ?? "");
    setPoliceStation(d.policeStation ?? ""); setPostOffice(d.postOffice ?? "");
    setDistrict(d.district ?? ""); setState(d.state ?? "Jharkhand");
    setPin(d.pin ?? ""); setArea(d.area ?? "");
    setCourse(d.course ?? ""); setSkillCentreName(d.skillCentreName ?? "");
    setAadhaarNumber(d.aadhaarNumber ?? ""); setBpl(d.bpl ?? "No");
    setBplNumber(d.bplNumber ?? "");
    setEducation(d.education ?? null); setYearOfPassing(d.yearOfPassing ?? "");
    setBankAccount(d.bankAccount ?? ""); setBankName(d.bankName ?? "");
    setBankBranch(d.bankBranch ?? ""); setIfsc(d.ifsc ?? "");
    setMobilizer(d.mobilizer ?? user?.name ?? "");
    setPhoto(d.photo ?? null);
    setAadhaarFront(d.aadhaarFront ?? null);
    setAadhaarBack(d.aadhaarBack ?? null);
    setEducationCert(d.educationCert ?? null);
    setBankPassbook(d.bankPassbook ?? null);
    setCasteCert(d.casteCert ?? null);
    setSignature(d.signature ?? null);
    setLastSavedAt(new Date(d.savedAt));
  }, [user?.name]);

  const saveDraftNow = useCallback(async (asPendingSync?: boolean) => {
    if (!name.trim() && !phone.trim()) return;
    setAutoSaveStatus("saving");
    const syncFlag = asPendingSync !== undefined ? asPendingSync : pendingSyncRef.current;
    if (asPendingSync !== undefined) {
      pendingSyncRef.current = syncFlag;
      setPendingSync(syncFlag);
    }
    const draft = buildDraft();
    draft.pendingSync = syncFlag;
    draft.savedAt = new Date().toISOString();
    await upsertDraft(draft);
    const all = await loadAllDrafts();
    setDraftCount(all.length);
    setLastSavedAt(new Date());
    setAutoSaveStatus("saved");
    setTimeout(() => setAutoSaveStatus("idle"), 2500);
  }, [buildDraft, name, phone]);

  const clearForm = useCallback(async () => {
    setName(""); setPhone(""); setEmail(""); setFatherName(""); setMotherName("");
    setDob(""); setGender(null); setMaritalStatus(null); setReligion(null);
    setCaste(null); setPwd("No"); setDisabilityType("");
    setAddress(""); setVillage(""); setPoliceStation(""); setPostOffice("");
    setDistrict(""); setState("Jharkhand"); setPin(""); setArea("");
    setCourse(""); setSkillCentreName(""); setAadhaarNumber("");
    setBpl("No"); setBplNumber(""); setEducation(null); setYearOfPassing("");
    setBankAccount(""); setBankName(""); setBankBranch(""); setIfsc("");
    setMobilizer(user?.name ?? "");
    setPhoto(null); setAadhaarFront(null); setAadhaarBack(null);
    setEducationCert(null); setBankPassbook(null); setCasteCert(null);
    setSignature(null);
    await removeDraftById(activeDraftId.current);
    activeDraftId.current = makeDraftId();
    setPendingSync(false); pendingSyncRef.current = false;
    setLastSavedAt(null); setAutoSaveStatus("idle");
    autoSyncTriggeredRef.current = false;
    const all = await loadAllDrafts();
    setDraftCount(all.length);
  }, [user?.name]);

  // ── Load draft from route param & count drafts ──────────────────────────────

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void (async () => {
      const s = await Network.getNetworkStateAsync();
      if (!cancelled) setIsOffline(!s.isConnected);
      const all = await loadAllDrafts();
      if (!cancelled) setDraftCount(all.length);
      if (paramDraftId) {
        const draft = all.find((d) => d.id === paramDraftId);
        if (draft && !cancelled) restoreDraft(draft);
      }
    })();
    return () => { cancelled = true; };
  }, [paramDraftId, restoreDraft]));

  // ── Network polling (while offline) ────────────────────────────────────────

  useEffect(() => {
    if (!isOffline) {
      if (networkPollRef.current) clearInterval(networkPollRef.current);
      return;
    }
    networkPollRef.current = setInterval(() => {
      void Network.getNetworkStateAsync().then((s) => { if (s.isConnected) setIsOffline(false); });
    }, 10_000);
    return () => { if (networkPollRef.current) clearInterval(networkPollRef.current); };
  }, [isOffline]);

  // ── Auto-save on text changes (debounced 3 s) ──────────────────────────────

  const textSnapshot = [
    name, phone, email, fatherName, motherName, dob, gender ?? "", maritalStatus ?? "",
    religion ?? "", caste ?? "", pwd ?? "", disabilityType, address, village,
    policeStation, postOffice, district, state, pin, area, course, skillCentreName,
    aadhaarNumber, bpl ?? "", bplNumber, education ?? "", yearOfPassing,
    bankAccount, bankName, bankBranch, ifsc, mobilizer,
  ].join("|");

  useEffect(() => {
    if (!name.trim() && !phone.trim()) return;
    const timer = setTimeout(() => { void saveDraftNow(); }, 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textSnapshot]);

  // ── Auto-save on image changes (immediate) ─────────────────────────────────

  useEffect(() => {
    if (!name.trim() && !phone.trim()) return;
    void saveDraftNow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, aadhaarFront, aadhaarBack, educationCert, bankPassbook, casteCert, signature]);

  // ── Save on app going to background (prevent data loss) ───────────────────

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if ((nextState === "background" || nextState === "inactive") && (name.trim() || phone.trim())) {
        void saveDraftNow();
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, saveDraftNow]);

  // ── Auto-sync when internet is restored ────────────────────────────────────

  const handleSubmitRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    if (!isOffline && pendingSync && !autoSyncTriggeredRef.current && !loading) {
      autoSyncTriggeredRef.current = true;
      const timer = setTimeout(() => {
        void handleSubmitRef.current?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
    if (isOffline) autoSyncTriggeredRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, pendingSync, loading]);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      if (validationErrors.name || validationErrors.phone || validationErrors.email || validationErrors.dob || validationErrors.aadhaarNumber) setSecA(true);
      if (validationErrors.pin) setSecC(true);
      if (validationErrors.ifsc || validationErrors.bankAccount) setSecF(true);
      Alert.alert("Form Incomplete", "Please correct the highlighted fields before submitting.");
      return;
    }
    setErrors({});

    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) {
      setIsOffline(true);
      await saveDraftNow(true);
      return;
    }

    const apiBase = getApiBase();
    // Duplicate check
    try {
      const dupRes = await fetch(`${apiBase}/api/candidates/check-duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), aadhaarNumber: aadhaarNumber.trim() || undefined }),
      });
      if (dupRes.ok) {
        const dup = await dupRes.json() as { isDuplicate: boolean; field?: string; existingName?: string };
        if (dup.isDuplicate) {
          await new Promise<void>((resolve, reject) => {
            Alert.alert(
              "Duplicate Found",
              `A candidate with this ${dup.field === "aadhaar" ? "Aadhaar" : "phone"} already exists (${dup.existingName ?? ""}). Continue?`,
              [
                { text: "Cancel", style: "cancel", onPress: () => reject(new Error("cancel")) },
                { text: "Continue", onPress: () => resolve() },
              ],
            );
          });
        }
      }
    } catch (e) {
      const err = e as Error;
      if (err.message === "cancel") return;
    }

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        fatherName: fatherName.trim() || null,
        motherName: motherName.trim() || null,
        dob: dob.trim() || null,
        gender: gender || null,
        maritalStatus: maritalStatus || null,
        religion: religion || null,
        address: address.trim() || null,
        village: village.trim() || null,
        policeStation: policeStation.trim() || null,
        postOffice: postOffice.trim() || null,
        district: district.trim() || null,
        state: state.trim() || null,
        pin: pin.trim() || null,
        area: area.trim() || null,
        course: course.trim() || null,
        skillCentreName: skillCentreName.trim() || null,
        aadhaarNumber: aadhaarNumber.trim() || null,
        education: education || null,
        yearOfPassing: yearOfPassing.trim() || null,
        caste: caste || null,
        pwd: pwd || null,
        disabilityType: pwd === "Yes" ? disabilityType.trim() || null : null,
        bpl: bpl || null,
        bplNumber: bpl === "Yes" ? bplNumber.trim() || null : null,
        bankAccount: bankAccount.trim() || null,
        bankName: bankName.trim() || null,
        bankBranch: bankBranch.trim() || null,
        ifsc: ifsc.trim() || null,
        mobilizer: mobilizer.trim() || null,
        submittedBy: user?.name ?? null,
        submittedByPhone: user?.phone ?? null,
        photoBase64: photo?.base64 ?? null,
        photoMime: photo?.mimeType ?? null,
        aadhaarFrontBase64: aadhaarFront?.base64 ?? null,
        aadhaarFrontMime: aadhaarFront?.mimeType ?? null,
        aadhaarBackBase64: aadhaarBack?.base64 ?? null,
        aadhaarBackMime: aadhaarBack?.mimeType ?? null,
        educationCertBase64: educationCert?.base64 ?? null,
        educationCertMime: educationCert?.mimeType ?? null,
        bankPassbookBase64: bankPassbook?.base64 ?? null,
        bankPassbookMime: bankPassbook?.mimeType ?? null,
        casteCertBase64: casteCert?.base64 ?? null,
        casteCertMime: casteCert?.mimeType ?? null,
        signatureBase64: signature?.base64 ?? null,
        signatureMime: signature?.mimeType ?? null,
      };

      const res = await fetch(`${apiBase}/api/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as SubmittedDto & { title?: string };
      if (res.status === 403) { setApprovalBlocked(true); return; }
      if (!res.ok) throw new Error(data.title ?? "Submission failed");
      await removeDraftById(activeDraftId.current);
      setPendingSync(false); pendingSyncRef.current = false;
      autoSyncTriggeredRef.current = false;
      const all = await loadAllDrafts();
      setDraftCount(all.length);
      setSubmitted(data);
    } catch (e) {
      Alert.alert("Submission Failed", (e as Error).message);
      autoSyncTriggeredRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  handleSubmitRef.current = handleSubmit;

  // ── Approval blocked screen ─────────────────────────────────────────────────

  if (approvalBlocked) {
    return (
      <View style={[styles.centeredScreen, { paddingTop: insets.top + webTop }]}>
        <View style={styles.blockedCard}>
          <Feather name="clock" size={40} color="#D97706" />
          <Text style={styles.blockedTitle}>Account Pending Approval</Text>
          <Text style={styles.blockedSub}>Your account needs admin approval before you can submit candidates.</Text>
          <Pressable onPress={() => router.back()} style={styles.blockedBtn}>
            <Text style={styles.blockedBtnText}>← Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <View style={[styles.centeredScreen, { paddingTop: insets.top + webTop }]}>
        <View style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <Feather name="check-circle" size={44} color={SUCCESS_GREEN} />
          </View>
          <Text style={styles.successTitle}>Registration Successful!</Text>
          <Text style={styles.successName}>{submitted.name}</Text>
          <Text style={styles.successPhone}>{submitted.phone}</Text>
          <Text style={styles.successId}>ID: {submitted.id.slice(0, 8).toUpperCase()}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Pending Admin Verification</Text>
          </View>
          {submitted.pdfUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(`${getApiBase()}${submitted.pdfUrl!}`)}
              style={({ pressed }) => [styles.pdfBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="download" size={18} color="#fff" />
              <Text style={styles.pdfBtnText}>Download Registration Form PDF</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void clearForm().then(() => setSubmitted(null))}
            style={({ pressed }) => [styles.anotherBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Feather name="user-plus" size={16} color={ACCENT} />
            <Text style={styles.anotherBtnText}>Register Another Candidate</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 8 }]}>
            <Text style={styles.backLink}>← Back to Dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Nav header */}
      <View style={[styles.navHeader, { paddingTop: insets.top + webTop }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.navTitle}>Candidate Registration</Text>
          {autoSaveStatus === "saving" && (
            <Text style={styles.autoSaveText}>Saving...</Text>
          )}
          {autoSaveStatus === "saved" && (
            <Text style={styles.autoSaveText}>✓ Draft saved</Text>
          )}
          {autoSaveStatus === "idle" && lastSavedAt && (
            <Text style={styles.autoSaveText}>Last saved {formatRelTime(lastSavedAt)}</Text>
          )}
        </View>
        <Pressable
          onPress={() => router.push("/candidate/drafts")}
          style={styles.draftsBtn}
          hitSlop={8}
        >
          <Feather name="folder" size={18} color="#fff" />
          {draftCount > 0 && (
            <View style={styles.draftsBadge}>
              <Text style={styles.draftsBadgeText}>{draftCount > 9 ? "9+" : draftCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Banners */}
      {isOffline && !pendingSync && (
        <View style={styles.offlineBanner}>
          <Feather name="wifi-off" size={14} color="#fff" />
          <Text style={styles.bannerText}>Offline — form auto-saves as draft</Text>
        </View>
      )}
      {isOffline && pendingSync && (
        <View style={[styles.offlineBanner, { backgroundColor: "#92400E" }]}>
          <Feather name="wifi-off" size={14} color="#fff" />
          <Text style={styles.bannerText}>Draft saved (offline) — will auto-submit when internet is available</Text>
        </View>
      )}
      {!isOffline && pendingSync && (
        <View style={[styles.draftBanner, { backgroundColor: "#D1FAE5", borderBottomColor: "#6EE7B7" }]}>
          <Feather name="wifi" size={14} color={SUCCESS_GREEN} />
          <Text style={[styles.draftBannerText, { color: SUCCESS_GREEN, flex: 1 }]}>
            {loading ? "Submitting saved draft..." : "Internet restored — submitting draft..."}
          </Text>
          {loading && <ActivityIndicator size="small" color={SUCCESS_GREEN} />}
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── FORM PAPER ─────────────────────────────────────────────── */}
        <View style={styles.paper}>

          {/* Form Header */}
          <FormHeader />

          {/* Course + Photo row */}
          <View style={[styles.borderRow, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <TextBox label="Course Name / कोर्स का नाम" value={course} onChangeText={setCourse} placeholder="e.g. Tailoring, Computer" />
              <TextBox label="Skill Centre Name / कौशल केंद्र नाम" value={skillCentreName} onChangeText={setSkillCentreName} />
            </View>
            <PhotoBox
              label="Passport Photo"
              value={photo}
              onPick={() => pickImage(setPhoto)}
              onClear={() => setPhoto(null)}
            />
          </View>

          {/* ── A. Personal ──────────────────────────────────────────── */}
          <SectionBand title="A.  PERSONAL DETAILS  /  व्यक्तिगत विवरण" onToggle={() => setSecA(!secA)} expanded={secA} />
          {secA && (
            <View style={styles.sectionBody}>
              <TextBox label="Candidate Name (English) / नाम (अंग्रेजी)*" value={name} onChangeText={(v) => { setName(v); if (errors.name) setErrors((prev) => ({ ...prev, name: "" })); }} required error={errors.name} />
              <HalfRow>
                <HalfField label="Father/Husband Name / पिता का नाम" value={fatherName} onChangeText={setFatherName} />
                <HalfField label="Mother's Name / माता का नाम" value={motherName} onChangeText={setMotherName} />
              </HalfRow>
              <HalfRow>
                <HalfField label="Date of Birth / जन्म तिथि (DD/MM/YYYY)" value={dob} onChangeText={(v) => { setDob(v); if (errors.dob) setErrors((prev) => ({ ...prev, dob: "" })); }} placeholder="DD/MM/YYYY" error={errors.dob} />
                <HalfField label="Mobile No. / मोबाइल नं.*" value={phone} onChangeText={(v) => { setPhone(v); if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" })); }} keyboardType="phone-pad" required error={errors.phone} />
              </HalfRow>
              <HalfRow>
                <HalfRadio label="Marital Status / वैवाहिक स्थिति" options={MARITAL} value={maritalStatus} onSelect={setMaritalStatus} />
                <HalfRadio label="Sex / लिंग" options={GENDERS} value={gender} onSelect={setGender} />
              </HalfRow>
              <HalfRow>
                <HalfField label="Email / ईमेल" value={email} onChangeText={(v) => { setEmail(v); if (errors.email) setErrors((prev) => ({ ...prev, email: "" })); }} keyboardType="email-address" error={errors.email} />
                <HalfField label="Religion / धर्म" value={religion ?? ""} onChangeText={(v) => setReligion(v || null)} />
              </HalfRow>
              <RadioRow label="Category / वर्ग" options={CASTES} value={caste} onSelect={setCaste} />
              <HalfRow>
                <HalfRadio label="PwD / दिव्यांग" options={PWD_OPTIONS} value={pwd} onSelect={setPwd} />
                {pwd === "Yes"
                  ? <HalfField label="Disability Type / प्रकार" value={disabilityType} onChangeText={setDisabilityType} />
                  : <View style={styles.halfCell} />}
              </HalfRow>
            </View>
          )}

          {/* ── B. Address ───────────────────────────────────────────── */}
          <SectionBand title="B.  ADDRESS  /  पता" onToggle={() => setSecB(!secB)} expanded={secB} />
          {secB && (
            <View style={styles.sectionBody}>
              <TextBox label="Address / पता (House No., Street, Locality)" value={address} onChangeText={setAddress} multiline />
              <HalfRow>
                <HalfField label="Village / Town / ग्राम / नगर" value={village} onChangeText={setVillage} />
                <HalfField label="Police Station / थाना" value={policeStation} onChangeText={setPoliceStation} />
              </HalfRow>
              <HalfRow>
                <HalfField label="Post Office / डाकघर" value={postOffice} onChangeText={setPostOffice} />
                <HalfField label="District / जिला" value={district} onChangeText={setDistrict} />
              </HalfRow>
              <HalfRow>
                <HalfField label="State / राज्य" value={state} onChangeText={setState} />
                <HalfField label="PIN Code / पिन कोड" value={pin} onChangeText={(v) => { setPin(v); if (errors.pin) setErrors((prev) => ({ ...prev, pin: "" })); }} keyboardType="numeric" error={errors.pin} />
              </HalfRow>
            </View>
          )}

          {/* ── C. Aadhaar ───────────────────────────────────────────── */}
          <SectionBand title="C.  AADHAAR & IDENTITY  /  आधार और पहचान" onToggle={() => setSecC(!secC)} expanded={secC} />
          {secC && (
            <View style={styles.sectionBody}>
              <AadhaarInput value={aadhaarNumber} onChange={(v) => { setAadhaarNumber(v); if (errors.aadhaarNumber) setErrors((prev) => ({ ...prev, aadhaarNumber: "" })); }} />
              {errors.aadhaarNumber ? <Text style={{ color: "#DC2626", fontSize: 11, marginTop: 3, marginHorizontal: 12, fontFamily: "Inter_400Regular" }}>{errors.aadhaarNumber}</Text> : null}
              <HalfRow>
                <HalfRadio label="BPL / गरीबी रेखा से नीचे" options={BPL_OPTIONS} value={bpl} onSelect={setBpl} />
                {bpl === "Yes"
                  ? <HalfField label="BPL Card No. / बीपीएल कार्ड नं." value={bplNumber} onChangeText={setBplNumber} />
                  : <View style={styles.halfCell} />}
              </HalfRow>
            </View>
          )}

          {/* ── D. Education ─────────────────────────────────────────── */}
          <SectionBand title="D.  EDUCATIONAL DETAILS  /  शैक्षणिक विवरण" onToggle={() => setSecD(!secD)} expanded={secD} />
          {secD && (
            <View style={styles.sectionBody}>
              <RadioRow label="Highest Qualification / उच्चतम योग्यता" options={EDUCATIONS} value={education} onSelect={setEducation} />
              <HalfField label="Year of Passing / उत्तीर्ण वर्ष" value={yearOfPassing} onChangeText={setYearOfPassing} keyboardType="numeric" placeholder="e.g. 2018" />
            </View>
          )}

          {/* ── E. Bank ──────────────────────────────────────────────── */}
          <SectionBand title="E.  BANK DETAILS  /  बैंक विवरण" onToggle={() => setSecE(!secE)} expanded={secE} />
          {secE && (
            <View style={styles.sectionBody}>
              <HalfRow>
                <HalfField label="Bank Account No. / बैंक खाता नं." value={bankAccount} onChangeText={(v) => { setBankAccount(v); if (errors.bankAccount) setErrors((prev) => ({ ...prev, bankAccount: "" })); }} keyboardType="numeric" error={errors.bankAccount} />
                <HalfField label="Bank Name / बैंक का नाम" value={bankName} onChangeText={setBankName} />
              </HalfRow>
              <HalfRow>
                <HalfField label="IFSC Code" value={ifsc} onChangeText={(v) => { setIfsc(v.toUpperCase()); if (errors.ifsc) setErrors((prev) => ({ ...prev, ifsc: "" })); }} error={errors.ifsc} />
                <HalfField label="Branch Name / शाखा नाम" value={bankBranch} onChangeText={setBankBranch} />
              </HalfRow>
            </View>
          )}

          {/* ── F. Documents ─────────────────────────────────────────── */}
          <SectionBand title="F.  DOCUMENTS  /  दस्तावेज अपलोड करें" onToggle={() => setSecF(!secF)} expanded={secF} />
          {secF && (
            <View style={styles.sectionBody}>
              <Text style={styles.docInstructions}>Upload photos/scans of the following documents:</Text>
              <DocUploadCard label="Aadhaar Card Front / आधार कार्ड (आगे)" value={aadhaarFront} onPick={() => pickImage(setAadhaarFront)} onClear={() => setAadhaarFront(null)} />
              <DocUploadCard label="Aadhaar Card Back / आधार कार्ड (पीछे)" value={aadhaarBack} onPick={() => pickImage(setAadhaarBack)} onClear={() => setAadhaarBack(null)} />
              <DocUploadCard label="Education Certificate / शैक्षणिक प्रमाण पत्र" value={educationCert} onPick={() => pickImage(setEducationCert)} onClear={() => setEducationCert(null)} />
              <DocUploadCard label="Bank Passbook / बैंक पासबुक" value={bankPassbook} onPick={() => pickImage(setBankPassbook)} onClear={() => setBankPassbook(null)} />
              <DocUploadCard label="Caste Certificate / जाति प्रमाण पत्र" value={casteCert} onPick={() => pickImage(setCasteCert)} onClear={() => setCasteCert(null)} />
            </View>
          )}

          {/* ── G. Declaration & Signature ───────────────────────────── */}
          <SectionBand title="G.  DECLARATION & SIGNATURE  /  घोषणा" onToggle={() => setSecG(!secG)} expanded={secG} />
          {secG && (
            <View style={styles.sectionBody}>
              <View style={styles.declarationBox}>
                <Text style={styles.declarationText}>
                  I hereby declare that the information given above is true and correct to the best of my knowledge and belief.
                </Text>
                <Text style={styles.declarationHindi}>
                  मैं घोषणा करता/करती हूँ कि उपरोक्त जानकारी मेरी जानकारी एवं विश्वास के अनुसार सत्य और सही है।
                </Text>
              </View>

              <HalfRow>
                <HalfField label="Place / स्थान" value={area} onChangeText={setArea} />
                <View style={styles.halfCell}>
                  <Text style={styles.fieldLabel}>Date / दिनांक</Text>
                  <View style={[styles.textBox, styles.dateDisplay]}>
                    <Text style={{ color: MUTED, fontSize: 13 }}>
                      {new Date().toLocaleDateString("en-IN")}
                    </Text>
                  </View>
                </View>
              </HalfRow>

              <View style={styles.fieldCell}>
                <Text style={styles.fieldLabel}>Signature of Applicant / अभ्यर्थी के हस्ताक्षर</Text>
                {signature ? (
                  <View style={styles.sigPreview}>
                    <Image source={{ uri: signature.uri }} style={styles.sigImg} resizeMode="contain" />
                    <TouchableOpacity onPress={() => setSignature(null)} style={styles.sigClear}>
                      <Feather name="x" size={14} color={ERROR_RED} />
                      <Text style={{ color: ERROR_RED, fontSize: 12, marginLeft: 4 }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => pickImage(setSignature)} style={styles.sigUploadBtn}>
                    <Feather name="edit-2" size={18} color={MUTED} />
                    <Text style={styles.sigUploadText}>Upload Signature Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextBox label="Mobilizer Name / मोबिलाइज़र का नाम" value={mobilizer} onChangeText={setMobilizer} placeholder="Mobilizer / Field Staff name" />
            </View>
          )}

          {/* Submit button */}
          <View style={styles.submitRow}>
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [styles.submitBtn, loading && styles.submitBtnDisabled, { opacity: pressed ? 0.88 : 1 }]}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Feather name="send" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {pendingSync ? "Submit Saved Draft" : "Submit Registration Form"}
                    </Text>
                  </>
                )}
            </Pressable>
            <Pressable
              onPress={async () => {
                await saveDraftNow(false);
                router.push("/candidate/drafts");
              }}
              style={({ pressed }) => [styles.saveDraftBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Feather name="save" size={15} color={ACCENT} />
              <Text style={styles.saveDraftBtnText}>Save & Continue Later</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  navHeader: {
    backgroundColor: HEADER_BG,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  autoSaveText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  draftsBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  draftsBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  draftsBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#B91C1C",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  draftBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderBottomWidth: 1,
    borderBottomColor: "#BFDBFE",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  draftBannerText: {
    color: ACCENT,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  bannerText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  scrollContent: {
    padding: 12,
  },
  paper: {
    backgroundColor: FORM_BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 3,
    overflow: "hidden",
  },

  // ── Form Header ───────────────────────────────────────────────
  formHeader: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: "#FFF8E7",
  },
  formHeaderInner: {
    flexDirection: "row",
    padding: 10,
  },
  orgTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: ACCENT,
    marginBottom: 2,
  },
  orgSub: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: ACCENT,
    marginBottom: 1,
  },
  hRule: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 6,
  },
  formTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: BORDER,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  formTitleHindi: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#555",
    textAlign: "center",
    marginTop: 2,
  },

  // ── Borders / rows ────────────────────────────────────────────
  borderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    padding: 10,
    gap: 8,
  },

  // ── Section band ──────────────────────────────────────────────
  sectionBand: {
    backgroundColor: SECTION_BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sectionBandText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  sectionBody: {
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCC",
    gap: 10,
  },

  // ── Fields ────────────────────────────────────────────────────
  fieldCell: {
    gap: 4,
  },
  halfRow: {
    flexDirection: "row",
    gap: 8,
  },
  halfCell: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontFamily: "Inter_500Medium",
    color: LABEL_COLOR,
  },
  textBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: VALUE_COLOR,
    backgroundColor: "#fff",
    minHeight: 34,
  },
  dateDisplay: {
    justifyContent: "center",
  },

  // ── Radio ─────────────────────────────────────────────────────
  radioRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 2,
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  radioCircleActive: {
    borderColor: ACCENT,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  radioLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: VALUE_COLOR,
  },
  radioLabelActive: {
    fontFamily: "Inter_600SemiBold",
    color: ACCENT,
  },

  // ── Aadhaar boxes ─────────────────────────────────────────────
  aadhaarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aadhaarBox: {
    width: 26,
    height: 32,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 2,
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: VALUE_COLOR,
    backgroundColor: "#fff",
    padding: 0,
  },
  aadhaarSep: {
    width: 8,
    height: 2,
    backgroundColor: BORDER,
    borderRadius: 1,
  },

  // ── Photo box ─────────────────────────────────────────────────
  photoBoxEmpty: {
    width: 90,
    height: 112,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    padding: 4,
  },
  photoIcon: {
    marginBottom: 4,
  },
  photoBoxLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: BORDER,
    textAlign: "center",
  },
  photoBoxSub: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
    textAlign: "center",
  },
  photoBoxTap: {
    fontSize: 8,
    color: ACCENT,
    marginTop: 3,
    textAlign: "center",
  },
  photoBoxFilled: {
    width: 90,
    height: 112,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 2,
    overflow: "hidden",
    position: "relative",
  },
  photoImg: {
    width: 90,
    height: 100,
  },
  photoLabel: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: "center",
    paddingVertical: 2,
    backgroundColor: "#F9FAFB",
  },
  photoClearBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Document cards ────────────────────────────────────────────
  docInstructions: {
    fontSize: 11,
    color: MUTED,
    fontFamily: "Inter_400Regular",
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 4,
    padding: 10,
    gap: 10,
    backgroundColor: "#fff",
  },
  docCardDone: {
    borderColor: SUCCESS_GREEN,
    backgroundColor: "#F0FFF4",
  },
  docCheck: {
    width: 20,
    alignItems: "center",
  },
  docLabel: {
    flex: 2,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#555",
  },
  docLabelDone: {
    color: SUCCESS_GREEN,
    fontFamily: "Inter_500Medium",
  },
  docRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docThumb: {
    width: 40,
    height: 40,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#CCC",
  },
  docClearBtn: {
    padding: 2,
  },
  docUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 4,
  },
  docUploadText: {
    fontSize: 12,
    color: ACCENT,
    fontFamily: "Inter_500Medium",
  },

  // ── Declaration ───────────────────────────────────────────────
  declarationBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 2,
    padding: 10,
    backgroundColor: "#FFFDE7",
    gap: 4,
  },
  declarationText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: VALUE_COLOR,
    lineHeight: 16,
  },
  declarationHindi: {
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
    color: "#555",
    lineHeight: 15,
  },

  // ── Signature ─────────────────────────────────────────────────
  sigUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "dashed",
    borderRadius: 4,
    padding: 16,
    justifyContent: "center",
    backgroundColor: "#fafafa",
  },
  sigUploadText: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  sigPreview: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  sigImg: {
    width: "100%",
    height: 80,
  },
  sigClear: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },

  // ── Submit ────────────────────────────────────────────────────
  submitRow: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  submitBtn: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  saveDraftBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 4,
    paddingVertical: 10,
    marginTop: 8,
  },
  saveDraftBtnText: {
    color: ACCENT,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },

  // ── Centered screens ──────────────────────────────────────────
  centeredScreen: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  blockedCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#FBBF24",
    maxWidth: 360,
    width: "100%",
  },
  blockedTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: VALUE_COLOR,
    textAlign: "center",
  },
  blockedSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
  },
  blockedBtn: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  blockedBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: VALUE_COLOR,
  },
  successCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    maxWidth: 380,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0FFF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: SUCCESS_GREEN,
  },
  successName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: VALUE_COLOR,
  },
  successPhone: {
    fontSize: 13,
    color: MUTED,
    fontFamily: "Inter_400Regular",
  },
  successId: {
    fontSize: 12,
    color: MUTED,
    fontFamily: "Inter_400Regular",
  },
  statusBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginVertical: 4,
  },
  statusBadgeText: {
    color: "#92400E",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  pdfBtn: {
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 4,
    width: "100%",
    justifyContent: "center",
  },
  pdfBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  anotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 8,
    width: "100%",
    justifyContent: "center",
  },
  anotherBtnText: {
    color: ACCENT,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  backLink: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
