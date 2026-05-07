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

const C = {
  primary: "#047382", primaryDark: "#035a66", teal10: "#e8f6f8", teal20: "#c5eaee",
  bg: "#f0f9fa", text: "#1a2e35", textSub: "#5a8490", textMuted: "#9ab5bc",
  surface: "#ffffff", danger: "#ef4444",
};

const FREQUENCIES = [
  { id: "1", label: "Once daily", icon: "sunny-outline" as const, times: ["09:00"] },
  { id: "2", label: "Twice daily", icon: "sync-outline" as const, times: ["09:00", "21:00"] },
  { id: "3", label: "3× daily", icon: "time-outline" as const, times: ["09:00", "15:00", "21:00"] },
  { id: "4", label: "4× daily", icon: "repeat-outline" as const, times: ["09:00", "13:00", "17:00", "21:00"] },
  { id: "5", label: "As needed", icon: "calendar-outline" as const, times: [] },
];

const DURATIONS = [
  { id: "1", label: "7 days", value: 7 },
  { id: "2", label: "14 days", value: 14 },
  { id: "3", label: "30 days", value: 30 },
  { id: "4", label: "90 days", value: 90 },
  { id: "5", label: "Ongoing", value: -1 },
];

const MED_COLORS = ["#047382", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6", "#ec4899"];

export default function AddMedicationScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", dosage: "", frequency: "", duration: "", startDate: new Date(),
    times: ["09:00"], notes: "", reminderEnabled: true, refillReminder: false,
    currentSupply: "", refillAt: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState("");
  const [selectedDuration, setSelectedDuration] = useState("");
  const [selectedColor, setSelectedColor] = useState(MED_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (!form.dosage.trim()) newErrors.dosage = "Dosage is required";
    if (!form.frequency) newErrors.frequency = "Frequency is required";
    if (!form.duration) newErrors.duration = "Duration is required";
    if (form.refillReminder) {
      if (!form.currentSupply) newErrors.currentSupply = "Current supply required";
      if (!form.refillAt) newErrors.refillAt = "Refill threshold required";
      if (Number(form.refillAt) >= Number(form.currentSupply)) newErrors.refillAt = "Must be less than supply";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) { Alert.alert("Please fix the errors", "Some required fields need attention."); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const medicationData = {
        id: Math.random().toString(36).substr(2, 9),
        ...form,
        currentSupply: form.currentSupply ? Number(form.currentSupply) : 0,
        totalSupply: form.currentSupply ? Number(form.currentSupply) : 0,
        refillAt: form.refillAt ? Number(form.refillAt) : 0,
        startDate: form.startDate.toISOString(),
        color: selectedColor,
      };
      await addMedication(medicationData);
      if (medicationData.reminderEnabled) await scheduleMedicationReminder(medicationData);
      if (medicationData.refillReminder) await scheduleRefillReminder(medicationData);
      Alert.alert("Added!", "Medication added successfully.", [{ text: "OK", onPress: () => router.back() }], { cancelable: false });
    } catch (error) {
      Alert.alert("Error", "Failed to save medication. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFrequencySelect = (freq: string) => {
    setSelectedFrequency(freq);
    const found = FREQUENCIES.find(f => f.label === freq);
    setForm(prev => ({ ...prev, frequency: freq, times: found?.times || [] }));
    if (errors.frequency) setErrors(prev => ({ ...prev, frequency: "" }));
  };

  const handleDurationSelect = (dur: string) => {
    setSelectedDuration(dur);
    setForm(prev => ({ ...prev, duration: dur }));
    if (errors.duration) setErrors(prev => ({ ...prev, duration: "" }));
  };

  const field = (label: string, key: string, placeholder: string, extra?: any) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, errors[key] && styles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        value={(form as any)[key]}
        onChangeText={(v) => { setForm(prev => ({ ...prev, [key]: v })); if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" })); }}
        {...extra}
      />
      {errors[key] && <Text style={styles.errorText}><Ionicons name="alert-circle-outline" size={12} /> {errors[key]}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={[C.primaryDark, C.primary]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.headerDec} />
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Medication</Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Basic Information</Text>
          {field("Medication Name *", "name", "e.g. Aspirin")}
          {field("Dosage *", "dosage", "e.g. 500mg", { keyboardType: "default" })}

          {/* Color Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Color Tag</Text>
            <View style={styles.colorRow}>
              {MED_COLORS.map(c => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotSelected]} onPress={() => setSelectedColor(c)} activeOpacity={0.8}>
                  {selectedColor === c && <Ionicons name="checkmark" size={14} color="white" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput style={[styles.input, styles.inputMulti]} placeholder="e.g. Take with food" placeholderTextColor={C.textMuted} value={form.notes} onChangeText={v => setForm(prev => ({ ...prev, notes: v }))} multiline numberOfLines={3} />
          </View>
        </View>

        {/* Schedule */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedule</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Frequency *</Text>
            <View style={styles.chipGrid}>
              {FREQUENCIES.map(f => (
                <TouchableOpacity key={f.id} style={[styles.chip, selectedFrequency === f.label && styles.chipSelected]} onPress={() => handleFrequencySelect(f.label)} activeOpacity={0.8}>
                  <Ionicons name={f.icon} size={16} color={selectedFrequency === f.label ? "white" : C.primary} />
                  <Text style={[styles.chipText, selectedFrequency === f.label && styles.chipTextSelected]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.frequency && <Text style={styles.errorText}>{errors.frequency}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Duration *</Text>
            <View style={styles.chipGrid}>
              {DURATIONS.map(d => (
                <TouchableOpacity key={d.id} style={[styles.chip, selectedDuration === d.label && styles.chipSelected]} onPress={() => handleDurationSelect(d.label)} activeOpacity={0.8}>
                  <Text style={[styles.chipText, selectedDuration === d.label && styles.chipTextSelected]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.duration && <Text style={styles.errorText}>{errors.duration}</Text>}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Start Date</Text>
            <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={C.primary} />
              <Text style={styles.datePickerText}>{form.startDate.toLocaleDateString("default", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker value={form.startDate} mode="date" display="default" onChange={(_, d) => { setShowDatePicker(false); if (d) setForm(prev => ({ ...prev, startDate: d })); }} minimumDate={new Date()} />
            )}
          </View>
        </View>

        {/* Reminders */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reminders</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchMeta}>
              <Text style={styles.switchLabel}>Dose reminders</Text>
              <Text style={styles.switchSub}>Get notified when it's time to take your medication</Text>
            </View>
            <Switch value={form.reminderEnabled} onValueChange={v => setForm(prev => ({ ...prev, reminderEnabled: v }))} trackColor={{ false: "#d1d5db", true: "#80bcc4" }} thumbColor={form.reminderEnabled ? C.primary : "#f4f4f5"} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchMeta}>
              <Text style={styles.switchLabel}>Refill tracking</Text>
              <Text style={styles.switchSub}>Get reminded before you run out</Text>
            </View>
            <Switch value={form.refillReminder} onValueChange={v => setForm(prev => ({ ...prev, refillReminder: v }))} trackColor={{ false: "#d1d5db", true: "#80bcc4" }} thumbColor={form.refillReminder ? C.primary : "#f4f4f5"} />
          </View>

          {form.refillReminder && (
            <View style={styles.refillFields}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Current supply (units)</Text>
                <TextInput style={[styles.input, errors.currentSupply && styles.inputError]} placeholder="e.g. 30" placeholderTextColor={C.textMuted} value={form.currentSupply} onChangeText={v => setForm(prev => ({ ...prev, currentSupply: v }))} keyboardType="numeric" />
                {errors.currentSupply && <Text style={styles.errorText}>{errors.currentSupply}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Alert when below</Text>
                <TextInput style={[styles.input, errors.refillAt && styles.inputError]} placeholder="e.g. 7" placeholderTextColor={C.textMuted} value={form.refillAt} onChangeText={v => setForm(prev => ({ ...prev, refillAt: v }))} keyboardType="numeric" />
                {errors.refillAt && <Text style={styles.errorText}>{errors.refillAt}</Text>}
              </View>
            </View>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]} onPress={handleSave} disabled={isSubmitting} activeOpacity={0.85}>
          <LinearGradient colors={[C.primary, C.primaryDark]} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {isSubmitting ? (
              <Text style={styles.saveBtnText}>Saving...</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color="white" />
                <Text style={styles.saveBtnText}>Save Medication</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: Platform.OS === "ios" ? 56 : 36, paddingBottom: 20, overflow: "hidden" },
  headerDec: { position: "absolute", top: -40, right: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.07)" },
  headerTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: "800", color: "white", marginLeft: 12 },
  content: { padding: 16 },
  card: { backgroundColor: "white", borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: "#047382", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: C.text, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f0f4f5" },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: C.textSub, marginBottom: 8 },
  input: { backgroundColor: C.teal10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.text, borderWidth: 1.5, borderColor: "transparent" },
  inputError: { borderColor: C.danger, backgroundColor: "#fff5f5" },
  inputMulti: { height: 80, textAlignVertical: "top", paddingTop: 12 },
  errorText: { fontSize: 12, color: C.danger, marginTop: 5 },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  colorDotSelected: { transform: [{ scale: 1.15 }], shadowOpacity: 0.3 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.teal10, borderWidth: 1.5, borderColor: "transparent" },
  chipSelected: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: C.primary },
  chipTextSelected: { color: "white" },
  datePicker: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.teal10, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: "transparent" },
  datePickerText: { flex: 1, fontSize: 14, color: C.text, fontWeight: "500" },
  switchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f4f5", gap: 12 },
  switchMeta: { flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: "600", color: C.text },
  switchSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  refillFields: { flexDirection: "row", gap: 12, marginTop: 16 },
  saveBtn: { borderRadius: 16, overflow: "hidden", shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8, marginTop: 8 },
  saveBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 10 },
  saveBtnText: { color: "white", fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
});
