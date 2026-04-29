import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useListCandidates } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CandidateListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const { data: candidates, isLoading, refetch, isRefetching } = useListCandidates();

  const handleDownloadPdf = (pdfUrl: string | null | undefined, _name: string) => {
    if (!pdfUrl) return;
    const apiBase = getApiBase();
    Linking.openURL(`${apiBase}${pdfUrl}`);
  };

  const handleExportCsv = () => {
    const apiBase = getApiBase();
    Linking.openURL(`${apiBase}/api/admin/candidates/csv`);
  };

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
          Candidates ({candidates?.length ?? 0})
        </Text>
        <Pressable
          onPress={handleExportCsv}
          style={styles.addBtn}
          hitSlop={8}
          disabled={!candidates || candidates.length === 0}
        >
          <Feather
            name="download"
            size={18}
            color={candidates && candidates.length > 0 ? colors.primary : colors.mutedForeground}
          />
        </Pressable>
        <Pressable
          onPress={() => router.push("/candidate/register")}
          style={styles.addBtn}
          hitSlop={8}
        >
          <Feather name="user-plus" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading candidates…
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {!candidates || candidates.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No candidates yet
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Register the first candidate to get started.
              </Text>
              <Pressable
                onPress={() => router.push("/candidate/register")}
                style={({ pressed }) => [
                  styles.emptyBtn,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Feather name="user-plus" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Register Candidate</Text>
              </Pressable>
            </View>
          ) : (
            candidates.map((c) => (
              <View
                key={c.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius + 2,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: colors.primary + "18", borderRadius: 24 },
                    ]}
                  >
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {c.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: colors.foreground }]}>
                      {c.name}
                    </Text>
                    <Text style={[styles.cardPhone, { color: colors.mutedForeground }]}>
                      {c.phone}
                      {c.area ? ` · ${c.area}` : ""}
                    </Text>
                  </View>
                  <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
                    {formatDate(c.createdAt)}
                  </Text>
                </View>

                {/* Details row */}
                {(c.education || c.caste || c.gender) ? (
                  <View style={styles.cardMeta}>
                    {c.education ? (
                      <View style={[styles.metaChip, { backgroundColor: colors.muted, borderRadius: 6 }]}>
                        <Text style={[styles.metaChipText, { color: colors.mutedForeground }]}>
                          {c.education}
                        </Text>
                      </View>
                    ) : null}
                    {c.caste ? (
                      <View style={[styles.metaChip, { backgroundColor: colors.muted, borderRadius: 6 }]}>
                        <Text style={[styles.metaChipText, { color: colors.mutedForeground }]}>
                          {c.caste}
                        </Text>
                      </View>
                    ) : null}
                    {c.gender ? (
                      <View style={[styles.metaChip, { backgroundColor: colors.muted, borderRadius: 6 }]}>
                        <Text style={[styles.metaChipText, { color: colors.mutedForeground }]}>
                          {c.gender}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Submitted by */}
                {c.submittedBy ? (
                  <Text style={[styles.submittedBy, { color: colors.mutedForeground }]}>
                    Submitted by {c.submittedBy}
                  </Text>
                ) : null}

                {/* PDF download button */}
                <Pressable
                  onPress={() => handleDownloadPdf(c.pdfUrl, c.name)}
                  disabled={!c.pdfUrl}
                  style={({ pressed }) => [
                    styles.pdfBtn,
                    {
                      backgroundColor: c.pdfUrl ? "#1E3A5F" : colors.muted,
                      borderRadius: colors.radius,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Feather
                    name="download"
                    size={14}
                    color={c.pdfUrl ? "#fff" : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.pdfBtnText,
                      { color: c.pdfUrl ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {c.pdfUrl ? "Download Profile PDF" : "PDF not available"}
                  </Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}
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
  addBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  cardName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  cardPhone: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  cardDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  cardMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  submittedBy: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 40,
  },
  pdfBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 260,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
