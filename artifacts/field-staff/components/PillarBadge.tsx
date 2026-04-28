import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export type Pillar = "discipline" | "transparency" | "accuracy" | "control";

const map: Record<
  Pillar,
  { label: string; icon: keyof typeof Feather.glyphMap; tone: string }
> = {
  discipline: { label: "Discipline", icon: "shield", tone: "pillarDiscipline" },
  transparency: { label: "Transparency", icon: "eye", tone: "pillarTransparency" },
  accuracy: { label: "Accuracy", icon: "target", tone: "pillarAccuracy" },
  control: { label: "Control", icon: "sliders", tone: "pillarControl" },
};

export function PillarBadge({ pillar }: { pillar: Pillar }) {
  const colors = useColors() as ReturnType<typeof useColors> & Record<string, string>;
  const cfg = map[pillar];
  const tint = (colors as Record<string, string>)[cfg.tone] || colors.primary;
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: tint + "14",
          borderColor: tint + "33",
          borderRadius: 999,
        },
      ]}
    >
      <Feather name={cfg.icon} size={11} color={tint} />
      <Text style={[styles.text, { color: tint }]}>{cfg.label}</Text>
    </View>
  );
}

export function PillarsRow() {
  return (
    <View style={styles.row}>
      <PillarBadge pillar="discipline" />
      <PillarBadge pillar="transparency" />
      <PillarBadge pillar="accuracy" />
      <PillarBadge pillar="control" />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
