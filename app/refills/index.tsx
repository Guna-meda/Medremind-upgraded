import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { getMedications, Medication, updateMedication } from "../../utils/storage";
import { scheduleRefillReminder } from "../../utils/notifications";

const C = {
  primary: "#047382", primaryDark: "#035a66", teal10: "#e8f6f8", teal20: "#c5eaee",
  bg: "#f0f9fa", text: "#1a2e35", textSub: "#5a8490", textMuted: "#9ab5bc",
  success: "#10b981", danger: "#ef4444", warning: "#f59e0b",
};

export default function RefillTrackerScreen() {
  const router = useRouter();
  const [medications, setMedications] = useState<Medication[]>([]);

  const loadMedications = useCallback(async () => {
    try { setMedications(await getMedications()); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { loadMedications(); }, [loadMedications]));

  const handleRefill = async (med: Medication) => {
    try {
      await updateMedication({ ...med, currentSupply: med.totalSupply, lastRefillDate: new Date().toISOString() });
      await loadMedications();
      Alert.alert("Refilled!", `${med.name} refilled to ${med.totalSupply} units.`);
    } catch {
      Alert.alert("Error", "Failed to record refill.");
    }
  };

  const getStatus = (med: Medication) => {
    if (!med.totalSupply) return { label: "N/A", color: C.textMuted, bg: C.teal10, pct: 0 };
    const pct = (med.currentSupply / med.totalSupply) * 100;
    if (pct <= 20) return { label: "Critical", color: C.danger, bg: "#fee2e2", pct };
    if (pct <= 40) return { label: "Low", color: C.warning, bg: "#fef3c7", pct };
    return { label: "Good", color: C.success, bg: "#d1fae5", pct };
  };

  const needsRefill = medications.filter(m => m.totalSupply && (m.currentSupply / m.totalSupply) * 100 <= 40);
  const healthy = medications.filter(m => !m.totalSupply || (m.currentSupply / m.totalSupply) * 100 > 40);

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
          <Text style={styles.headerTitle}>Refill Tracker</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{medications.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#ffd6d6" }]}>{needsRefill.length}</Text>
            <Text style={styles.summaryLabel}>Need Refill</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: "#a8f0c6" }]}>{healthy.length}</Text>
            <Text style={styles.summaryLabel}>Stocked</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {needsRefill.length > 0 && (
          <View style={styles.alertBanner}>
            <Ionicons name="warning" size={18} color={C.warning} />
            <Text style={styles.alertText}>{needsRefill.length} medication{needsRefill.length !== 1 ? "s" : ""} need{needsRefill.length === 1 ? "s" : ""} refilling soon</Text>
          </View>
        )}

        {medications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="medical-outline" size={28} color={C.textMuted} /></View>
            <Text style={styles.emptyTitle}>No medications added</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/medications/add" as any)}>
              <Ionicons name="add" size={16} color="white" />
              <Text style={styles.emptyBtnText}>Add Medication</Text>
            </TouchableOpacity>
          </View>
        ) : (
          medications.map((med, i) => {
            const { label, color, bg, pct } = getStatus(med);
            const medColor = getMedColor(i);
            return (
              <View key={med.id} style={styles.medCard}>
                <View style={[styles.medStripe, { backgroundColor: medColor }]} />
                <View style={styles.medTop}>
                  <View style={[styles.medIcon, { backgroundColor: `${medColor}18` }]}>
                    <Ionicons name="medical" size={20} color={medColor} />
                  </View>
                  <View style={styles.medMeta}>
                    <Text style={styles.medName}>{med.name}</Text>
                    <Text style={styles.medDosage}>{med.dosage}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: bg }]}>
                    <Text style={[styles.statusText, { color }]}>{label}</Text>
                  </View>
                </View>

                {med.totalSupply > 0 ? (
                  <>
                    <View style={styles.supplyRow}>
                      <Text style={styles.supplyLabel}>Supply</Text>
                      <Text style={styles.supplyCount}>{med.currentSupply} / {med.totalSupply} units</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
                    </View>
                    {med.lastRefillDate && (
                      <Text style={styles.lastRefill}>Last refilled: {new Date(med.lastRefillDate).toLocaleDateString()}</Text>
                    )}
                    <TouchableOpacity style={[styles.refillBtn, { borderColor: medColor }]} onPress={() => handleRefill(med)} activeOpacity={0.8}>
                      <Ionicons name="refresh-outline" size={16} color={medColor} />
                      <Text style={[styles.refillBtnText, { color: medColor }]}>Record Refill</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.noTrackText}>Refill tracking not set up for this medication</Text>
                )}
              </View>
            );
          })
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
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryNum: { fontSize: 26, fontWeight: "800", color: "white" },
  summaryLabel: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  summaryDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.2)" },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef3c7", borderRadius: 12, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: C.warning },
  alertText: { fontSize: 13, color: "#92400e", fontWeight: "600", flex: 1 },
  medCard: { backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#047382", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, overflow: "hidden" },
  medStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  medTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  medIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  medMeta: { flex: 1 },
  medName: { fontSize: 16, fontWeight: "700", color: C.text },
  medDosage: { fontSize: 13, color: C.textSub, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: "700" },
  supplyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  supplyLabel: { fontSize: 13, color: C.textSub },
  supplyCount: { fontSize: 13, fontWeight: "700", color: C.text },
  progressBarBg: { height: 8, backgroundColor: "#e8f3f5", borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  progressBarFill: { height: "100%", borderRadius: 4 },
  lastRefill: { fontSize: 11, color: C.textMuted, marginBottom: 12 },
  refillBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 10 },
  refillBtnText: { fontSize: 14, fontWeight: "700" },
  noTrackText: { fontSize: 13, color: C.textMuted, fontStyle: "italic" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.teal10, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: C.text, marginBottom: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
});
