import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_H    = 50;
const VISIBLE   = 5;
const PAD_COUNT = Math.floor(VISIBLE / 2); // 2 padding items top/bottom

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NUMS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

const MIN_AGE = 18;
const MAX_AGE = 35;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function calcAge(dob: string): number | null {
  const parts = dob.split("/");
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]!, 10);
  const m = parseInt(parts[1]!, 10);
  const y = parseInt(parts[2]!, 10);
  if (!d || !m || !y || y < 1900) return null;
  const birth = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
  return isNaN(age) ? null : age;
}

// ─── Wheel Picker ─────────────────────────────────────────────────────────────

type WheelProps = {
  items: string[];
  selected: string;
  onChange: (val: string) => void;
  width?: number;
  label?: string;
};

function WheelPicker({ items, selected, onChange, width = 88, label }: WheelProps) {
  const colors = useColors();
  const ref    = useRef<FlatList<string>>(null);
  const idx    = useMemo(() => {
    const i = items.indexOf(selected);
    return i >= 0 ? i : 0;
  }, [items, selected]);

  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.scrollToIndex({ index: idx, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [idx]);

  const onScrollEnd = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y   = e.nativeEvent.contentOffset.y;
    const raw = Math.round(y / ITEM_H);
    const ci  = Math.max(0, Math.min(raw, items.length - 1));
    if (items[ci] !== selected) onChange(items[ci]!);
  }, [items, selected, onChange]);

  const data = useMemo(
    () => [...Array(PAD_COUNT).fill("__pad__"), ...items, ...Array(PAD_COUNT).fill("__pad__")],
    [items],
  );

  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      {label && (
        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 4, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" }}>
          {label}
        </Text>
      )}
      <View style={{ width, height: ITEM_H * VISIBLE, overflow: "hidden" }}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center" }]}>
          <View style={{
            width: width - 4,
            height: ITEM_H - 4,
            backgroundColor: colors.primary + "18",
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.primary + "55",
          }} />
        </View>
        <FlatList
          ref={ref}
          data={data}
          keyExtractor={(item, i) => `${item}_${i}`}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate={Platform.OS === "android" ? 0.98 : "fast"}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
          renderItem={({ item, index }) => {
            const realIdx = index - PAD_COUNT;
            const realItem = realIdx >= 0 && realIdx < items.length ? items[realIdx] : "";
            const isSel = realItem === selected;
            const isPad = item === "__pad__";
            return (
              <View style={{ height: ITEM_H, justifyContent: "center", alignItems: "center" }}>
                <Text style={{
                  fontSize: isSel ? 20 : 15,
                  fontFamily: isSel ? "Inter_700Bold" : "Inter_400Regular",
                  color: isPad ? "transparent" : isSel ? colors.primary : colors.foreground + "66",
                }}>
                  {isPad ? "·" : realItem}
                </Text>
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}

// ─── Public Component ─────────────────────────────────────────────────────────

type DobPickerProps = {
  value: string;            // DD/MM/YYYY or ""
  onChange: (dob: string, age: number | null) => void;
  error?: string;
  required?: boolean;
};

export function DobPickerField({ value, onChange, error, required }: DobPickerProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - MIN_AGE;   // 18 years back
  const minYear = currentYear - MAX_AGE - 10; // add 10 extra years for flexibility

  const YEARS  = useMemo(() => {
    const arr: string[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(String(y));
    return arr;
  }, [maxYear, minYear]);

  const defaultYear  = String(currentYear - 25);
  const defaultMonth = "01";
  const defaultDay   = "01";

  const parseValue = () => {
    if (!value) return { d: defaultDay, m: defaultMonth, y: defaultYear };
    const parts = value.split("/");
    if (parts.length === 3) return { d: parts[0]!, m: parts[1]!, y: parts[2]! };
    return { d: defaultDay, m: defaultMonth, y: defaultYear };
  };

  const parsed = parseValue();
  const [selYear,  setSelYear]  = useState(parsed.y);
  const [selMonth, setSelMonth] = useState(parsed.m);
  const [selDay,   setSelDay]   = useState(parsed.d);

  useEffect(() => {
    if (open) {
      const p = parseValue();
      setSelYear(p.y);
      setSelMonth(p.m);
      setSelDay(p.d);
    }
  }, [open]);

  const days = useMemo(() => {
    const count = daysInMonth(parseInt(selYear, 10), parseInt(selMonth, 10));
    return Array.from({ length: count }, (_, i) => pad2(i + 1));
  }, [selYear, selMonth]);

  useEffect(() => {
    const count = daysInMonth(parseInt(selYear, 10), parseInt(selMonth, 10));
    if (parseInt(selDay, 10) > count) setSelDay(pad2(count));
  }, [selYear, selMonth]);

  const previewDob = `${selDay}/${selMonth}/${selYear}`;
  const previewAge = calcAge(previewDob);

  const ageValid = previewAge !== null && previewAge >= MIN_AGE && previewAge <= MAX_AGE;
  const isFuture = (() => {
    const y = parseInt(selYear, 10);
    const m = parseInt(selMonth, 10);
    const d = parseInt(selDay, 10);
    return new Date(y, m - 1, d) > new Date();
  })();

  const ageColor = isFuture
    ? colors.destructive
    : previewAge === null ? colors.mutedForeground
    : ageValid ? colors.success
    : colors.destructive;

  const ageMsg = isFuture
    ? "Future date select nahi kar sakte"
    : previewAge === null ? ""
    : ageValid ? `Age: ${previewAge} years`
    : previewAge < MIN_AGE
      ? `Too young — minimum age ${MIN_AGE} years (Age: ${previewAge})`
      : `Too old — maximum age ${MAX_AGE} years (Age: ${previewAge})`;

  const canConfirm = !isFuture && ageValid;

  const handleConfirm = () => {
    onChange(previewDob, previewAge);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("", null);
    setOpen(false);
  };

  const displayLabel = value ? value : "DD/MM/YYYY";
  const hasValue     = !!value;
  const age          = calcAge(value);

  const fieldError = error;

  return (
    <>
      {/* Tappable DOB Field */}
      <Pressable onPress={() => setOpen(true)} style={{ flex: 1 }}>
        <View style={[
          styles.fieldWrap,
          {
            borderColor: fieldError ? colors.destructive : colors.border,
            backgroundColor: colors.card,
          },
        ]}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Date of Birth / जन्म तिथि{required ? <Text style={{ color: "#DC2626" }}> *</Text> : null}
          </Text>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldValue, { color: hasValue ? colors.foreground : colors.mutedForeground + "aa" }]}>
              {displayLabel}
            </Text>
            <Feather name="calendar" size={16} color={colors.primary} />
          </View>
          {hasValue && age !== null && (
            <Text style={{ fontSize: 11, color: colors.success, fontFamily: "Inter_600SemiBold", marginTop: 2 }}>
              Age: {age} years
            </Text>
          )}
          {fieldError ? (
            <Text style={{ fontSize: 11, color: colors.destructive, marginTop: 2, fontFamily: "Inter_400Regular" }}>
              {fieldError}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* Picker Modal */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            📅  Date of Birth चुनें
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Year → Month → Day क्रम से select करें
          </Text>

          {/* Three wheels */}
          <View style={styles.wheelsRow}>
            <WheelPicker
              label="Year / वर्ष"
              items={YEARS}
              selected={selYear}
              onChange={setSelYear}
            />
            <View style={{ width: 1, backgroundColor: "#E2E8F088", marginTop: 20 }} />
            <WheelPicker
              label="Month / माह"
              items={MONTH_NUMS}
              selected={selMonth}
              onChange={setSelMonth}
              width={72}
            />
            <View style={{ width: 1, backgroundColor: "#E2E8F088", marginTop: 20 }} />
            <WheelPicker
              label="Day / दिन"
              items={days}
              selected={selDay}
              onChange={setSelDay}
              width={72}
            />
          </View>

          {/* Preview + age */}
          <View style={[styles.preview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.previewDate, { color: colors.foreground }]}>
              {selDay} {MONTHS[parseInt(selMonth, 10) - 1]} {selYear}
            </Text>
            {ageMsg ? (
              <Text style={[styles.previewAge, { color: ageColor }]}>
                {ageMsg}
              </Text>
            ) : null}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
              onPress={handleClear}
            >
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnPrimary,
                { backgroundColor: canConfirm ? colors.primary : colors.muted },
              ]}
              onPress={handleConfirm}
              disabled={!canConfirm}
            >
              <Text style={[styles.btnText, { color: canConfirm ? colors.primaryForeground : colors.mutedForeground }]}>
                Confirm ✓
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fieldWrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 56,
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldValue: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 16,
  },
  wheelsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    marginBottom: 16,
    gap: 4,
  },
  preview: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  previewDate: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  previewAge: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnPrimary: {},
  btnSecondary: {
    borderWidth: 1.5,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
