import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Switch, Dimensions, Platform, KeyboardAvoidingView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { addMedication } from "../../utils/storage";
import { scheduleMedicationReminder, scheduleRefillReminder } from "../../utils/notifications";

const { width } = Dimensions.get("window");

// Pure teal palette only
const C = {
  primary: "#037482",
  primaryDark: "#025a64",
  primaryLight: "#57C3DC",
  teal05: "#f0fafc",
  teal10: "#D3EEF5",
  teal20: "#a8dce8",
  teal40: "#57C3DC",
  bg: "#eef8fb",
  text: "#0d2f36",
  textSub: "#3a7580",
  textMuted: "#7ab5c0",
  surface: "#ffffff",
  danger: "#c0392b",
};

const FREQUENCIES = [
  { id: "1", label: "Once daily",   icon: "sunny-outline"    as const, defaultTimes: ["08:00"] },
  { id: "2", label: "Twice daily",  icon: "sync-outline"     as const, defaultTimes: ["08:00", "20:00"] },
  { id: "3", label: "3× daily",     icon: "time-outline"     as const, defaultTimes: ["08:00", "14:00", "20:00"] },
  { id: "4", label: "4× daily",     icon: "repeat-outline"   as const, defaultTimes: ["08:00", "12:00", "16:00", "20:00"] },
  { id: "5", label: "As needed",    icon: "calendar-outline" as const, defaultTimes: [] },
];

const DURATIONS = [
  { id: "1", label: "7 days",   value: 7 },
  { id: "2", label: "14 days",  value: 14 },
  { id: "3", label: "30 days",  value: 30 },
  { id: "4", label: "90 days",  value: 90 },
  { id: "5", label: "Ongoing",  value: -1 },
];

// All teal shades for color tagging
const MED_COLORS = [
  "#037482", "#025a64", "#57C3DC", "#D3EEF5",
  "#0a9bb5", "#048fa6", "#2dd4bf", "#0e7490",
];

function timeStringToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatTime12(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export default function AddMedicationScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", dosage: "", frequency: "", duration: "", startDate: new Date(),
    times: [] as string[], notes: "", reminderEnabled: true, refillReminder: false,
    currentSupply: "", refillAt: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Time picker: track which index is being edited, null = closed
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState("");
  const [selectedDuration, setSelectedDuration]   = useState("");
  const [selectedColor, setSelectedColor]         = useState(MED_COLORS[0]);
  const [isSubmitting, setIsSubmitting]           = useState(false);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())    e.name      = "Medication name is required";
    if (!form.dosage.trim())  e.dosage    = "Dosage is required";
    if (!form.frequency)      e.frequency = "Select a frequency";
    if (!form.duration)       e.duration  = "Select a duration";
    if (form.reminderEnabled && form.times.length === 0)
      e.times = "Set at least one reminder time";
    if (form.refillReminder) {
      if (!form.currentSupply) e.currentSupply = "Current supply required";
      if (!form.refillAt)      e.refillAt = "Alert threshold required";
      if (Number(form.refillAt) >= Number(form.currentSupply))
        e.refillAt = "Must be less than supply";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const med = {
        id: Math.random().toString(36).substr(2, 9),
        name: form.name.trim(),
        dosage: form.dosage.trim(),
        frequency: form.frequency,
        duration: form.duration,
        startDate: form.startDate.toISOString(),
        times: form.times,
        notes: form.notes,
        reminderEnabled: form.reminderEnabled,
        refillReminder: form.refillReminder,
        currentSupply: form.currentSupply ? Number(form.currentSupply) : 0,
        totalSupply:   form.currentSupply ? Number(form.currentSupply) : 0,
        refillAt:      form.refillAt      ? Number(form.refillAt)      : 0,
        color: selectedColor,
      };
      await addMedication(med);
      if (med.reminderEnabled) await scheduleMedicationReminder(med);
      if (med.refillReminder)  await scheduleRefillReminder(med);
      Alert.alert("Saved!", `${med.name} has been added.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Frequency select ────────────────────────────────────────────────────────
  const handleFrequency = (label: string) => {
    const found = FREQUENCIES.find(f => f.label === label);
    setSelectedFrequency(label);
    setForm(p => ({ ...p, frequency: label, times: [...(found?.defaultTimes ?? [])] }));
    if (errors.frequency) setErrors(p => ({ ...p, frequency: "" }));
    if (errors.times)     setErrors(p => ({ ...p, times: "" }));
  };

  // ── Time editing ────────────────────────────────────────────────────────────
  const handleTimeChange = (_: any, date?: Date) => {
    if (Platform.OS === "android") {
      // Android fires once then closes
      if (date && editingTimeIndex !== null) {
        const updated = [...form.times];
        updated[editingTimeIndex] = dateToTimeString(date);
        setForm(p => ({ ...p, times: updated }));
      }
      setEditingTimeIndex(null);
    } else {
      // iOS: update live, close via "Done"
      if (date && editingTimeIndex !== null) {
        const updated = [...form.times];
        updated[editingTimeIndex] = dateToTimeString(date);
        setForm(p => ({ ...p, times: updated }));
      }
    }
    if (errors.times) setErrors(p => ({ ...p, times: "" }));
  };

  // ── Field helper ────────────────────────────────────────────────────────────
  const Field = ({ label, fkey, placeholder, keyboard }: { label: string; fkey: string; placeholder: string; keyboard?: any }) => (
    <View style={st.fieldGroup}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        style={[st.input, errors[fkey] && st.inputErr]}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        value={(form as any)[fkey]}
        onChangeText={v => {
          setForm(p => ({ ...p, [fkey]: v }));
          if (errors[fkey]) setErrors(p => ({ ...p, [fkey]: "" }));
        }}
        keyboardType={keyboard ?? "default"}
      />
      {errors[fkey] && <Text style={st.errText}>{errors[fkey]}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView style={st.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header */}
      <LinearGradient colors={[C.primaryDark, C.primary]} style={st.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={st.headerDec} />
        <View style={st.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <Ionicons name="chevron-back" size={22} color="white" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>Add Medication</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Basic Info ── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Basic Information</Text>
          <Field label="Medication Name *" fkey="name" placeholder="e.g. Aspirin" />
          <Field label="Dosage *" fkey="dosage" placeholder="e.g. 500mg" />

          {/* Color tag */}
          <View style={st.fieldGroup}>
            <Text style={st.label}>Color Tag</Text>
            <View style={st.colorRow}>
              {MED_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[st.colorDot, { backgroundColor: c }, selectedColor === c && st.colorDotSel]}
                  onPress={() => setSelectedColor(c)}
                  activeOpacity={0.8}
                >
                  {selectedColor === c && <Ionicons name="checkmark" size={13} color="white" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={st.fieldGroup}>
            <Text style={st.label}>Notes (optional)</Text>
            <TextInput
              style={[st.input, st.inputMulti]}
              placeholder="e.g. Take with food, avoid sunlight…"
              placeholderTextColor={C.textMuted}
              value={form.notes}
              onChangeText={v => setForm(p => ({ ...p, notes: v }))}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* ── Schedule ── */}
        <View style={st.card}>
          <Text style={st.cardTitle}>Schedule</Text>

          {/* Frequency */}
          <View style={st.fieldGroup}>
            <Text style={st.label}>Frequency *</Text>
            <View style={st.chipRow}>
              {FREQUENCIES.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[st.chip, selectedFrequency === f.label && st.chipSel]}
                  onPress={() => handleFrequency(f.label)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={f.icon} size={15} color={selectedFrequency === f.label ? "white" : C.primary} />
                  <Text style={[st.chipText, selectedFrequency === f.label && st.chipTextSel]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.frequency && <Text style={st.errText}>{errors.frequency}</Text>}
          </View>

          {/* Duration */}
          <View style={st.fieldGroup}>
            <Text style={st.label}>Duration *</Text>
            <View style={st.chipRow}>
              {DURATIONS.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={[st.chip, selectedDuration === d.label && st.chipSel]}
                  onPress={() => { setSelectedDuration(d.label); setForm(p => ({ ...p, duration: d.label })); if (errors.duration) setErrors(p => ({ ...p, duration: "" })); }}
                  activeOpacity={0.8}
                >
                  <Text style={[st.chipText, selectedDuration === d.label && st.chipTextSel]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.duration && <Text style={st.errText}>{errors.duration}</Text>}
          </View>

          {/* Start date */}
          <View style={st.fieldGroup}>
            <Text style={st.label}>Start Date</Text>
            <TouchableOpacity style={st.rowPicker} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={C.primary} />
              <Text style={st.rowPickerText}>
                {form.startDate.toLocaleDateString("default", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={form.startDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(_, d) => { setShowDatePicker(false); if (d) setForm(p => ({ ...p, startDate: d })); }}
              />
            )}
          </View>
        </View>

        {/* ── Reminder Times ── */}
        <View style={st.card}>
          <View style={st.cardTitleRow}>
            <Text style={st.cardTitle}>Reminder Times</Text>
            <Switch
              value={form.reminderEnabled}
              onValueChange={v => setForm(p => ({ ...p, reminderEnabled: v }))}
              trackColor={{ false: "#c0d8de", true: C.teal40 }}
              thumbColor={form.reminderEnabled ? C.primary : "#9ab5bc"}
            />
          </View>

          {form.reminderEnabled && (
            <>
              {form.times.length === 0 ? (
                <View style={st.noTimesBox}>
                  <Ionicons name="time-outline" size={22} color={C.textMuted} />
                  <Text style={st.noTimesText}>
                    {selectedFrequency
                      ? "No times set. Select a frequency above to auto-fill, or add manually."
                      : "Select a frequency above to auto-fill times, or add manually."}
                  </Text>
                </View>
              ) : (
                form.times.map((t, i) => (
                  <View key={i} style={st.timeRow}>
                    <View style={st.timeIconWrap}>
                      <Ionicons name="alarm-outline" size={18} color={C.primary} />
                    </View>
                    <Text style={st.timeDoseLabel}>Dose {i + 1}</Text>
                    <TouchableOpacity
                      style={st.timePill}
                      onPress={() => setEditingTimeIndex(i)}
                      activeOpacity={0.8}
                    >
                      <Text style={st.timePillText}>{formatTime12(t)}</Text>
                      <Ionicons name="pencil-outline" size={13} color={C.primary} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Manual add time */}
              <TouchableOpacity
                style={st.addTimeBtn}
                onPress={() => {
                  const updated = [...form.times, "09:00"];
                  setForm(p => ({ ...p, times: updated }));
                  setEditingTimeIndex(updated.length - 1);
                  if (errors.times) setErrors(p => ({ ...p, times: "" }));
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle-outline" size={18} color={C.primary} />
                <Text style={st.addTimeBtnText}>Add time</Text>
              </TouchableOpacity>

              {errors.times && <Text style={st.errText}>{errors.times}</Text>}

              {/* Time picker modal */}
              {editingTimeIndex !== null && (
                <>
                  <DateTimePicker
                    value={timeStringToDate(form.times[editingTimeIndex] ?? "09:00")}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleTimeChange}
                    is24Hour={false}
                  />
                  {Platform.OS === "ios" && (
                    <TouchableOpacity style={st.doneBtn} onPress={() => setEditingTimeIndex(null)}>
                      <Text style={st.doneBtnText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </>
          )}
        </View>

        {/* ── Refill Tracking ── */}
        <View style={st.card}>
          <View style={st.cardTitleRow}>
            <View>
              <Text style={st.cardTitle}>Refill Tracking</Text>
              <Text style={st.cardSub}>Get alerted before you run out</Text>
            </View>
            <Switch
              value={form.refillReminder}
              onValueChange={v => setForm(p => ({ ...p, refillReminder: v }))}
              trackColor={{ false: "#c0d8de", true: C.teal40 }}
              thumbColor={form.refillReminder ? C.primary : "#9ab5bc"}
            />
          </View>

          {form.refillReminder && (
            <View style={st.refillRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Current supply (units)</Text>
                <TextInput
                  style={[st.input, errors.currentSupply && st.inputErr]}
                  placeholder="e.g. 30"
                  placeholderTextColor={C.textMuted}
                  value={form.currentSupply}
                  onChangeText={v => { setForm(p => ({ ...p, currentSupply: v })); if (errors.currentSupply) setErrors(p => ({ ...p, currentSupply: "" })); }}
                  keyboardType="numeric"
                />
                {errors.currentSupply && <Text style={st.errText}>{errors.currentSupply}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.label}>Alert when below</Text>
                <TextInput
                  style={[st.input, errors.refillAt && st.inputErr]}
                  placeholder="e.g. 7"
                  placeholderTextColor={C.textMuted}
                  value={form.refillAt}
                  onChangeText={v => { setForm(p => ({ ...p, refillAt: v })); if (errors.refillAt) setErrors(p => ({ ...p, refillAt: "" })); }}
                  keyboardType="numeric"
                />
                {errors.refillAt && <Text style={st.errText}>{errors.refillAt}</Text>}
              </View>
            </View>
          )}
        </View>

        {/* ── Save ── */}
        <TouchableOpacity
          style={[st.saveBtn, isSubmitting && { opacity: 0.65 }]}
          onPress={handleSave}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          <LinearGradient colors={[C.primary, C.primaryDark]} style={st.saveBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Ionicons name={isSubmitting ? "hourglass-outline" : "checkmark-circle-outline"} size={22} color="white" />
            <Text style={st.saveBtnText}>{isSubmitting ? "Saving…" : "Save Medication"}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef8fb" },
  header: { paddingTop: Platform.OS === "ios" ? 58 : 38, paddingBottom: 20, overflow: "hidden" },
  headerDec: { position: "absolute", top: -40, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)" },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: "white", marginLeft: 12 },
  scroll: { padding: 16 },
  card: { backgroundColor: "white", borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: "#037482", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0d2f36", marginBottom: 4 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#edf6f8" },
  cardSub: { fontSize: 12, color: "#7ab5c0", marginTop: 2 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#3a7580", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: "#D3EEF5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: "#0d2f36", borderWidth: 1.5, borderColor: "transparent" },
  inputErr: { borderColor: "#c0392b", backgroundColor: "#fdf0ef" },
  inputMulti: { height: 80, textAlignVertical: "top", paddingTop: 12 },
  errText: { fontSize: 12, color: "#c0392b", marginTop: 5 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  colorDotSel: { transform: [{ scale: 1.18 }] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: "#D3EEF5", borderWidth: 1.5, borderColor: "transparent" },
  chipSel: { backgroundColor: "#037482", borderColor: "#037482" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#037482" },
  chipTextSel: { color: "white" },
  rowPicker: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#D3EEF5", borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: "transparent" },
  rowPickerText: { flex: 1, fontSize: 14, color: "#0d2f36", fontWeight: "500" },
  noTimesBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#eef8fb", borderRadius: 12, padding: 14, marginBottom: 12 },
  noTimesText: { flex: 1, fontSize: 13, color: "#7ab5c0", lineHeight: 19 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#edf6f8" },
  timeIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#D3EEF5", alignItems: "center", justifyContent: "center" },
  timeDoseLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0d2f36" },
  timePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#D3EEF5", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#57C3DC" },
  timePillText: { fontSize: 14, fontWeight: "700", color: "#037482" },
  addTimeBtn: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12, alignSelf: "flex-start", paddingVertical: 6 },
  addTimeBtnText: { fontSize: 14, color: "#037482", fontWeight: "600" },
  doneBtn: { alignSelf: "flex-end", marginTop: 8, paddingHorizontal: 20, paddingVertical: 9, backgroundColor: "#037482", borderRadius: 12 },
  doneBtnText: { color: "white", fontWeight: "700", fontSize: 14 },
  refillRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  saveBtn: { borderRadius: 16, overflow: "hidden", shadowColor: "#037482", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.32, shadowRadius: 12, elevation: 8, marginTop: 8 },
  saveBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 10 },
  saveBtnText: { color: "white", fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
});
