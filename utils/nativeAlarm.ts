import { Alert, NativeModules, PermissionsAndroid, Platform } from "react-native";
import type { Medication } from "./storage";

type AlarmSchedulerNative = {
  scheduleAlarm: (
    medId: string,
    medName: string,
    dosage: string,
    hour: number,
    minute: number,
    alarmId: number,
  ) => Promise<boolean>;
  cancelAlarm: (alarmId: number) => Promise<boolean>;
  cancelAlarmsForMedication: (medId: string) => Promise<number>;
  stopAlarmSound: () => Promise<boolean>;
  canScheduleExactAlarms: () => Promise<boolean>;
};

const { AlarmScheduler } = NativeModules as { AlarmScheduler?: AlarmSchedulerNative };

function getScheduler(): AlarmSchedulerNative {
  if (!AlarmScheduler) {
    throw new Error("AlarmScheduler native module is not available");
  }
  return AlarmScheduler;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
}

export function alarmIdForMedicationTime(medicationId: string, time: string): number {
  return hashString(`${medicationId}:${time}`);
}

async function ensurePostNotificationPermission(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (Number(Platform.Version) < 33) return;

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  const granted = await PermissionsAndroid.check(permission);
  if (granted) return;

  const result = await PermissionsAndroid.request(permission);
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    Alert.alert(
      "Notifications disabled",
      "Medication alarms need notification permission to display the ringing service notification.",
    );
  }
}

export async function ensureAlarmSchedulerReady(): Promise<boolean> {
  await ensurePostNotificationPermission();
  return true;
}

export async function canScheduleExactAlarms(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    return await getScheduler().canScheduleExactAlarms();
  } catch {
    return false;
  }
}

export async function scheduleMedicationReminder(medication: Medication): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!medication.reminderEnabled || medication.times.length === 0) return;

  await ensureAlarmSchedulerReady();
  const uniqueTimes = Array.from(new Set(medication.times));
  await Promise.all(
    uniqueTimes.map(async (time) => {
      const [hour, minute] = time.split(":").map(Number);
      await getScheduler().scheduleAlarm(
        medication.id,
        medication.name,
        medication.dosage,
        hour,
        minute,
        alarmIdForMedicationTime(medication.id, time),
      );
    }),
  );
}

export async function cancelMedicationReminders(medicationId: string): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await getScheduler().cancelAlarmsForMedication(medicationId);
  } catch (error) {
    console.error("[MedRemind] Failed to cancel alarms:", error);
  }
}

export async function updateMedicationReminders(medication: Medication): Promise<void> {
  if (Platform.OS !== "android") return;
  await cancelMedicationReminders(medication.id);
  await scheduleMedicationReminder(medication);
}

export async function stopAlarmSound(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await getScheduler().stopAlarmSound();
  } catch (error) {
    console.error("[MedRemind] Failed to stop alarm:", error);
  }
}
