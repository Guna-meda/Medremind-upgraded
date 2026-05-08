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

const { width } = Dimensions.get("window");

// Pure teal palette — no orange, no purple, no red accents
const C = {
  primary:     "#037482",
  primaryDark: "#025a64",
  primaryLight:"#048fa6",
  teal40:      "#57C3DC",
  teal10:      "#D3EEF5",
  teal05:      "#eef8fb",
  bg:          "#eef8fb",
  surface:     "#ffffff",
  text:        "#0d2f36",
  textSub:     "#3a7580",
  textMuted:   "#7ab5c0",
  success:     "#0d9488",
  successBg:   "#ccf0ec",
};

// All teal shades for card accents
const MED_TONES = [
  "#037482", "#025a64", "#048fa6", "#0a9bb5",
  "#57C3DC", "#0e7490", "#2dd4bf", "#0891b2",
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function generateCalDays() {
  const days: Date[] = [];
  const today = new Date();
  for (let i = -7; i <= 52; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

/** Returns greeting text purely based on current hour */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "Good morning ☀️";
  if (h >= 12 && h < 17) return "Good afternoon 🌤";
  if (h >= 17 && h < 21) return "Good evening 🌆";
  return "Good night 🌙";
}

// Circular progress ring
function CircularProgress({ progress, total, done }: { progress: number; total: number; done: number }) {
  const animVal   = useRef(new Animated.Value(0)).current;
  const size      = width * 0.40;
  const sw        = 11;
  const r         = (size - sw) / 2;
  const circum    = 2 * Math.PI * r;

  useEffect(() => {
    Animated.timing(animVal, { toValue: progress, duration: 1000, useNativeDriver: true }).start();
  }, [progress]);

  const offset = animVal.interpolate({ inputRange: [0,1], outputRange: [circum, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "white" }}>{Math.round(progress * 100)}%</Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>{done}/{total} doses</Text>
      </View>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.2)" strokeWidth={sw} fill="none" />
        <AnimatedCircle
          cx={size/2} cy={size/2} r={r}
          stroke="white" strokeWidth={sw} fill="none"
          strokeDasharray={circum} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [medications, setMedications]       = useState<Medication[]>([]);
  const [todaysMeds, setTodaysMeds]         = useState<Medication[]>([]);
  const [completedDoses, setCompletedDoses] = useState(0);
  const [doseHistory, setDoseHistory]       = useState<DoseHistory[]>([]);
  const [selectedDate, setSelectedDate]     = useState(new Date());
  const [greeting, setGreeting]             = useState(getGreeting());
  const calRef   = useRef<FlatList>(null);
  const allDays  = useRef(generateCalDays()).current;
  const todayIdx = allDays.findIndex(d => d.toDateString() === new Date().toDateString());

  // Update greeting every minute so it's always accurate
  useEffect(() => {
    setGreeting(getGreeting());
    const interval = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const loadMedications = useCallback(async () => {
    try {
      const [allMeds, todayDoses] = await Promise.all([getMedications(), getTodaysDoses()]);
      setDoseHistory(todayDoses);
      setMedications(allMeds);

      const today = new Date();
      const active = allMeds.filter(med => {
        const start = new Date(med.startDate);
        start.setHours(0,0,0,0);
        const check = new Date(today);
        check.setHours(0,0,0,0);
        if (check < start) return false;
        if (med.duration === "Ongoing") return true;
        const m = med.duration.match(/(\d+)/);
        if (!m) return true;
        const end = new Date(start);
        end.setDate(start.getDate() + parseInt(m[1]) - 1);
        return check <= end;
      });
      setTodaysMeds(active);
      setCompletedDoses(todayDoses.filter(d => d.taken).length);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadMedications();
    setupNotifications();
    const sub = AppState.addEventListener("change", s => {
      if (s === "active") loadMedications();
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(useCallback(() => { loadMedications(); }, [loadMedications]));

  useEffect(() => {
    setTimeout(() => {
      calRef.current?.scrollToIndex({ index: todayIdx, animated: true, viewPosition: 0.3 });
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
    } catch {}
  };

  const handleTake = async (med: Medication) => {
    try {
      await recordDose(med.id, true, new Date().toISOString());
      await loadMedications();
    } catch {
      Alert.alert("Error", "Failed to record dose.");
    }
  };

  const isTaken = (id: string) => doseHistory.some(d => d.medicationId === id && d.taken);

  const totalDoses = todaysMeds.length;
  const progress   = totalDoses > 0 ? completedDoses / totalDoses : 0;

  const formatTime12 = (t: string) => {
    const [h,m] = t.split(":").map(Number);
    const suf = h >= 12 ? "PM" : "AM";
    const hr  = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:${m.toString().padStart(2,"0")} ${suf}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >

        {/* ── Header ── */}
        <LinearGradient colors={[C.primaryDark, C.primary]} style={st.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={st.headerDec1} />
          <View style={st.headerDec2} />

          <View style={st.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={st.greeting}>{greeting}</Text>
              <Text style={st.dateText}>{DAYS[new Date().getDay()]}, {new Date().getDate()} {MONTHS[new Date().getMonth()]}</Text>
            </View>
            <TouchableOpacity style={st.notifBtn} onPress={() => setShowNotifModal(true)}>
              <Ionicons name="notifications-outline" size={22} color="white" />
              {todaysMeds.length > 0 && (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{todaysMeds.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={st.statsRow}>
            <CircularProgress progress={progress} total={totalDoses} done={completedDoses} />
            <View style={st.statsRight}>
              {[
                { label: "Scheduled", num: totalDoses,                           numCol: "white" },
                { label: "Taken",     num: completedDoses,                       numCol: "#a8f0e8" },
                { label: "Remaining", num: Math.max(0, totalDoses - completedDoses), numCol: "#b8e8f5" },
              ].map(s => (
                <View key={s.label} style={st.statBox}>
                  <Text style={[st.statNum, { color: s.numCol }]}>{s.num}</Text>
                  <Text style={st.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>

        {/* ── Horizontal calendar ── */}
        <View style={st.calStrip}>
          <View style={st.calStripHead}>
            <Text style={st.calMonth}>{MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}</Text>
            <TouchableOpacity onPress={() => {
              setSelectedDate(new Date());
              calRef.current?.scrollToIndex({ index: todayIdx, animated: true, viewPosition: 0.3 });
            }}>
              <Text style={st.todayLink}>Today</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            ref={calRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={allDays}
            keyExtractor={d => d.toISOString()}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 7 }}
            getItemLayout={(_, i) => ({ length: 54, offset: (54+7)*i, index: i })}
            renderItem={({ item: day }) => {
              const isSel  = day.toDateString() === selectedDate.toDateString();
              const isT    = day.toDateString() === new Date().toDateString();
              return (
                <TouchableOpacity
                  style={[st.calDay, isSel && st.calDaySel, isT && !isSel && st.calDayToday]}
                  onPress={() => setSelectedDate(day)}
                  activeOpacity={0.75}
                >
                  <Text style={[st.calDayName, isSel && st.calDayTextSel]}>{DAYS[day.getDay()]}</Text>
                  <Text style={[st.calDayNum, isSel && st.calDayTextSel, isT && !isSel && { color: C.primary }]}>{day.getDate()}</Text>
                  {isT && <View style={[st.calDot, isSel && { backgroundColor: "rgba(255,255,255,0.85)" }]} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* ── Quick actions ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Quick Actions</Text>
          <View style={st.quickGrid}>
            {[
              { icon: "add-circle-outline", label: "Add Med",  route: "/medications/add", g: [C.primary, C.primaryDark] as [string,string] },
              { icon: "calendar-outline",   label: "Calendar", route: "/calendar",        g: ["#048fa6", C.primary]     as [string,string] },
              { icon: "time-outline",       label: "History",  route: "/history",         g: [C.primaryDark,"#01404a"]  as [string,string] },
              { icon: "medical-outline",    label: "Refills",  route: "/refills",         g: ["#0a9bb5","#048fa6"]      as [string,string] },
            ].map(a => (
              <Link href={a.route as any} key={a.label} asChild>
                <TouchableOpacity style={st.quickBtn} activeOpacity={0.82}>
                  <LinearGradient colors={a.g} style={st.quickGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={st.quickIconWrap}>
                      <Ionicons name={a.icon as any} size={22} color="white" />
                    </View>
                    <Text style={st.quickLabel}>{a.label}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>

        {/* ── Today's schedule ── */}
        <View style={[st.section, { paddingBottom: 32 }]}>
          <View style={st.sectionRow}>
            <Text style={st.sectionTitle}>Today's Schedule</Text>
            <Link href="/calendar" asChild>
              <TouchableOpacity><Text style={st.seeAll}>See All</Text></TouchableOpacity>
            </Link>
          </View>

          {todaysMeds.length === 0 ? (
            <View style={st.emptyBox}>
              <View style={st.emptyIcon}><Ionicons name="medical-outline" size={30} color={C.textMuted} /></View>
              <Text style={st.emptyTitle}>No medications today</Text>
              <Text style={st.emptySub}>Add your first medication to get started</Text>
              <Link href="/medications/add" asChild>
                <TouchableOpacity style={st.emptyBtn}>
                  <Ionicons name="add" size={18} color="white" />
                  <Text style={st.emptyBtnText}>Add Medication</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            todaysMeds.map((med, i) => {
              const taken  = isTaken(med.id);
              const accent = MED_TONES[i % MED_TONES.length];
              return (
                <View key={med.id} style={[st.doseCard, taken && { opacity: 0.72 }]}>
                  <View style={[st.doseStripe, { backgroundColor: accent }]} />
                  <View style={[st.dosePillIcon, { backgroundColor: `${accent}22` }]}>
                    <Ionicons name="medical" size={20} color={accent} />
                  </View>
                  <View style={st.doseInfo}>
                    <Text style={st.doseName}>{med.name}</Text>
                    <Text style={st.doseDosage}>{med.dosage}</Text>
                    {med.times.length > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Ionicons name="alarm-outline" size={12} color={C.textMuted} />
                        <Text style={st.doseTime}>{med.times.map(formatTime12).join("  ·  ")}</Text>
                      </View>
                    )}
                  </View>
                  {taken ? (
                    <View style={st.doneBadge}>
                      <Ionicons name="checkmark-circle" size={17} color={C.success} />
                      <Text style={st.doneBadgeText}>Done</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[st.takeBtn, { backgroundColor: accent }]} onPress={() => handleTake(med)} activeOpacity={0.82}>
                      <Text style={st.takeBtnText}>Take</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── FAB ── */}
      <Link href="/medications/add" asChild>
        <TouchableOpacity style={st.fab} activeOpacity={0.85}>
          <LinearGradient colors={[C.primary, C.primaryDark]} style={st.fabGrad}>
            <Ionicons name="add" size={28} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </Link>

      {/* ── Notifications modal ── */}
      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>
        <View style={st.overlay}>
          <View style={st.sheet}>
            <View style={st.sheetHandle} />
            <View style={st.sheetHead}>
              <Text style={st.sheetTitle}>Today's Reminders</Text>
              <TouchableOpacity style={st.closeBtn} onPress={() => setShowNotifModal(false)}>
                <Ionicons name="close" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {todaysMeds.length === 0 ? (
                <Text style={{ color: C.textSub, textAlign: "center", padding: 24 }}>No reminders for today</Text>
              ) : (
                todaysMeds.map((med, i) => {
                  const accent = MED_TONES[i % MED_TONES.length];
                  return (
                    <View key={med.id} style={st.notifItem}>
                      <View style={[st.notifIcon, { backgroundColor: `${accent}22` }]}>
                        <Ionicons name="medical" size={22} color={accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.notifName}>{med.name}</Text>
                        <Text style={st.notifDosage}>{med.dosage}</Text>
                        {med.times.length > 0 && (
                          <Text style={st.notifTime}>{med.times.map(formatTime12).join("  ·  ")}</Text>
                        )}
                      </View>
                      {isTaken(med.id) && <Ionicons name="checkmark-circle" size={22} color={C.success} />}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  header:      { width: "100%", paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24, overflow: "hidden", borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerDec1:  { position: "absolute", top: -40, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.07)" },
  headerDec2:  { position: "absolute", bottom: -60, left: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)" },
  headerTop:   { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  greeting:    { fontSize: 20, fontWeight: "700", color: "white" },
  dateText:    { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  notifBtn:    { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  badge:       { position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#c0392b", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#025a64" },
  badgeText:   { color: "white", fontSize: 10, fontWeight: "700" },
  statsRow:    { flexDirection: "row", alignItems: "center", gap: 18 },
  statsRight:  { flex: 1, gap: 8 },
  statBox:     { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, padding: 10 },
  statNum:     { fontSize: 22, fontWeight: "800", color: "white" },
  statLabel:   { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 },

  calStrip:     { backgroundColor: "white", paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e0f0f4" },
  calStripHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, marginBottom: 12 },
  calMonth:     { fontSize: 15, fontWeight: "700", color: "#0d2f36" },
  todayLink:    { fontSize: 13, color: "#037482", fontWeight: "700" },
  calDay:       { width: 54, alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: "#D3EEF5" },
  calDaySel:    { backgroundColor: "#037482" },
  calDayToday:  { borderWidth: 2, borderColor: "#037482", backgroundColor: "white" },
  calDayName:   { fontSize: 10, color: "#7ab5c0", fontWeight: "700", marginBottom: 4 },
  calDayNum:    { fontSize: 16, fontWeight: "800", color: "#0d2f36" },
  calDayTextSel:{ color: "white" },
  calDot:       { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#037482", marginTop: 4 },

  section:      { paddingHorizontal: 18, paddingTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0d2f36", marginBottom: 14 },
  sectionRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  seeAll:       { fontSize: 13, color: "#037482", fontWeight: "700" },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  quickBtn:  { width: (width - 46) / 2, height: 88, borderRadius: 16, overflow: "hidden" },
  quickGrad: { flex: 1, padding: 14, justifyContent: "space-between" },
  quickIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  quickLabel: { color: "white", fontSize: 14, fontWeight: "700" },

  doseCard:    { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: "#037482", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, overflow: "hidden" },
  doseStripe:  { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  dosePillIcon:{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 4, marginRight: 12 },
  doseInfo:    { flex: 1 },
  doseName:    { fontSize: 15, fontWeight: "700", color: "#0d2f36", marginBottom: 2 },
  doseDosage:  { fontSize: 13, color: "#3a7580" },
  doseTime:    { fontSize: 12, color: "#7ab5c0" },
  takeBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginLeft: 8 },
  takeBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
  doneBadge:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ccf0ec", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, marginLeft: 8 },
  doneBadgeText: { color: "#0d9488", fontWeight: "700", fontSize: 13 },

  emptyBox:    { alignItems: "center", paddingVertical: 36, backgroundColor: "white", borderRadius: 20, shadowColor: "#037482", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  emptyIcon:   { width: 64, height: 64, borderRadius: 32, backgroundColor: "#D3EEF5", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle:  { fontSize: 16, fontWeight: "700", color: "#0d2f36", marginBottom: 6 },
  emptySub:    { fontSize: 14, color: "#7ab5c0", marginBottom: 20 },
  emptyBtn:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#037482", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText:{ color: "white", fontWeight: "700", fontSize: 14 },

  fab:     { position: "absolute", right: 20, bottom: 28, shadowColor: "#037482", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10 },
  fabGrad: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },

  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.38)", justifyContent: "flex-end" },
  sheet:     { backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "82%" },
  sheetHandle:{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#c5dde2", alignSelf: "center", marginBottom: 16 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  sheetTitle:{ fontSize: 20, fontWeight: "800", color: "#0d2f36" },
  closeBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: "#eef8fb", alignItems: "center", justifyContent: "center" },
  notifItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#eef8fb", borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  notifIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  notifName: { fontSize: 15, fontWeight: "700", color: "#0d2f36" },
  notifDosage:{ fontSize: 13, color: "#3a7580", marginTop: 2 },
  notifTime: { fontSize: 12, color: "#7ab5c0", marginTop: 2 },
});
