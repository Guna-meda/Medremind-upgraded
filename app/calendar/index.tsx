import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, FlatList, Dimensions, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getMedications, getDoseHistory, recordDose, Medication, DoseHistory } from "../../utils/storage";
import { useFocusEffect } from "@react-navigation/native";

const { width } = Dimensions.get("window");
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const S_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Pure teal palette
const C = {
  primary:     "#037482",
  primaryDark: "#025a64",
  teal10:      "#D3EEF5",
  teal40:      "#57C3DC",
  bg:          "#eef8fb",
  text:        "#0d2f36",
  textSub:     "#3a7580",
  textMuted:   "#7ab5c0",
  surface:     "#ffffff",
  success:     "#0d9488",   // teal-600 instead of emerald
  danger:      "#c0392b",
};

// Teal shades only for card accents
const MED_TONES = [
  "#037482", "#025a64", "#048fa6", "#57C3DC",
  "#0a9bb5", "#0e7490", "#2dd4bf", "#0891b2",
];

function generateDays() {
  const days: Date[] = [];
  const today = new Date();
  for (let i = -30; i <= 90; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Is date1 strictly before date2 (ignoring time)? */
function isBefore(date1: Date, date2: Date) {
  const d1 = new Date(date1); d1.setHours(0,0,0,0);
  const d2 = new Date(date2); d2.setHours(0,0,0,0);
  return d1 < d2;
}

/** Is date1 strictly after date2 (ignoring time)? */
function isAfter(date1: Date, date2: Date) {
  const d1 = new Date(date1); d1.setHours(0,0,0,0);
  const d2 = new Date(date2); d2.setHours(0,0,0,0);
  return d1 > d2;
}

/** Is a medication active on a given date? */
function isMedActiveOnDate(med: Medication, date: Date): boolean {
  const start = new Date(med.startDate);
  start.setHours(0,0,0,0);
  const check = new Date(date);
  check.setHours(0,0,0,0);

  if (check < start) return false; // hasn't started yet

  if (med.duration === "Ongoing") return true;

  // Parse "X days" from duration label
  const daysMatch = med.duration.match(/(\d+)/);
  if (!daysMatch) return true; // fallback

  const durationDays = parseInt(daysMatch[1]);
  const end = new Date(start);
  end.setDate(start.getDate() + durationDays - 1);
  return check <= end;
}

function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suf = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${m.toString().padStart(2,"0")} ${suf}`;
}

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medications, setMedications]   = useState<Medication[]>([]);
  const [doseHistory, setDoseHistory]   = useState<DoseHistory[]>([]);
  const allDays = useRef(generateDays()).current;
  const calendarRef = useRef<FlatList>(null);
  const todayIndex  = allDays.findIndex(d => d.toDateString() === new Date().toDateString());

  const today      = new Date();
  const isPast     = isBefore(selectedDate, today);
  const isFuture   = isAfter(selectedDate, today);
  const isToday    = selectedDate.toDateString() === today.toDateString();

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [meds, history] = await Promise.all([getMedications(), getDoseHistory()]);
      setMedications(meds);
      setDoseHistory(history);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  React.useEffect(() => {
    setTimeout(() => {
      calendarRef.current?.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0.35 });
    }, 350);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  /** Doses recorded for a specific date */
  const dosesForDate = (date: Date) =>
    doseHistory.filter(d => new Date(d.timestamp).toDateString() === date.toDateString());

  /** Medications active on a date */
  const medsForDate = (date: Date) =>
    medications.filter(m => isMedActiveOnDate(m, date));

  /** Has any recorded dose on that day (for calendar dots) */
  const hasDot = (date: Date) => dosesForDate(date).length > 0;

  const activeMeds = medsForDate(selectedDate);
  const dayDoses   = dosesForDate(selectedDate);

  const isDoseTaken = (medId: string) =>
    dayDoses.some(d => d.medicationId === medId && d.taken);

  // ── Take dose ─────────────────────────────────────────────────────────────
  const handleTake = async (med: Medication) => {
    if (!isToday) return; // safety guard (button hidden for past/future)
    try {
      await recordDose(med.id, true, new Date().toISOString());
      await loadData();
    } catch {
      Alert.alert("Error", "Could not record dose.");
    }
  };

  // ── Render med card ───────────────────────────────────────────────────────
  const renderMedCard = (med: Medication, idx: number) => {
    const taken   = isDoseTaken(med.id);
    const accent  = MED_TONES[idx % MED_TONES.length];
    const canTake = isToday && !taken;

    return (
      <View key={med.id} style={[st.medCard, taken && { opacity: 0.72 }]}>
        <View style={[st.medStripe, { backgroundColor: accent }]} />
        <View style={[st.medIcon, { backgroundColor: `${accent}22` }]}>
          <Ionicons name="medical" size={20} color={accent} />
        </View>
        <View style={st.medInfo}>
          <Text style={st.medName}>{med.name}</Text>
          <Text style={st.medDosage}>{med.dosage}</Text>
          {med.times.length > 0 && (
            <View style={st.timesRow}>
              <Ionicons name="alarm-outline" size={12} color={C.textMuted} />
              <Text style={st.timesText}>
                {med.times.map(formatTime12).join("  ·  ")}
              </Text>
            </View>
          )}
        </View>

        {/* Right badge */}
        {isPast && (
          taken ? (
            <View style={[st.badge, { backgroundColor: "#d0f5f0" }]}>
              <Ionicons name="checkmark-circle" size={16} color={C.success} />
              <Text style={[st.badgeText, { color: C.success }]}>Taken</Text>
            </View>
          ) : (
            <View style={[st.badge, { backgroundColor: "#fde9e7" }]}>
              <Ionicons name="close-circle" size={16} color={C.danger} />
              <Text style={[st.badgeText, { color: C.danger }]}>Missed</Text>
            </View>
          )
        )}

        {isFuture && (
          <View style={[st.badge, { backgroundColor: C.teal10 }]}>
            <Ionicons name="time-outline" size={15} color={C.textMuted} />
            <Text style={[st.badgeText, { color: C.textMuted }]}>Upcoming</Text>
          </View>
        )}

        {isToday && (
          taken ? (
            <View style={[st.badge, { backgroundColor: "#d0f5f0" }]}>
              <Ionicons name="checkmark-circle" size={16} color={C.success} />
              <Text style={[st.badgeText, { color: C.success }]}>Done</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[st.takeBtn, { backgroundColor: accent }]}
              onPress={() => handleTake(med)}
              activeOpacity={0.82}
            >
              <Text style={st.takeBtnText}>Take</Text>
            </TouchableOpacity>
          )
        )}
      </View>
    );
  };

  // ── Empty states ──────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <View style={st.emptyState}>
      <View style={st.emptyIcon}>
        <Ionicons name="medical-outline" size={28} color={C.textMuted} />
      </View>
      <Text style={st.emptyTitle}>
        {isFuture ? "No medications scheduled" : "No medications on this day"}
      </Text>
      {!isFuture && (
        <TouchableOpacity style={st.emptyBtn} onPress={() => router.push("/medications/add" as any)}>
          <Ionicons name="add" size={16} color="white" />
          <Text style={st.emptyBtnText}>Add Medication</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <View style={st.container}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={st.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={st.headerDec} />
        <View style={st.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <Ionicons name="chevron-back" size={22} color="white" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Calendar</Text>
          <TouchableOpacity
            style={st.todayPill}
            onPress={() => {
              setSelectedDate(new Date());
              calendarRef.current?.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0.35 });
            }}
          >
            <Text style={st.todayPillText}>Today</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Horizontal calendar strip */}
      <View style={st.calStrip}>
        <View style={st.stripHead}>
          <Text style={st.stripMonth}>{MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}</Text>
        </View>
        <FlatList
          ref={calendarRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          data={allDays}
          keyExtractor={d => d.toISOString()}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 7, paddingBottom: 10 }}
          getItemLayout={(_, i) => ({ length: 56, offset: (56 + 7) * i, index: i })}
          renderItem={({ item: day }) => {
            const isSel   = day.toDateString() === selectedDate.toDateString();
            const isT     = day.toDateString() === today.toDateString();
            const dot     = hasDot(day);
            return (
              <TouchableOpacity
                style={[st.dayCell, isSel && st.dayCellSel, isT && !isSel && st.dayCellToday]}
                onPress={() => setSelectedDate(day)}
                activeOpacity={0.75}
              >
                <Text style={[st.dayCellName, isSel && st.dayCellTextSel]}>{DAYS[day.getDay()]}</Text>
                <Text style={[st.dayCellNum, isSel && st.dayCellTextSel, isT && !isSel && { color: C.primary }]}>
                  {day.getDate()}
                </Text>
                {dot
                  ? <View style={[st.dot, isSel && { backgroundColor: "rgba(255,255,255,0.85)" }]} />
                  : <View style={st.dotPlaceholder} />
                }
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Schedule list */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.listContent} showsVerticalScrollIndicator={false}>
        {/* Day heading */}
        <View style={st.dayHead}>
          <View style={[st.dateBadge, isPast && { backgroundColor: C.textMuted }, isFuture && { backgroundColor: C.teal40 }]}>
            <Text style={st.dateBadgeNum}>{selectedDate.getDate()}</Text>
            <Text style={st.dateBadgeMon}>{S_MONTHS[selectedDate.getMonth()]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={st.dayName}>
                {DAYS[selectedDate.getDay()]}
                {isToday ? " · Today" : ""}
              </Text>
              {isPast && (
                <View style={st.pastTag}>
                  <Text style={st.pastTagText}>Past</Text>
                </View>
              )}
              {isFuture && (
                <View style={st.futureTag}>
                  <Text style={st.futureTagText}>Upcoming</Text>
                </View>
              )}
            </View>
            <Text style={st.daySub}>
              {activeMeds.length} medication{activeMeds.length !== 1 ? "s" : ""} scheduled
            </Text>
          </View>
        </View>

        {/* Past day info banner */}
        {isPast && (
          <View style={st.infoBanner}>
            <Ionicons name="information-circle-outline" size={17} color={C.primary} />
            <Text style={st.infoBannerText}>Past date — showing history only. Mark doses from today's screen.</Text>
          </View>
        )}
        {isFuture && (
          <View style={st.infoBanner}>
            <Ionicons name="calendar-outline" size={17} color={C.primary} />
            <Text style={st.infoBannerText}>Upcoming — scheduled medications are listed below.</Text>
          </View>
        )}

        {/* Medication cards */}
        {activeMeds.length === 0 ? renderEmpty() : activeMeds.map(renderMedCard)}

        {/* Summary for past days */}
        {isPast && activeMeds.length > 0 && (
          <View style={st.summaryCard}>
            <Text style={st.summaryTitle}>Day Summary</Text>
            <View style={st.summaryRow}>
              <View style={[st.summaryStat, { backgroundColor: "#d0f5f0" }]}>
                <Text style={[st.summaryNum, { color: C.success }]}>
                  {dayDoses.filter(d => d.taken).length}
                </Text>
                <Text style={[st.summaryLabel, { color: C.success }]}>Taken</Text>
              </View>
              <View style={[st.summaryStat, { backgroundColor: "#fde9e7" }]}>
                <Text style={[st.summaryNum, { color: C.danger }]}>
                  {activeMeds.length - dayDoses.filter(d => d.taken).length}
                </Text>
                <Text style={[st.summaryLabel, { color: C.danger }]}>Missed</Text>
              </View>
              <View style={[st.summaryStat, { backgroundColor: C.teal10 }]}>
                <Text style={[st.summaryNum, { color: C.primary }]}>
                  {activeMeds.length > 0
                    ? Math.round((dayDoses.filter(d => d.taken).length / activeMeds.length) * 100)
                    : 0}%
                </Text>
                <Text style={[st.summaryLabel, { color: C.textSub }]}>Rate</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#eef8fb" },
  header:         { paddingTop: Platform.OS === "ios" ? 56 : 36, paddingBottom: 20, overflow: "hidden" },
  headerDec:      { position: "absolute", top: -40, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)" },
  headerRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  backBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle:    { flex: 1, fontSize: 22, fontWeight: "800", color: "white", marginLeft: 12 },
  todayPill:      { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  todayPillText:  { color: "white", fontWeight: "700", fontSize: 13 },

  calStrip:    { backgroundColor: "white", paddingTop: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  stripHead:   { paddingHorizontal: 18, marginBottom: 10 },
  stripMonth:  { fontSize: 15, fontWeight: "700", color: "#0d2f36" },
  dayCell:     { width: 56, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: "#D3EEF5" },
  dayCellSel:  { backgroundColor: "#037482" },
  dayCellToday:{ borderWidth: 2, borderColor: "#037482", backgroundColor: "white" },
  dayCellName: { fontSize: 10, color: "#7ab5c0", fontWeight: "700", marginBottom: 4 },
  dayCellNum:  { fontSize: 17, fontWeight: "800", color: "#0d2f36" },
  dayCellTextSel: { color: "white" },
  dot:         { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#037482", marginTop: 4 },
  dotPlaceholder: { width: 5, height: 5, marginTop: 4 },

  listContent: { padding: 18, paddingBottom: 40 },

  dayHead:       { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  dateBadge:     { width: 54, height: 54, borderRadius: 15, backgroundColor: "#037482", alignItems: "center", justifyContent: "center" },
  dateBadgeNum:  { fontSize: 21, fontWeight: "800", color: "white" },
  dateBadgeMon:  { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  dayName:       { fontSize: 18, fontWeight: "800", color: "#0d2f36" },
  daySub:        { fontSize: 13, color: "#3a7580", marginTop: 3 },
  pastTag:       { backgroundColor: "#e8f0f1", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pastTagText:   { fontSize: 11, color: "#7ab5c0", fontWeight: "700" },
  futureTag:     { backgroundColor: "#D3EEF5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  futureTagText: { fontSize: 11, color: "#037482", fontWeight: "700" },

  infoBanner:     { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#D3EEF5", borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: "#037482" },
  infoBannerText: { flex: 1, fontSize: 13, color: "#025a64", lineHeight: 18 },

  medCard:   { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: "#037482", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, overflow: "hidden" },
  medStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  medIcon:   { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 4, marginRight: 12 },
  medInfo:   { flex: 1 },
  medName:   { fontSize: 15, fontWeight: "700", color: "#0d2f36", marginBottom: 2 },
  medDosage: { fontSize: 13, color: "#3a7580", marginBottom: 4 },
  timesRow:  { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  timesText: { fontSize: 12, color: "#7ab5c0" },

  badge:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginLeft: 6 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  takeBtn:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginLeft: 8 },
  takeBtnText: { color: "white", fontWeight: "700", fontSize: 13 },

  emptyState: { alignItems: "center", paddingVertical: 44 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 32, backgroundColor: "#D3EEF5", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0d2f36", marginBottom: 16, textAlign: "center" },
  emptyBtn:   { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#037482", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: "white", fontWeight: "700", fontSize: 14 },

  summaryCard:  { backgroundColor: "white", borderRadius: 16, padding: 16, marginTop: 10, shadowColor: "#037482", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  summaryTitle: { fontSize: 14, fontWeight: "700", color: "#0d2f36", marginBottom: 12 },
  summaryRow:   { flexDirection: "row", gap: 10 },
  summaryStat:  { flex: 1, alignItems: "center", borderRadius: 12, paddingVertical: 12 },
  summaryNum:   { fontSize: 22, fontWeight: "800" },
  summaryLabel: { fontSize: 12, fontWeight: "600", marginTop: 2 },
});
