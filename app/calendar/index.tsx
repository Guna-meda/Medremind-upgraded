import React, { useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, FlatList, Dimensions, Animated } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getMedications, getDoseHistory, recordDose, Medication, DoseHistory } from "../../utils/storage";
import { useFocusEffect } from "@react-navigation/native";

const { width } = Dimensions.get("window");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const C = {
  primary: "#047382", primaryDark: "#035a66", primaryLight: "#058a9a",
  teal10: "#e8f6f8", teal20: "#c5eaee", bg: "#f0f9fa", surface: "#ffffff",
  text: "#1a2e35", textSub: "#5a8490", textMuted: "#9ab5bc",
  success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
};

function generateDays() {
  const days = [];
  const today = new Date();
  for (let i = -14; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseHistory, setDoseHistory] = useState<DoseHistory[]>([]);
  const allDays = generateDays();
  const calendarRef = useRef<FlatList>(null);
  const todayIndex = allDays.findIndex(d => d.toDateString() === new Date().toDateString());

  const loadData = useCallback(async () => {
    try {
      const [meds, history] = await Promise.all([getMedications(), getDoseHistory()]);
      setMedications(meds);
      setDoseHistory(history);
    } catch (error) {}
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  React.useEffect(() => {
    setTimeout(() => {
      calendarRef.current?.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0.3 });
    }, 300);
  }, []);

  const getDayDoses = (date: Date) => doseHistory.filter(d => new Date(d.timestamp).toDateString() === date.toDateString());
  const hasDoses = (date: Date) => getDayDoses(date).length > 0;

  const renderMedicationsForDate = () => {
    const dayDoses = getDayDoses(selectedDate);
    if (medications.length === 0) return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}><Ionicons name="medical-outline" size={28} color={C.textMuted} /></View>
        <Text style={styles.emptyTitle}>No medications found</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/medications/add" as any)}>
          <Ionicons name="add" size={16} color="white" />
          <Text style={styles.emptyBtnText}>Add Medication</Text>
        </TouchableOpacity>
      </View>
    );

    return medications.map((med, i) => {
      const taken = dayDoses.some(d => d.medicationId === med.id && d.taken);
      const colors = [C.primary, "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6"];
      const color = colors[i % colors.length];
      return (
        <View key={med.id} style={[styles.medCard, taken && { opacity: 0.75 }]}>
          <View style={[styles.medStripe, { backgroundColor: color }]} />
          <View style={[styles.medIcon, { backgroundColor: `${color}18` }]}>
            <Ionicons name="medical" size={20} color={color} />
          </View>
          <View style={styles.medInfo}>
            <Text style={styles.medName}>{med.name}</Text>
            <Text style={styles.medDosage}>{med.dosage}</Text>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={12} color={C.textMuted} />
              <Text style={styles.timeText}>{med.times[0]}</Text>
            </View>
          </View>
          {taken ? (
            <View style={styles.takenBadge}>
              <Ionicons name="checkmark-circle" size={18} color={C.success} />
              <Text style={styles.takenText}>Done</Text>
            </View>
          ) : (
            <TouchableOpacity style={[styles.takeBtn, { backgroundColor: color }]} onPress={async () => { await recordDose(med.id, true, new Date().toISOString()); loadData(); }} activeOpacity={0.8}>
              <Text style={styles.takeBtnText}>Take</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.headerGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerDecCircle} />
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Calendar</Text>
          <TouchableOpacity style={styles.todayPill} onPress={() => { setSelectedDate(new Date()); calendarRef.current?.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0.3 }); }}>
            <Text style={styles.todayPillText}>Today</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Horizontal calendar strip */}
      <View style={styles.calStrip}>
        <View style={styles.stripHeader}>
          <Text style={styles.stripMonth}>{MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}</Text>
        </View>
        <FlatList
          ref={calendarRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          data={allDays}
          keyExtractor={d => d.toISOString()}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}
          getItemLayout={(_, index) => ({ length: 54, offset: (54 + 8) * index, index })}
          renderItem={({ item: day }) => {
            const isSelected = day.toDateString() === selectedDate.toDateString();
            const isToday = day.toDateString() === new Date().toDateString();
            const hasDot = hasDoses(day);
            return (
              <TouchableOpacity style={[styles.dayCell, isSelected && styles.dayCellSelected, isToday && !isSelected && styles.dayCellToday]} onPress={() => setSelectedDate(day)} activeOpacity={0.7}>
                <Text style={[styles.dayCellDay, isSelected && styles.dayCellTextSel]}>{DAYS[day.getDay()]}</Text>
                <Text style={[styles.dayCellNum, isSelected && styles.dayCellTextSel, isToday && !isSelected && { color: C.primary }]}>{day.getDate()}</Text>
                {hasDot && <View style={[styles.dayCellDot, isSelected && { backgroundColor: "rgba(255,255,255,0.8)" }]} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scheduleContent} showsVerticalScrollIndicator={false}>
        <View style={styles.schedHeader}>
          <View style={styles.schedDateBadge}>
            <Text style={styles.schedDateNum}>{selectedDate.getDate()}</Text>
            <Text style={styles.schedDateMonth}>{SHORT_MONTHS[selectedDate.getMonth()]}</Text>
          </View>
          <View>
            <Text style={styles.schedDay}>{DAYS[selectedDate.getDay()]}{selectedDate.toDateString() === new Date().toDateString() ? " · Today" : ""}</Text>
            <Text style={styles.schedSub}>{medications.length} medication{medications.length !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        {renderMedicationsForDate()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerGrad: { paddingTop: Platform.OS === "ios" ? 56 : 36, paddingBottom: 20, overflow: "hidden" },
  headerDecCircle: { position: "absolute", top: -40, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)" },
  headerTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: "white", marginLeft: 12 },
  todayPill: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  todayPillText: { color: "white", fontWeight: "700", fontSize: 13 },
  calStrip: { backgroundColor: "white", paddingTop: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  stripHeader: { paddingHorizontal: 20, marginBottom: 10 },
  stripMonth: { fontSize: 15, fontWeight: "700", color: C.text },
  dayCell: { width: 54, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: C.teal10 },
  dayCellSelected: { backgroundColor: C.primary },
  dayCellToday: { borderWidth: 1.5, borderColor: C.primary, backgroundColor: "white" },
  dayCellDay: { fontSize: 10, color: C.textMuted, fontWeight: "600", marginBottom: 4 },
  dayCellNum: { fontSize: 17, fontWeight: "800", color: C.text },
  dayCellTextSel: { color: "white" },
  dayCellDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.primary, marginTop: 4 },
  scheduleContent: { padding: 20, paddingBottom: 40 },
  schedHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  schedDateBadge: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  schedDateNum: { fontSize: 20, fontWeight: "800", color: "white" },
  schedDateMonth: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  schedDay: { fontSize: 18, fontWeight: "700", color: C.text },
  schedSub: { fontSize: 13, color: C.textSub, marginTop: 2 },
  medCard: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: "#047382", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, overflow: "hidden" },
  medStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  medIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 4, marginRight: 12 },
  medInfo: { flex: 1 },
  medName: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 2 },
  medDosage: { fontSize: 13, color: C.textSub, marginBottom: 4 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { fontSize: 12, color: C.textMuted },
  takeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginLeft: 8 },
  takeBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
  takenBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#d1fae5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginLeft: 8 },
  takenText: { color: C.success, fontWeight: "700", fontSize: 13 },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.teal10, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 16 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
});
