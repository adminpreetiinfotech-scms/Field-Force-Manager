import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React, { useState } from "react";
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
  pdfUrl?: string | null;
};

const GENDERS = ["Male", "Female", "Other"] as const;
const CASTES = ["General", "OBC", "SC", "ST"] as const;

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

async function pickImage(
  setter: (img: ImageData | null) => void,
): Promise<void> {
  if (Platform.OS !== "web") {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Needed",
        "Please allow camera roll access in Settings to upload documents.",
      );
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
    setter({
      uri: asset.uri,
      base64: asset.base64 ?? "",
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }
}

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <View style={[styles.sectionHeader, { backgroundColor: color + "14", borderColor: color + "44" }]}>
      <Text style={[styles.sectionHeaderText, { color }]}>{title}</Text>
    </View>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  required,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad";
  required?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
        {label}
        {required ? <Text style={{ color: "#EF4444" }}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground + "88"}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.muted,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
        ]}
      />
    </View>
  );
}

function ChipSelect({
  options,
  value,
  onSelect,
  colors,
}: {
  options: readonly string[];
  value: string | null;
  onSelect: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.muted,
                borderColor: active ? colors.primary : colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: active ? "#fff" : colors.mutedForeground },
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DocPickerCard({
  label,
  value,
  onPick,
  onClear,
  colors,
}: {
  label: string;
  value: ImageData | null;
  onPick: () => void;
  onClear: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.docCard,
        {
          backgroundColor: colors.card,
          borderColor: value ? colors.primary + "44" : colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.docCardLeft}>
        <Feather
          name="file-text"
          size={16}
          color={value ? colors.primary : colors.mutedForeground}
        />
        <Text
          style={[
            styles.docCardLabel,
            { color: value ? colors.foreground : colors.mutedForeground },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
      {value ? (
        <View style={styles.docCardRight}>
          <Image source={{ uri: value.uri }} style={styles.docThumb} />
          <TouchableOpacity onPress={onClear} style={styles.docClearBtn}>
            <Feather name="x" size={12} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onPick}
          style={[
            styles.docPickBtn,
            {
              backgroundColor: colors.primary + "14",
              borderColor: colors.primary + "44",
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="upload" size={14} color={colors.primary} />
          <Text style={[styles.docPickText, { color: colors.primary }]}>
            Upload
          </Text>
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

  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert("Required", "Please enter the candidate's full name.");
      return;
    }
    if (!phone.trim() || !/^\d{10}$/.test(phone.trim())) {
      Alert.alert("Required", "Please enter a valid 10-digit mobile number.");
      return;
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
        aadhaarNumber: aadhaarNumber.trim() || null,
        education: education.trim() || null,
        bankAccount: bankAccount.trim() || null,
        bankName: bankName.trim() || null,
        ifsc: ifsc.trim() || null,
        caste: selectedCaste || null,
        submittedBy: user?.name ?? null,
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

      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: CandidateDto = await res.json();
      if (!res.ok) {
        const errData = data as unknown as { title?: string };
        throw new Error(errData.title ?? "Submission failed");
      }
      setSubmitted(data);
    } catch (e) {
      const err = e as Error;
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!submitted?.pdfUrl) return;
    const apiBase = getApiBase();
    Linking.openURL(`${apiBase}${submitted.pdfUrl}`);
  };

  const handleRegisterAnother = () => {
    setSubmitted(null);
    setName(""); setPhone(""); setFatherName(""); setDob("");
    setSelectedGender(null); setAddress(""); setArea("");
    setAadhaarNumber(""); setEducation(""); setSelectedCaste(null);
    setBankAccount(""); setBankName(""); setIfsc("");
    setPhoto(null); setAadhaarFront(null); setAadhaarBack(null);
    setEducationCert(null); setBankPassbook(null); setCasteCert(null);
  };

  if (submitted) {
    return (
      <View
        style={[
          styles.successContainer,
          { backgroundColor: colors.background, paddingTop: insets.top + webTop + 16 },
        ]}
      >
        <View
          style={[
            styles.successCard,
            {
              backgroundColor: colors.card,
              borderColor: "#059669" + "44",
              borderRadius: colors.radius + 4,
            },
          ]}
        >
          <View style={[styles.successIconWrap, { backgroundColor: "#059669" + "14" }]}>
            <Feather name="check-circle" size={40} color="#059669" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>
            Registration Successful!
          </Text>
          <Text style={[styles.successName, { color: colors.primary }]}>
            {submitted.name}
          </Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            {submitted.phone}
          </Text>
          <Text style={[styles.successId, { color: colors.mutedForeground }]}>
            ID: {submitted.id}
          </Text>

          {submitted.pdfUrl ? (
            <Pressable
              onPress={handleDownloadPdf}
              style={({ pressed }) => [
                styles.pdfBtn,
                {
                  backgroundColor: "#1E3A5F",
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="download" size={18} color="#fff" />
              <Text style={styles.pdfBtnText}>Download Profile PDF</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleRegisterAnother}
            style={({ pressed }) => [
              styles.anotherBtn,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="user-plus" size={16} color={colors.foreground} />
            <Text style={[styles.anotherBtnText, { color: colors.foreground }]}>
              Register Another Candidate
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 4 }]}
          >
            <Text style={[styles.backLink, { color: colors.mutedForeground }]}>
              ← Back to Dashboard
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: insets.top + webTop,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Candidate Registration
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Personal Information ── */}
        <SectionHeader title="Personal Information" color={colors.primary} />

        <FieldInput
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="Candidate's full name"
          required
          colors={colors}
        />
        <FieldInput
          label="Mobile Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
          required
          colors={colors}
        />
        <FieldInput
          label="Father's Name"
          value={fatherName}
          onChangeText={setFatherName}
          placeholder="Father's full name"
          colors={colors}
        />
        <FieldInput
          label="Date of Birth"
          value={dob}
          onChangeText={setDob}
          placeholder="DD/MM/YYYY"
          colors={colors}
        />

        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Gender
          </Text>
          <ChipSelect
            options={GENDERS}
            value={selectedGender}
            onSelect={setSelectedGender}
            colors={colors}
          />
        </View>

        {/* ── Address ── */}
        <SectionHeader title="Address & Area" color="#0891B2" />

        <FieldInput
          label="Full Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Street, City, State"
          colors={colors}
        />
        <FieldInput
          label="Area / Pincode"
          value={area}
          onChangeText={setArea}
          placeholder="Area name or PIN code"
          colors={colors}
        />

        {/* ── Identity ── */}
        <SectionHeader title="Identity" color="#7C3AED" />

        <FieldInput
          label="Aadhaar Number"
          value={aadhaarNumber}
          onChangeText={setAadhaarNumber}
          placeholder="12-digit Aadhaar number"
          keyboardType="numeric"
          colors={colors}
        />

        {/* ── Education & Category ── */}
        <SectionHeader title="Education & Category" color="#D97706" />

        <FieldInput
          label="Education Qualification"
          value={education}
          onChangeText={setEducation}
          placeholder="e.g. 10th Pass, Graduate"
          colors={colors}
        />

        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Caste Category
          </Text>
          <ChipSelect
            options={CASTES}
            value={selectedCaste}
            onSelect={setSelectedCaste}
            colors={colors}
          />
        </View>

        {/* ── Bank Details ── */}
        <SectionHeader title="Bank Details" color="#059669" />

        <FieldInput
          label="Bank Name"
          value={bankName}
          onChangeText={setBankName}
          placeholder="e.g. State Bank of India"
          colors={colors}
        />
        <FieldInput
          label="Account Number"
          value={bankAccount}
          onChangeText={setBankAccount}
          placeholder="Bank account number"
          keyboardType="numeric"
          colors={colors}
        />
        <FieldInput
          label="IFSC Code"
          value={ifsc}
          onChangeText={setIfsc}
          placeholder="e.g. SBIN0001234"
          colors={colors}
        />

        {/* ── Candidate Photo ── */}
        <SectionHeader title="Candidate Photo" color="#BE185D" />

        <View style={styles.photoSection}>
          {photo ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
              <Pressable
                onPress={() => setPhoto(null)}
                style={[styles.photoRemoveBtn, { borderRadius: 12 }]}
              >
                <Feather name="x" size={14} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => void pickImage(setPhoto)}
              style={[
                styles.photoPickBtn,
                {
                  backgroundColor: "#BE185D" + "14",
                  borderColor: "#BE185D" + "44",
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather name="camera" size={28} color="#BE185D" />
              <Text style={[styles.photoPickText, { color: "#BE185D" }]}>
                Pick Passport Photo
              </Text>
              <Text style={[styles.photoPickSub, { color: colors.mutedForeground }]}>
                Tap to select from gallery
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Documents ── */}
        <SectionHeader title="Documents" color="#1E3A5F" />

        <Text
          style={[styles.docHint, { color: colors.mutedForeground }]}
        >
          Upload clear photos of each document. All fields are optional but help speed up verification.
        </Text>

        <DocPickerCard
          label="Aadhaar Card – Front"
          value={aadhaarFront}
          onPick={() => void pickImage(setAadhaarFront)}
          onClear={() => setAadhaarFront(null)}
          colors={colors}
        />
        <DocPickerCard
          label="Aadhaar Card – Back"
          value={aadhaarBack}
          onPick={() => void pickImage(setAadhaarBack)}
          onClear={() => setAadhaarBack(null)}
          colors={colors}
        />
        <DocPickerCard
          label="Education Certificate"
          value={educationCert}
          onPick={() => void pickImage(setEducationCert)}
          onClear={() => setEducationCert(null)}
          colors={colors}
        />
        <DocPickerCard
          label="Bank Passbook / Statement"
          value={bankPassbook}
          onPick={() => void pickImage(setBankPassbook)}
          onClear={() => setBankPassbook(null)}
          colors={colors}
        />
        <DocPickerCard
          label="Caste Certificate"
          value={casteCert}
          onPick={() => void pickImage(setCasteCert)}
          onClear={() => setCasteCert(null)}
          colors={colors}
        />

        {/* Submit */}
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={loading}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: loading ? colors.mutedForeground : "#1E3A5F",
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="user-check" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Submit Registration</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    gap: 10,
  },
  sectionHeader: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  fieldWrap: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  photoSection: {
    alignItems: "center",
  },
  photoPickBtn: {
    width: "100%",
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  photoPickText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  photoPickSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  photoPreviewWrap: {
    position: "relative",
  },
  photoPreview: {
    width: 120,
    height: 150,
    borderRadius: 8,
  },
  photoRemoveBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  docHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  docCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  docCardLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  docCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docThumb: {
    width: 44,
    height: 44,
    borderRadius: 4,
  },
  docClearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  docPickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  docPickText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    marginTop: 16,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  successCard: {
    padding: 28,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  successName: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  successSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  successId: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    height: 52,
    justifyContent: "center",
  },
  pdfBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  anotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    height: 48,
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  anotherBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  backLink: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
});
