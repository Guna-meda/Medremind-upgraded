import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  Animated, Modal, Alert, AppState, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { getMedications, Medication, getTodaysDoses, recordDose, DoseHistory } from "../utils/storage";
import { useFocusEffect } from "@react-navigation/native";
import { registerForPushNotificationsAsync, scheduleMedicationReminder } from "../utils/notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const C = {
  primary: "#047382",
  primaryDark: "#035a66",
  primaryLight: "#058a9a",
  accent: "#00c2cc",
  teal10: "#e8f6f8",
  teal20: "#c5eaee",
  teal60: "#37a3b4",
  bg: "#f0f9fa",
  surface: "#ffffff",
  text: "#1a2e35",
  textSub: "#5a8490",
  textMuted: "#9ab5bc",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Generate 60 days around today for horizontal scroll
function generateDays() {
  const days = [];
  const today = new Date();
  for (let i = -7; i <= 52; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function CircularProgress({ progress, totalDoses, completedDoses }: { progress: number; totalDoses: number; completedDoses: number }) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const size = width * 0.42;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animatedValue, { toValue: progress, duration: 1200, useNativeDriver: true }).start();
  }, [progress]);

  const strokeDashoffset = animatedValue.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressInner}>
        <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
        <Text style={styles.progressSub}>{completedDoses}/{totalDoses}</Text>
        <Text style={styles.progressLabel}>done</Text>
      </View>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={radius} stroke="white" strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showNotifications, setShowNotifications] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todaysMedications, setTodaysMedications] = useState<Medication[]>([]);
  const [completedDoses, setCompletedDoses] = useState(0);
  const [doseHistory, setDoseHistory] = useState<DoseHistory[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [userName] = useState("there");
  const calendarRef = useRef<FlatList>(null);
  const allDays = generateDays();
  const todayIndex = allDays.findIndex(d => d.toDateString() === new Date().toDateString());

  const getHour = new Date().getHours();
  const greeting = getHour < 12 ? "Good morning" : getHour < 17 ? "Good afternoon" : "Good evening";

  const loadMedications = useCallback(async () => {
    try {
      const [allMedications, todaysDoses] = await Promise.all([getMedications(), getTodaysDoses()]);
      setDoseHistory(todaysDoses);
      setMedications(allMedications);

      const today = new Date();
      const todayMeds = allMedications.filter((med) => {
        const startDate = new Date(med.startDate);
        const durationDays = parseInt(med.duration.split(" ")[0]);
        if (durationDays === -1 || (today >= startDate && today <= new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000))) return true;
        return false;
      });
      setTodaysMedications(todayMeds);
      const completed = todaysDoses.filter((dose) => dose.taken).length;
      setCompletedDoses(completed);
    } catch (error) {
      console.error("Error loading medications:", error);
    }
  }, []);

  useEffect(() => {
    loadMedications();
    setupNotifications();
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") loadMedications();
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(useCallback(() => {
    loadMedications();
  }, [loadMedications]));

  // Scroll calendar to today on mount
  useEffect(() => {
    setTimeout(() => {
      calendarRef.current?.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0.3 });
    }, 400);
  }, []);

  const setupNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      const meds = await getMedications();
      for (const med of meds) {
        if (med.reminderEnabled) await scheduleMedicationReminder(med);
      }
    } catch (error) {}
  };

  const handleTakeDose = async (medication: Medication) => {
    try {
      await recordDose(medication.id, true, new Date().toISOString());
      await loadMedications();
    } catch (error) {
      Alert.alert("Error", "Failed to record dose. Please try again.");
    }
  };

  const isDoseTaken = (medicationId: string) => doseHistory.some((d) => d.medicationId === medicationId && d.taken);

  const progress = todaysMedications.length > 0 ? completedDoses / (todaysMedications.length * 2) : 0;
  const isToday = selectedDate.toDateString() === new Date().toDateString();

  const getMedColor = (i: number) => {
    const colors = [C.primary, "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6"];
    return colors[i % colors.length];
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroShell}>
          <LinearGradient colors={[C.primaryDark, C.primary]} style={[styles.header, { paddingTop: insets.top + 22 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.headerDecCircle1} />
            <View style={styles.headerDecCircle2} />

            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>{greeting} 👋</Text>
                <Text style={styles.dateText}>{DAYS[new Date().getDay()]}, {new Date().getDate()} {MONTHS[new Date().getMonth()]}</Text>
              </View>
              <TouchableOpacity style={styles.notifBtn} onPress={() => setShowNotifications(true)}>
                <Ionicons name="notifications-outline" size={22} color="white" />
                {todaysMedications.length > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{todaysMedications.length}</Text></View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.progressRow}>
              <CircularProgress progress={progress} totalDoses={todaysMedications.length * 2} completedDoses={completedDoses} />
              <View style={styles.statsCol}>
                <View style={styles.statCard}>
                  <Text style={styles.statNum}>{todaysMedications.length}</Text>
                  <Text style={styles.statLabel}>Scheduled</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNum, { color: "#a8f0c6" }]}>{completedDoses}</Text>
                  <Text style={styles.statLabel}>Taken</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statNum, { color: "#ffd6d6" }]}>{Math.max(0, todaysMedications.length - completedDoses)}</Text>
                  <Text style={styles.statLabel}>Remaining</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Horizontal scrollable calendar */}
        <View style={styles.calSection}>
          <View style={styles.calHeader}>
            <Text style={styles.calMonth}>{MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}</Text>
            <TouchableOpacity onPress={() => { setSelectedDate(new Date()); calendarRef.current?.scrollToIndex({ index: todayIndex, animated: true, viewPosition: 0.3 }); }}>
              <Text style={styles.todayBtn}>Today</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            ref={calendarRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={allDays}
            keyExtractor={(d) => d.toISOString()}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            getItemLayout={(_, index) => ({ length: 56, offset: 56 * index + 8 * index, index })}
            renderItem={({ item: day }) => {
              const isSelected = day.toDateString() === selectedDate.toDateString();
              const isTodayDay = day.toDateString() === new Date().toDateString();
              return (
                <TouchableOpacity
                  style={[styles.calDay, isSelected && styles.calDaySelected, isTodayDay && !isSelected && styles.calDayToday]}
                  onPress={() => setSelectedDate(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.calDayName, isSelected && styles.calDayTextSelected]}>{DAYS[day.getDay()]}</Text>
                  <Text style={[styles.calDayNum, isSelected && styles.calDayTextSelected, isTodayDay && !isSelected && { color: C.primary }]}>{day.getDate()}</Text>
                  {isTodayDay && <View style={[styles.calDot, isSelected && { backgroundColor: "white" }]} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {[
              { icon: "add-circle-outline", label: "Add Med", route: "/medications/add", grad: [C.primary, C.primaryDark] as [string, string] },
              { icon: "calendar-outline", label: "Calendar", route: "/calendar", grad: ["#0891b2", "#0e7490"] as [string, string] },
              { icon: "time-outline", label: "History", route: "/history", grad: ["#7c3aed", "#6d28d9"] as [string, string] },
              { icon: "medical-outline", label: "Refills", route: "/refills", grad: ["#d97706", "#b45309"] as [string, string] },
            ].map((a) => (
              <Link href={a.route as any} key={a.label} asChild>
                <TouchableOpacity style={styles.quickBtn} activeOpacity={0.8}>
                  <LinearGradient colors={a.grad} style={styles.quickGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.quickIconWrap}>
                      <Ionicons name={a.icon as any} size={22} color="white" />
                    </View>
                    <Text style={styles.quickLabel}>{a.label}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        {/* Today's Schedule */}
        <View style={[styles.section, { paddingBottom: 32 }]}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{isToday ? "Today's Schedule" : selectedDate.toLocaleDateString("default", { weekday: "long", month: "short", day: "numeric" })}</Text>
            <Link href="/calendar" asChild>
              <TouchableOpacity>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {todaysMedications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="medical-outline" size={32} color={C.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No medications scheduled</Text>
              <Text style={styles.emptySubtitle}>Add your first medication to get started</Text>
              <Link href="/medications/add" asChild>
                <TouchableOpacity style={styles.emptyBtn}>
                  <Ionicons name="add" size={18} color="white" />
                  <Text style={styles.emptyBtnText}>Add Medication</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            todaysMedications.map((medication, i) => {
              const taken = isDoseTaken(medication.id);
              const color = getMedColor(i);
              return (
                <View key={medication.id} style={[styles.doseCard, taken && styles.doseCardTaken]}>
                  <View style={[styles.doseStripe, { backgroundColor: color }]} />
                  <View style={[styles.dosePill, { backgroundColor: `${color}18` }]}>
                    <Ionicons name="medical" size={20} color={color} />
                  </View>
                  <View style={styles.doseInfo}>
                    <Text style={styles.doseName}>{medication.name}</Text>
                    <Text style={styles.doseDosage}>{medication.dosage}</Text>
                    <View style={styles.doseTimeRow}>
                      <Ionicons name="time-outline" size={13} color={C.textMuted} />
                      <Text style={styles.doseTime}>{medication.times[0]}</Text>
                    </View>
                  </View>
                  {taken ? (
                    <View style={styles.takenBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={C.success} />
                      <Text style={styles.takenText}>Done</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.takeBtn, { backgroundColor: color }]} onPress={() => handleTakeDose(medication)} activeOpacity={0.8}>
                      <Text style={styles.takeBtnText}>Take</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <Link href="/medications/add" asChild>
        <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
          <LinearGradient colors={[C.primary, C.primaryDark]} style={styles.fabGrad}>
            <Ionicons name="add" size={28} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </Link>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} animationType="slide" transparent onRequestClose={() => setShowNotifications(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Today's Reminders</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {todaysMedications.length === 0 ? (
                <Text style={{ color: C.textSub, textAlign: "center", padding: 24 }}>No reminders for today</Text>
              ) : (
                todaysMedications.map((med, i) => (
                  <View key={med.id} style={styles.notifItem}>
                    <View style={[styles.notifIcon, { backgroundColor: `${getMedColor(i)}18` }]}>
                      <Ionicons name="medical" size={22} color={getMedColor(i)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifName}>{med.name}</Text>
                      <Text style={styles.notifDose}>{med.dosage}</Text>
                      <Text style={styles.notifTime}>{med.times[0]}</Text>
                    </View>
                    {isDoseTaken(med.id) && <Ionicons name="checkmark-circle" size={22} color={C.success} />}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  heroShell: {
    backgroundColor: C.primaryDark,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
    width: "100%",
  },
  header: { width: "100%", paddingHorizontal: 20, paddingBottom: 24 },
  headerDecCircle1: { position: "absolute", top: -40, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.07)" },
  headerDecCircle2: { position: "absolute", bottom: -60, left: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.05)" },
  headerTop: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  greeting: { fontSize: 20, fontWeight: "700", color: "white" },
  dateText: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  notifBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#035a66" },
  badgeText: { color: "white", fontSize: 10, fontWeight: "700" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  progressWrap: { width: width * 0.42, height: width * 0.42, alignItems: "center", justifyContent: "center" },
  progressInner: { alignItems: "center" },
  progressPct: { fontSize: 30, fontWeight: "800", color: "white" },
  progressSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  progressLabel: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1 },
  statsCol: { flex: 1, gap: 8 },
  statCard: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 10 },
  statNum: { fontSize: 22, fontWeight: "800", color: "white" },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 },

  scrollView: { flex: 1, backgroundColor: C.bg },
  scrollContent: { backgroundColor: C.bg, paddingBottom: 112 },

  calSection: { backgroundColor: "white", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e8f3f5" },
  calHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 },
  calMonth: { fontSize: 16, fontWeight: "700", color: C.text },
  todayBtn: { fontSize: 13, color: C.primary, fontWeight: "600" },
  calDay: { width: 48, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: "#f5fafa" },
  calDaySelected: { backgroundColor: C.primary },
  calDayToday: { borderWidth: 1.5, borderColor: C.primary, backgroundColor: "white" },
  calDayName: { fontSize: 11, color: C.textMuted, marginBottom: 4, fontWeight: "500" },
  calDayNum: { fontSize: 16, fontWeight: "700", color: C.text },
  calDayTextSelected: { color: "white" },
  calDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.primary, marginTop: 4 },

  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: C.text, marginBottom: 14 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  seeAll: { fontSize: 13, color: C.primary, fontWeight: "600" },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  quickBtn: { width: (width - 50) / 2, height: 90, borderRadius: 16, overflow: "hidden" },
  quickGrad: { flex: 1, padding: 14, justifyContent: "space-between" },
  quickIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  quickLabel: { color: "white", fontSize: 14, fontWeight: "700" },

  doseCard: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: "#047382", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, overflow: "hidden" },
  doseCardTaken: { opacity: 0.75 },
  doseStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  dosePill: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 4, marginRight: 12 },
  doseInfo: { flex: 1 },
  doseName: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 2 },
  doseDosage: { fontSize: 13, color: C.textSub, marginBottom: 4 },
  doseTimeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  doseTime: { fontSize: 12, color: C.textMuted },
  takeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginLeft: 8 },
  takeBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
  takenBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#d1fae5", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, marginLeft: 8 },
  takenText: { color: C.success, fontWeight: "700", fontSize: 13 },

  emptyState: { alignItems: "center", paddingVertical: 32, backgroundColor: "white", borderRadius: 20, shadowColor: "#047382", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.teal10, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: C.textSub, marginBottom: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: "white", fontWeight: "700", fontSize: 14 },

  fab: { position: "absolute", right: 20, bottom: 28, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10 },
  fabGrad: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "80%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#dde8ea", alignSelf: "center", marginBottom: 16 },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: C.text },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f0f4f5", alignItems: "center", justifyContent: "center" },
  notifItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#f7fafa", borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  notifIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  notifName: { fontSize: 15, fontWeight: "700", color: C.text },
  notifDose: { fontSize: 13, color: C.textSub, marginTop: 2 },
  notifTime: { fontSize: 12, color: C.textMuted, marginTop: 2 },
});
