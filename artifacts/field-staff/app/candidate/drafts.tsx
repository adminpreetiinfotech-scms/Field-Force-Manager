import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";

const DRAFTS_STORE_KEY = "@candidate-drafts-v1";
const HEADER_BG = "#1E3A5F";
const ACCENT = "#1E3A5F";
const SUCCESS_GREEN = "#1B5E20";
const MUTED = "#888";

type ImageData = { uri: string; base64: string; mimeType: string };

type CandidateDraft = {
  id: string;
  savedAt: string;
  pendingSync: boolean;
  name: string; phone: string; parentMobile?: string; email: string;
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
  casteCertAvailable: string | null;
  casteName: string;
  photo: ImageData | null;
  aadhaarFront: ImageData | null;
  aadhaarBack: ImageData | null;
  educationCert: ImageData | null;
  bankPassbook: ImageData | null;
  casteCert: ImageData | null;
  signature: ImageData | null;
};

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN || "field-force-manager-Mobilization.replit.app";
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function calcProgress(d: CandidateDraft): number {
  const fields = [
    d.name, d.phone, d.fatherName, d.dob, d.gender, d.address,
    d.village, d.district, d.aadhaarNumber, d.education,
    d.bankAccount, d.bankName, d.ifsc,
  ];
  const filled = fields.filter((f) => f && String(f).trim()).length;
  return Math.round((filled / fields.length) * 100);
}

function countImages(d: CandidateDraft): number {
  return [d.photo, d.aadhaarFront, d.aadhaarBack, d.educationCert, d.bankPassbook, d.casteCert, d.signature]
    .filter(Boolean).length;
}

async function loadAllDrafts(): Promise<CandidateDraft[]> {
  try {
    const s = await AsyncStorage.getItem(DRAFTS_STORE_KEY);
    return s ? (JSON.parse(s) as CandidateDraft[]) : [];
  } catch { return []; }
}

async function removeDraftById(id: string): Promise<void> {
  const all = await loadAllDrafts();
  await AsyncStorage.setItem(DRAFTS_STORE_KEY, JSON.stringify(all.filter((d) => d.id !== id)));
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={ss.progTrack}>
      <View style={[ss.progFill, { width: `${pct}%` as `${number}%` }]} />
    </View>
  );
}

export default function DraftsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const [drafts, setDrafts] = useState<CandidateDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    const [all, net] = await Promise.all([
      loadAllDrafts(),
      Network.getNetworkStateAsync(),
    ]);
    setDrafts(all);
    setIsOnline(!!net.isConnected);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    void loadDrafts();
  }, [loadDrafts]));

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert(
      "Delete Draft",
      `Delete draft for "${name || "Unnamed"}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await removeDraftById(id);
            setDrafts((prev) => prev.filter((d) => d.id !== id));
          },
        },
      ],
    );
  }, []);

  const handleSubmitDraft = useCallback(async (draft: CandidateDraft) => {
    if (!isOnline) {
      Alert.alert("Offline", "Please connect to internet to submit this draft.");
      return;
    }
    setSyncingId(draft.id);
    try {
      const apiBase = getApiBase();
      const body = {
        name: draft.name?.trim() || null,
        phone: draft.phone?.trim() || null,
        parentMobile: draft.parentMobile?.trim() || null,
        email: draft.email?.trim() || null,
        fatherName: draft.fatherName?.trim() || null,
        motherName: draft.motherName?.trim() || null,
        dob: draft.dob?.trim() || null,
        gender: draft.gender || null,
        maritalStatus: draft.maritalStatus || null,
        religion: draft.religion || null,
        address: draft.address?.trim() || null,
        village: draft.village?.trim() || null,
        policeStation: draft.policeStation?.trim() || null,
        postOffice: draft.postOffice?.trim() || null,
        district: draft.district?.trim() || null,
        state: draft.state?.trim() || null,
        pin: draft.pin?.trim() || null,
        area: draft.area?.trim() || null,
        course: draft.course?.trim() || null,
        skillCentreName: draft.skillCentreName?.trim() || null,
        aadhaarNumber: draft.aadhaarNumber?.trim() || null,
        education: draft.education || null,
        yearOfPassing: draft.yearOfPassing?.trim() || null,
        caste: draft.caste || null,
        pwd: draft.pwd || null,
        disabilityType: draft.pwd === "Yes" ? draft.disabilityType?.trim() || null : null,
        bpl: draft.bpl || null,
        bplNumber: draft.bpl === "Yes" ? draft.bplNumber?.trim() || null : null,
        bankAccount: draft.bankAccount?.trim() || null,
        bankName: draft.bankName?.trim() || null,
        bankBranch: draft.bankBranch?.trim() || null,
        ifsc: draft.ifsc?.trim() || null,
        mobilizer: draft.mobilizer?.trim() || null,
        submittedBy: user?.name ?? null,
        submittedByPhone: user?.phone ?? null,
        photoBase64: draft.photo?.base64 ?? null,
        photoMime: draft.photo?.mimeType ?? null,
        aadhaarFrontBase64: draft.aadhaarFront?.base64 ?? null,
        aadhaarFrontMime: draft.aadhaarFront?.mimeType ?? null,
        aadhaarBackBase64: draft.aadhaarBack?.base64 ?? null,
        aadhaarBackMime: draft.aadhaarBack?.mimeType ?? null,
        educationCertBase64: draft.educationCert?.base64 ?? null,
        educationCertMime: draft.educationCert?.mimeType ?? null,
        bankPassbookBase64: draft.bankPassbook?.base64 ?? null,
        bankPassbookMime: draft.bankPassbook?.mimeType ?? null,
        casteCertBase64: draft.casteCertAvailable === "no" ? null : (draft.casteCert?.base64 ?? null),
        casteCertMime: draft.casteCertAvailable === "no" ? null : (draft.casteCert?.mimeType ?? null),
        casteCertAvailable: draft.casteCertAvailable ?? null,
        casteName: draft.casteCertAvailable === "no" ? (draft.casteName?.trim() || null) : null,
        candidateIdCode: draft.aadhaarNumber?.trim() || null,
        signatureBase64: draft.signature?.base64 ?? null,
        signatureMime: draft.signature?.mimeType ?? null,
      };
      const res = await fetch(`${apiBase}/api/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { id: string; name: string; title?: string };
      if (!res.ok) throw new Error(data.title ?? "Submission failed");
      await removeDraftById(draft.id);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      Alert.alert(
        "Submitted!",
        `${draft.name || "Candidate"} registered successfully. ID: ${data.id.slice(0, 8).toUpperCase()}`,
        [{ text: "OK" }],
      );
    } catch (e) {
      Alert.alert("Submit Failed", (e as Error).message);
    } finally {
      setSyncingId(null);
    }
  }, [isOnline, user]);

  const pendingDrafts = drafts.filter((d) => d.pendingSync);
  const regularDrafts = drafts.filter((d) => !d.pendingSync);

  return (
    <View style={ss.root}>
      <View style={[ss.header, { paddingTop: insets.top + webTop }]}>
        <Pressable onPress={() => router.back()} style={ss.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={ss.headerTitle}>Saved Drafts</Text>
          {drafts.length > 0 && (
            <Text style={ss.headerSub}>{drafts.length} draft{drafts.length !== 1 ? "s" : ""} saved</Text>
          )}
        </View>
        <Pressable
          onPress={() => router.push("/candidate/register")}
          style={ss.newBtn}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={ss.newBtnText}>New</Text>
        </Pressable>
      </View>

      {!isOnline && (
        <View style={ss.offlineBanner}>
          <Feather name="wifi-off" size={13} color="#fff" />
          <Text style={ss.offlineText}>Offline — connect to submit drafts</Text>
        </View>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDrafts} />}
        contentContainerStyle={[ss.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {loading && drafts.length === 0 ? (
          <View style={ss.emptyWrap}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : drafts.length === 0 ? (
          <View style={ss.emptyWrap}>
            <Feather name="folder" size={48} color="#D1D5DB" />
            <Text style={ss.emptyTitle}>No Drafts</Text>
            <Text style={ss.emptySub}>Start filling a form and it will auto-save here.</Text>
            <Pressable
              onPress={() => router.push("/candidate/register")}
              style={ss.startBtn}
            >
              <Feather name="user-plus" size={16} color="#fff" />
              <Text style={ss.startBtnText}>Start New Registration</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {pendingDrafts.length > 0 && (
              <>
                <View style={ss.sectionLabel}>
                  <Feather name="clock" size={13} color="#92400E" />
                  <Text style={[ss.sectionLabelText, { color: "#92400E" }]}>
                    Pending Sync ({pendingDrafts.length})
                  </Text>
                </View>
                {pendingDrafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    isOnline={isOnline}
                    syncing={syncingId === draft.id}
                    onEdit={() => router.push({ pathname: "/candidate/register", params: { draftId: draft.id } })}
                    onDelete={() => handleDelete(draft.id, draft.name)}
                    onSubmit={() => void handleSubmitDraft(draft)}
                  />
                ))}
              </>
            )}

            {regularDrafts.length > 0 && (
              <>
                <View style={ss.sectionLabel}>
                  <Feather name="save" size={13} color={ACCENT} />
                  <Text style={ss.sectionLabelText}>In Progress ({regularDrafts.length})</Text>
                </View>
                {regularDrafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    isOnline={isOnline}
                    syncing={syncingId === draft.id}
                    onEdit={() => router.push({ pathname: "/candidate/register", params: { draftId: draft.id } })}
                    onDelete={() => handleDelete(draft.id, draft.name)}
                    onSubmit={() => void handleSubmitDraft(draft)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DraftCard({ draft, isOnline, syncing, onEdit, onDelete, onSubmit }: {
  draft: CandidateDraft;
  isOnline: boolean;
  syncing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSubmit: () => void;
}) {
  const pct = calcProgress(draft);
  const imgCount = countImages(draft);

  return (
    <View style={[ss.card, draft.pendingSync && ss.cardPending]}>
      <View style={ss.cardTop}>
        {draft.photo ? (
          <Image source={{ uri: draft.photo.uri }} style={ss.thumb} />
        ) : (
          <View style={[ss.thumb, ss.thumbEmpty]}>
            <Feather name="user" size={20} color="#9CA3AF" />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={ss.cardName} numberOfLines={1}>
            {draft.name || "Unnamed Draft"}
          </Text>
          {draft.phone ? (
            <Text style={ss.cardPhone}>{draft.phone}</Text>
          ) : null}
          <View style={ss.cardMeta}>
            {draft.village ? (
              <View style={ss.metaChip}>
                <Feather name="map-pin" size={10} color={MUTED} />
                <Text style={ss.metaText}>{draft.village}</Text>
              </View>
            ) : null}
            {draft.course ? (
              <View style={ss.metaChip}>
                <Feather name="book" size={10} color={MUTED} />
                <Text style={ss.metaText}>{draft.course}</Text>
              </View>
            ) : null}
            {imgCount > 0 ? (
              <View style={ss.metaChip}>
                <Feather name="paperclip" size={10} color={MUTED} />
                <Text style={ss.metaText}>{imgCount} doc{imgCount !== 1 ? "s" : ""}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {draft.pendingSync && (
          <View style={ss.syncBadge}>
            <Feather name="clock" size={10} color="#92400E" />
            <Text style={ss.syncBadgeText}>Pending</Text>
          </View>
        )}
      </View>

      <View style={ss.progressRow}>
        <ProgressBar pct={pct} />
        <Text style={ss.pctText}>{pct}% filled</Text>
      </View>

      <Text style={ss.dateText}>Saved: {formatDate(draft.savedAt)}</Text>

      <View style={ss.cardActions}>
        <Pressable onPress={onEdit} style={({ pressed }) => [ss.actionBtn, ss.actionBtnPrimary, { opacity: pressed ? 0.8 : 1 }]}>
          <Feather name="edit-2" size={14} color="#fff" />
          <Text style={ss.actionBtnPrimaryText}>Continue Editing</Text>
        </Pressable>
        {isOnline ? (
          <Pressable
            onPress={onSubmit}
            disabled={syncing}
            style={({ pressed }) => [ss.actionBtn, ss.actionBtnSubmit, { opacity: pressed || syncing ? 0.7 : 1 }]}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={SUCCESS_GREEN} />
            ) : (
              <Feather name="send" size={14} color={SUCCESS_GREEN} />
            )}
            <Text style={ss.actionBtnSubmitText}>{syncing ? "Submitting..." : "Submit Now"}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDelete}
          hitSlop={6}
          style={({ pressed }) => [ss.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="trash-2" size={16} color="#DC2626" />
        </Pressable>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F3F4F6" },
  header: {
    backgroundColor: HEADER_BG,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 10,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold",
  },
  headerSub: {
    color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1,
  },
  newBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7,
  },
  newBtnText: {
    color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold",
  },
  offlineBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#B91C1C", paddingHorizontal: 16, paddingVertical: 7,
  },
  offlineText: {
    color: "#fff", fontSize: 12, fontFamily: "Inter_400Regular",
  },
  scroll: { padding: 14, gap: 0 },
  emptyWrap: {
    alignItems: "center", justifyContent: "center",
    paddingTop: 80, gap: 12,
  },
  emptyTitle: {
    fontSize: 18, fontFamily: "Inter_700Bold", color: "#374151",
  },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: MUTED,
    textAlign: "center", maxWidth: 260,
  },
  startBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12,
    marginTop: 8,
  },
  startBtnText: {
    color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold",
  },
  sectionLabel: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 8, paddingHorizontal: 4,
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: ACCENT,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cardPending: {
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
  },
  cardTop: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
  },
  thumb: {
    width: 52, height: 52, borderRadius: 6,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  thumbEmpty: {
    backgroundColor: "#F9FAFB",
    alignItems: "center", justifyContent: "center",
  },
  cardName: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827",
  },
  cardPhone: {
    fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED,
  },
  cardMeta: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2,
  },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#F3F4F6", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  metaText: {
    fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280",
  },
  syncBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FEF3C7",
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
  },
  syncBadgeText: {
    fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#92400E",
  },
  progressRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  progTrack: {
    flex: 1, height: 5, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden",
  },
  progFill: {
    height: 5, backgroundColor: ACCENT, borderRadius: 3,
  },
  pctText: {
    fontSize: 11, fontFamily: "Inter_500Medium", color: MUTED, width: 52, textAlign: "right",
  },
  dateText: {
    fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF",
  },
  cardActions: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2,
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8,
  },
  actionBtnPrimary: {
    backgroundColor: ACCENT, flex: 1, justifyContent: "center",
  },
  actionBtnPrimaryText: {
    color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold",
  },
  actionBtnSubmit: {
    borderWidth: 1, borderColor: SUCCESS_GREEN, flex: 1, justifyContent: "center",
    backgroundColor: "#F0FFF4",
  },
  actionBtnSubmitText: {
    color: SUCCESS_GREEN, fontSize: 12, fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    width: 38, height: 38, alignItems: "center", justifyContent: "center",
    borderRadius: 6, borderWidth: 1, borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
});
