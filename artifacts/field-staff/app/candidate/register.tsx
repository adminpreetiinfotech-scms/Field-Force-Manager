import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as Network from "expo-network";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useColors } from "@/hooks/useColors";

type ImageData = { uri: string; base64: string; mimeType: string };
type CandidateDto = {
  id: string;
  name: string;
  phone: string;
  status: string;
  pdfUrl?: string | null;
};

const GENDERS = ["Male", "Female", "Other"] as const;
const CASTES = ["General", "OBC", "SC", "ST"] as const;
const DRAFT_KEY = "@candidate-draft-v2";

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

async function pickImage(setter: (img: ImageData | null) => void): Promise<void> {
  if (Platform.OS !== "web") {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Needed", "Please allow camera roll access to upload documents.");
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
    const asset = result.assets[0];
    setter({ uri: asset.uri, base64: asset.base64 ?? "", mimeType: asset.mimeType ?? "image/jpeg" });
  }
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <View style={[ss.sectionHeader, { backgroundColor: color + "14", borderColor: color + "44" }]}>
      <Text style={[ss.sectionHeaderText, { color }]}>{title}</Text>
    </View>
  );
}

function FieldInput({
  label, value, onChangeText, placeholder, keyboardType = "default", required, colors,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: "default" | "numeric" | "phone-pad";
  required?: boolean; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={ss.fieldWrap}>
      <Text style={[ss.fieldLabel, { color: colors.mutedForeground }]}>
        {label}{required ? <Text style={{ color: "#EF4444" }}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground + "88"}
        keyboardType={keyboardType}
        style={[ss.input, {
          color: colors.foreground,
          backgroundColor: colors.muted,
          borderColor: colors.border,
          borderRadius: colors.radius,
        }]}
      />
    </View>
  );
}

function ChipSelect({
  options, value, onSelect, colors,
}: {
  options: readonly string[]; value: string | null;
  onSelect: (v: string) => void; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={ss.chipRow}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            style={[ss.chip, {
              backgroundColor: active ? colors.primary : colors.muted,
              borderColor: active ? colors.primary : colors.border,
              borderRadius: colors.radius,
            }]}
          >
            <Text style={[ss.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DocPickerCard({
  label, value, onPick, onClear, colors,
}: {
  label: string; value: ImageData | null;
  onPick: () => void; onClear: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[ss.docCard, {
      backgroundColor: colors.card,
      borderColor: value ? colors.primary + "44" : colors.border,
      borderRadius: colors.radius,
    }]}>
      <View style={ss.docCardLeft}>
        <Feather name="file-text" size={16} color={value ? colors.primary : colors.mutedForeground} />
        <Text style={[ss.docCardLabel, { color: value ? colors.foreground : colors.mutedForeground }]}
          numberOfLines={2}>
          {label}
        </Text>
      </View>
      {value ? (
        <View style={ss.docCardRight}>
          <Image source={{ uri: value.uri }} style={ss.docThumb} />
          <TouchableOpacity onPress={onClear} style={ss.docClearBtn}>
            <Feather name="x" size={12} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onPick}
          style={[ss.docPickBtn, {
            backgroundColor: colors.primary + "14",
            borderColor: colors.primary + "44",
            borderRadius: colors.radius,
          }]}
        >
          <Feather name="upload" size={14} color={colors.primary} />
          <Text style={[ss.docPickText, { color: colors.primary }]}>Upload</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function CandidateRegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [dob, setDob] = useState("");
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [village, setVillage] = useState("");
  const [course, setCourse] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [education, setEducation] = useState("");
  const [selectedCaste, setSelectedCaste] = useState<string | null>(null);
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");

  const [photo, setPhoto] = useState<ImageData | null>(null);
  const [aadhaarFront, setAadhaarFront] = useState<ImageData | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<ImageData | null>(null);
  const [educationCert, setEducationCert] = useState<ImageData | null>(null);
  const [bankPassbook, setBankPassbook] = useState<ImageData | null>(null);
  const [casteCert, setCasteCert] = useState<ImageData | null>(null);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<CandidateDto | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [approvalBlocked, setApprovalBlocked] = useState(false);
  const networkPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Draft helpers ──────────────────────────────────────────────────────────

  const buildTextDraft = useCallback(() => ({
    name, phone, fatherName, dob, gender: selectedGender,
    address, area, village, course, aadhaarNumber, education,
    caste: selectedCaste, bankAccount, bankName, ifsc,
  }), [name, phone, fatherName, dob, selectedGender, address, area, village,
    course, aadhaarNumber, education, selectedCaste, bankAccount, bankName, ifsc]);

  const restoreDraft = useCallback((draft: Record<string, string | null>) => {
    setName(draft.name ?? "");
    setPhone(draft.phone ?? "");
    setFatherName(draft.fatherName ?? "");
    setDob(draft.dob ?? "");
    setSelectedGender(draft.gender ?? null);
    setAddress(draft.address ?? "");
    setArea(draft.area ?? "");
    setVillage(draft.village ?? "");
    setCourse(draft.course ?? "");
    setAadhaarNumber(draft.aadhaarNumber ?? "");
    setEducation(draft.education ?? "");
    setSelectedCaste(draft.caste ?? null);
    setBankAccount(draft.bankAccount ?? "");
    setBankName(draft.bankName ?? "");
    setIfsc(draft.ifsc ?? "");
  }, []);

  const clearFormAndDraft = useCallback(async () => {
    setName(""); setPhone(""); setFatherName(""); setDob("");
    setSelectedGender(null); setAddress(""); setArea(""); setVillage(""); setCourse("");
    setAadhaarNumber(""); setEducation(""); setSelectedCaste(null);
    setBankAccount(""); setBankName(""); setIfsc("");
    setPhoto(null); setAadhaarFront(null); setAadhaarBack(null);
    setEducationCert(null); setBankPassbook(null); setCasteCert(null);
    setHasDraft(false);
    await AsyncStorage.removeItem(DRAFT_KEY);
  }, []);

  // Check online status + pending drafts when screen becomes focused
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const state = await Network.getNetworkStateAsync();
        if (!cancelled) setIsOffline(!state.isConnected);

        const saved = await AsyncStorage.getItem(DRAFT_KEY);
        if (!cancelled && saved) {
          setHasDraft(true);
        }
      })();
      return () => { cancelled = true; };
    }, []),
  );

  // Poll network every 15 s while offline to detect restoration
  useEffect(() => {
    if (!isOffline) {
      if (networkPollRef.current) clearInterval(networkPollRef.current);
      return;
    }
    networkPollRef.current = setInterval(() => {
      void Network.getNetworkStateAsync().then((s) => {
        if (s.isConnected) setIsOffline(false);
      });
    }, 15_000);
    return () => {
      if (networkPollRef.current) clearInterval(networkPollRef.current);
    };
  }, [isOffline]);

  // When back online + draft exists, offer to submit
  useEffect(() => {
    if (!isOffline && hasDraft) {
      Alert.alert(
        "You're back online!",
        "You have a saved draft. Submit it now or restore the form to review.",
        [
          {
            text: "Restore & Review",
            onPress: async () => {
              const saved = await AsyncStorage.getItem(DRAFT_KEY);
              if (saved) {
                const draft = JSON.parse(saved) as Record<string, string | null>;
                restoreDraft(draft);
                setHasDraft(false);
              }
            },
          },
          { text: "Later", style: "cancel" },
        ],
      );
    }
  }, [isOffline, hasDraft, restoreDraft]);

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert("Required", "Please enter the candidate's full name.");
      return;
    }
    if (!phone.trim() || !/^\d{10}$/.test(phone.trim())) {
      Alert.alert("Required", "Please enter a valid 10-digit mobile number.");
      return;
    }

    // Check network connectivity
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) {
      setIsOffline(true);
      const textDraft = buildTextDraft();
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(textDraft));
      setHasDraft(true);
      Alert.alert(
        "No Internet Connection",
        "Your form has been saved as a draft and will be ready to submit when you are online again.",
        [{ text: "OK" }],
      );
      return;
    }

    // Duplicate check
    const apiBase = getApiBase();
    try {
      const dupRes = await fetch(`${apiBase}/api/candidates/check-duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), aadhaarNumber: aadhaarNumber.trim() || undefined }),
      });
      if (dupRes.ok) {
        const dupData = await dupRes.json() as { isDuplicate: boolean; field?: string; existingName?: string };
        if (dupData.isDuplicate) {
          const fieldLabel = dupData.field === "aadhaar" ? "Aadhaar number" : "phone number";
          await new Promise<void>((resolve, reject) => {
            Alert.alert(
              "Duplicate Found",
              `A candidate with this ${fieldLabel} already exists (${dupData.existingName ?? "unknown"}). Continue submitting?`,
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
      // network error on dup check – proceed anyway
    }

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        phone: phone.trim(),
        fatherName: fatherName.trim() || null,
        dob: dob.trim() || null,
        gender: selectedGender || null,
        address: address.trim() || null,
        area: area.trim() || null,
        village: village.trim() || null,
        course: course.trim() || null,
        aadhaarNumber: aadhaarNumber.trim() || null,
        education: education.trim() || null,
        bankAccount: bankAccount.trim() || null,
        bankName: bankName.trim() || null,
        ifsc: ifsc.trim() || null,
        caste: selectedCaste || null,
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
      };

      const res = await fetch(`${apiBase}/api/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as CandidateDto & { title?: string };
      if (res.status === 403) {
        setApprovalBlocked(true);
        return;
      }
      if (!res.ok) {
        throw new Error(data.title ?? "Submission failed");
      }
      await AsyncStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
      setSubmitted(data);
    } catch (e) {
      const err = e as Error;
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Approval blocked screen ────────────────────────────────────────────────

  if (approvalBlocked) {
    return (
      <View style={[ss.centeredScreen, { backgroundColor: colors.background, paddingTop: insets.top + webTop }]}>
        <View style={[ss.blockedCard, { backgroundColor: colors.card, borderColor: "#D97706" + "44", borderRadius: colors.radius + 4 }]}>
          <View style={[ss.blockedIconWrap, { backgroundColor: "#D97706" + "14" }]}>
            <Feather name="clock" size={36} color="#D97706" />
          </View>
          <Text style={[ss.blockedTitle, { color: colors.foreground }]}>Account Pending Approval</Text>
          <Text style={[ss.blockedSub, { color: colors.mutedForeground }]}>
            Your account is pending admin approval. You cannot submit candidate data until your account is approved.
          </Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [ss.blockedBtn, {
            backgroundColor: colors.muted, borderColor: colors.border,
            borderRadius: colors.radius, opacity: pressed ? 0.85 : 1,
          }]}>
            <Text style={[ss.blockedBtnText, { color: colors.foreground }]}>← Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Success screen ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <View style={[ss.centeredScreen, { backgroundColor: colors.background, paddingTop: insets.top + webTop + 16 }]}>
        <View style={[ss.successCard, { backgroundColor: colors.card, borderColor: "#059669" + "44", borderRadius: colors.radius + 4 }]}>
          <View style={[ss.successIconWrap, { backgroundColor: "#059669" + "14" }]}>
            <Feather name="check-circle" size={40} color="#059669" />
          </View>
          <Text style={[ss.successTitle, { color: colors.foreground }]}>Registration Successful!</Text>
          <Text style={[ss.successName, { color: colors.primary }]}>{submitted.name}</Text>
          <Text style={[ss.successSub, { color: colors.mutedForeground }]}>{submitted.phone}</Text>
          <Text style={[ss.successId, { color: colors.mutedForeground }]}>ID: {submitted.id}</Text>
          <View style={[ss.statusBadgeWrap, { backgroundColor: "#D97706" + "18" }]}>
            <Text style={[ss.statusBadgeText, { color: "#D97706" }]}>Pending Admin Verification</Text>
          </View>

          {submitted.pdfUrl ? (
            <Pressable
              onPress={() => { const b = getApiBase(); void Linking.openURL(`${b}${submitted.pdfUrl}`); }}
              style={({ pressed }) => [ss.pdfBtn, { backgroundColor: "#1E3A5F", borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="download" size={18} color="#fff" />
              <Text style={ss.pdfBtnText}>Download Profile PDF</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => void clearFormAndDraft().then(() => setSubmitted(null))}
            style={({ pressed }) => [ss.anotherBtn, {
              backgroundColor: colors.muted, borderColor: colors.border,
              borderRadius: colors.radius, opacity: pressed ? 0.85 : 1,
            }]}
          >
            <Feather name="user-plus" size={16} color={colors.foreground} />
            <Text style={[ss.anotherBtnText, { color: colors.foreground }]}>Register Another Candidate</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 4 }]}>
            <Text style={[ss.backLink, { color: colors.mutedForeground }]}>← Back to Dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Form ───────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[ss.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: insets.top + webTop }]}>
        <Pressable onPress={() => router.back()} style={ss.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[ss.headerTitle, { color: colors.foreground }]}>Candidate Registration</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Offline + Draft banners */}
      {isOffline && (
        <View style={[ss.banner, { backgroundColor: "#D97706" + "18", borderColor: "#D97706" + "44" }]}>
          <Feather name="wifi-off" size={14} color="#D97706" />
          <Text style={[ss.bannerText, { color: "#D97706" }]}>Offline — form will be saved as draft on submit</Text>
        </View>
      )}
      {hasDraft && !isOffline && (
        <Pressable
          style={[ss.banner, { backgroundColor: "#1E3A5F" + "14", borderColor: "#1E3A5F" + "44" }]}
          onPress={async () => {
            const saved = await AsyncStorage.getItem(DRAFT_KEY);
            if (saved) {
              restoreDraft(JSON.parse(saved) as Record<string, string | null>);
              setHasDraft(false);
              Alert.alert("Draft Restored", "Please re-select any document photos.");
            }
          }}
        >
          <Feather name="save" size={14} color="#1E3A5F" />
          <Text style={[ss.bannerText, { color: "#1E3A5F" }]}>Saved draft found — tap to restore</Text>
        </Pressable>
      )}

      <ScrollView
        contentContainerStyle={[ss.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Personal Information */}
        <SectionHeader title="Personal Information" color={colors.primary} />
        <FieldInput label="Full Name" value={name} onChangeText={setName} placeholder="Candidate's full name" required colors={colors} />
        <FieldInput label="Mobile Number" value={phone} onChangeText={setPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" required colors={colors} />
        <FieldInput label="Father's Name" value={fatherName} onChangeText={setFatherName} placeholder="Father's full name" colors={colors} />
        <FieldInput label="Date of Birth" value={dob} onChangeText={setDob} placeholder="DD/MM/YYYY" colors={colors} />
        <View style={ss.fieldWrap}>
          <Text style={[ss.fieldLabel, { color: colors.mutedForeground }]}>Gender</Text>
          <ChipSelect options={GENDERS} value={selectedGender} onSelect={setSelectedGender} colors={colors} />
        </View>

        {/* Address & Area */}
        <SectionHeader title="Address & Area" color="#0891B2" />
        <FieldInput label="Full Address" value={address} onChangeText={setAddress} placeholder="Street, City, State" colors={colors} />
        <FieldInput label="Village" value={village} onChangeText={setVillage} placeholder="Village name" colors={colors} />
        <FieldInput label="Area / Pincode" value={area} onChangeText={setArea} placeholder="Area name or PIN code" colors={colors} />

        {/* Course */}
        <SectionHeader title="Course / Training" color="#7C3AED" />
        <FieldInput label="Course Name" value={course} onChangeText={setCourse} placeholder="e.g. Basic Computer, Tailoring" colors={colors} />

        {/* Identity */}
        <SectionHeader title="Identity" color="#DC2626" />
        <FieldInput label="Aadhaar Number" value={aadhaarNumber} onChangeText={setAadhaarNumber} placeholder="12-digit Aadhaar number" keyboardType="numeric" colors={colors} />

        {/* Education & Category */}
        <SectionHeader title="Education & Category" color="#D97706" />
        <FieldInput label="Education Qualification" value={education} onChangeText={setEducation} placeholder="e.g. 10th Pass, Graduate" colors={colors} />
        <View style={ss.fieldWrap}>
          <Text style={[ss.fieldLabel, { color: colors.mutedForeground }]}>Caste Category</Text>
          <ChipSelect options={CASTES} value={selectedCaste} onSelect={setSelectedCaste} colors={colors} />
        </View>

        {/* Bank Details */}
        <SectionHeader title="Bank Details" color="#059669" />
        <FieldInput label="Bank Name" value={bankName} onChangeText={setBankName} placeholder="e.g. State Bank of India" colors={colors} />
        <FieldInput label="Account Number" value={bankAccount} onChangeText={setBankAccount} placeholder="Bank account number" keyboardType="numeric" colors={colors} />
        <FieldInput label="IFSC Code" value={ifsc} onChangeText={setIfsc} placeholder="e.g. SBIN0001234" colors={colors} />

        {/* Candidate Photo */}
        <SectionHeader title="Candidate Photo" color="#BE185D" />
        <View style={ss.photoSection}>
          {photo ? (
            <View style={ss.photoPreviewWrap}>
              <Image source={{ uri: photo.uri }} style={ss.photoPreview} />
              <Pressable onPress={() => setPhoto(null)} style={[ss.photoRemoveBtn, { borderRadius: 12 }]}>
                <Feather name="x" size={14} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => void pickImage(setPhoto)}
              style={[ss.photoPickBtn, { backgroundColor: "#BE185D" + "14", borderColor: "#BE185D" + "44", borderRadius: colors.radius }]}
            >
              <Feather name="camera" size={28} color="#BE185D" />
              <Text style={[ss.photoPickText, { color: "#BE185D" }]}>Pick Passport Photo</Text>
              <Text style={[ss.photoPickSub, { color: colors.mutedForeground }]}>Tap to select from gallery</Text>
            </Pressable>
          )}
        </View>

        {/* Documents */}
        <SectionHeader title="Documents" color="#1E3A5F" />
        <Text style={[ss.docHint, { color: colors.mutedForeground }]}>
          Upload clear photos of each document. All fields are optional but help speed up verification.
        </Text>
        <DocPickerCard label="Aadhaar Card – Front" value={aadhaarFront} onPick={() => void pickImage(setAadhaarFront)} onClear={() => setAadhaarFront(null)} colors={colors} />
        <DocPickerCard label="Aadhaar Card – Back" value={aadhaarBack} onPick={() => void pickImage(setAadhaarBack)} onClear={() => setAadhaarBack(null)} colors={colors} />
        <DocPickerCard label="Education Certificate" value={educationCert} onPick={() => void pickImage(setEducationCert)} onClear={() => setEducationCert(null)} colors={colors} />
        <DocPickerCard label="Bank Passbook / Statement" value={bankPassbook} onPick={() => void pickImage(setBankPassbook)} onClear={() => setBankPassbook(null)} colors={colors} />
        <DocPickerCard label="Caste Certificate" value={casteCert} onPick={() => void pickImage(setCasteCert)} onClear={() => setCasteCert(null)} colors={colors} />

        {/* Submit */}
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={loading}
          style={({ pressed }) => [ss.submitBtn, {
            backgroundColor: loading ? colors.mutedForeground : (isOffline ? "#D97706" : "#1E3A5F"),
            borderRadius: colors.radius,
            opacity: pressed ? 0.85 : 1,
          }]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name={isOffline ? "save" : "user-check"} size={18} color="#fff" />
              <Text style={ss.submitBtnText}>{isOffline ? "Save as Draft" : "Submit Registration"}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3, textAlign: "center" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  bannerText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  scrollContent: { padding: 16, gap: 10 },
  sectionHeader: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, marginTop: 8 },
  sectionHeaderText: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  input: { height: 44, paddingHorizontal: 12, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: StyleSheet.hairlineWidth },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  docCard: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  docCardLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  docCardLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  docCardRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  docThumb: { width: 40, height: 40, borderRadius: 4 },
  docClearBtn: { padding: 4 },
  docPickBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderWidth: StyleSheet.hairlineWidth },
  docPickText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  photoSection: { alignItems: "center", paddingVertical: 8 },
  photoPreviewWrap: { position: "relative" },
  photoPreview: { width: 120, height: 120, borderRadius: 8 },
  photoRemoveBtn: { position: "absolute", top: -8, right: -8, width: 24, height: 24, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  photoPickBtn: { width: "100%", alignItems: "center", padding: 24, gap: 8, borderWidth: StyleSheet.hairlineWidth },
  photoPickText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  photoPickSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  docHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52, marginTop: 8 },
  submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  centeredScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  blockedCard: { width: "100%", maxWidth: 360, padding: 24, borderWidth: 1, alignItems: "center", gap: 12 },
  blockedIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  blockedTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  blockedSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  blockedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  blockedBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  successCard: { width: "100%", maxWidth: 360, padding: 24, borderWidth: 1, alignItems: "center", gap: 12 },
  successIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  successName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  successSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  successId: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusBadgeWrap: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pdfBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, width: "100%", justifyContent: "center" },
  pdfBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  anotherBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderWidth: StyleSheet.hairlineWidth, width: "100%", justifyContent: "center" },
  anotherBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  backLink: { fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
});
