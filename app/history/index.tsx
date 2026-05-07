import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { getDoseHistory, getMedications, DoseHistory, Medication, clearAllData } from "../../utils/storage";

const C = {
  primary: "#047382", primaryDark: "#035a66", teal10: "#e8f6f8",
  bg: "#f0f9fa", text: "#1a2e35", textSub: "#5a8490", textMuted: "#9ab5bc",
  success: "#10b981", danger: "#ef4444", warning: "#f59e0b",
};

type EnrichedDoseHistory = DoseHistory & { medication?: Medication };

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<EnrichedDoseHistory[]>([]);
  const [filter, setFilter] = useState<"all" | "taken" | "missed">("all");

  const loadHistory = useCallback(async () => {
    try {
      const [doseHistory, medications] = await Promise.all([getDoseHistory(), getMedications()]);
      const enriched = doseHistory.map(dose => ({ ...dose, medication: medications.find(m => m.id === dose.medicationId) }));
      setHistory(enriched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error) {}
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const filtered = history.filter(d => filter === "all" ? true : filter === "taken" ? d.taken : !d.taken);

  const grouped = filtered.reduce((acc, dose) => {
    const date = new Date(dose.timestamp).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(dose);
    return acc;
  }, {} as Record<string, EnrichedDoseHistory[]>);

  const groupedEntries = Object.entries(grouped).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

  const takenCount = history.filter(d => d.taken).length;
  const missedCount = history.filter(d => !d.taken).length;
  const adherence = history.length > 0 ? Math.round((takenCount / history.length) * 100) : 0;

  const handleClear = () => {
    Alert.alert("Clear All Data", "This will permanently delete all medication and history data. Cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: async () => { await clearAllData(); await loadHistory(); } },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("default", { weekday: "long", month: "short", day: "numeric" });
  };

  const getMedColor = (i: number) => {
    const colors = [C.primary, "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6"];
    return colors[i % colors.length];
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerDec} />
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>History</Text>
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{adherence}%</Text>
            <Text style={styles.statLabel}>Adherence</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: "#a8f0c6" }]}>{takenCount}</Text>
            <Text style={styles.statLabel}>Taken</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: "#ffd6d6" }]}>{missedCount}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["all", "taken", "missed"] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterTab, filter === f && styles.filterTabActive]} onPress={() => setFilter(f)} activeOpacity={0.7}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {groupedEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="time-outline" size={28} color={C.textMuted} /></View>
            <Text style={styles.emptyTitle}>No history found</Text>
            <Text style={styles.emptySub}>Your dose history will appear here</Text>
          </View>
        ) : (
          groupedEntries.map(([date, doses]) => (
            <View key={date} style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateLabel}>{formatDate(date)}</Text>
                <View style={styles.datePill}>
                  <Text style={styles.datePillText}>{doses.length} dose{doses.length !== 1 ? "s" : ""}</Text>
                </View>
              </View>
              {doses.map((dose, i) => (
                <View key={dose.id} style={styles.doseItem}>
                  <View style={[styles.doseIconWrap, { backgroundColor: dose.taken ? "#d1fae5" : "#fee2e2" }]}>
                    <Ionicons name={dose.taken ? "checkmark-circle" : "close-circle"} size={20} color={dose.taken ? C.success : C.danger} />
                  </View>
                  <View style={styles.doseItemInfo}>
                    <Text style={styles.doseItemName}>{dose.medication?.name || "Unknown Medication"}</Text>
                    <Text style={styles.doseItemDosage}>{dose.medication?.dosage}</Text>
                  </View>
                  <View style={styles.doseRight}>
                    <View style={[styles.doseBadge, { backgroundColor: dose.taken ? "#d1fae5" : "#fee2e2" }]}>
                      <Text style={[styles.doseBadgeText, { color: dose.taken ? C.success : C.danger }]}>
                        {dose.taken ? "Taken" : "Missed"}
                      </Text>
                    </View>
                    <Text style={styles.doseTime}>{new Date(dose.timestamp).toLocaleTimeString("default", { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: Platform.OS === "ios" ? 56 : 36, paddingBottom: 24, overflow: "hidden" },
  headerDec: { position: "absolute", top: -40, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)" },
  headerTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: "white", marginLeft: 12 },
  clearBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, gap: 0 },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 26, fontWeight: "800", color: "white" },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.2)" },
  filterRow: { flexDirection: "row", backgroundColor: "white", paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: "#e8f3f5" },
  filterTab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12, backgroundColor: C.teal10 },
  filterTabActive: { backgroundColor: C.primary },
  filterText: { fontSize: 13, fontWeight: "600", color: C.textSub },
  filterTextActive: { color: "white" },
  dateGroup: { marginBottom: 20 },
  dateHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  dateLabel: { fontSize: 15, fontWeight: "700", color: C.text },
  datePill: { backgroundColor: C.teal10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  datePillText: { fontSize: 11, color: C.primary, fontWeight: "600" },
  doseItem: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, shadowColor: "#047382", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  doseIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  doseItemInfo: { flex: 1 },
  doseItemName: { fontSize: 14, fontWeight: "700", color: C.text },
  doseItemDosage: { fontSize: 12, color: C.textSub, marginTop: 2 },
  doseRight: { alignItems: "flex-end", gap: 4 },
  doseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  doseBadgeText: { fontSize: 11, fontWeight: "700" },
  doseTime: { fontSize: 11, color: C.textMuted },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.teal10, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: C.text, marginBottom: 6 },
  emptySub: { fontSize: 14, color: C.textSub },
});
