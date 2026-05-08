import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Medication } from "./storage";

// Android channel IDs used only for refill reminders.
const CHANNEL_REMINDER = "medication-reminder";
const CHANNEL_ALARM = "medication-alarm";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export async function ensureRefillNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL_REMINDER, {
    name: "Medication Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#037482",
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_ALARM, {
    name: "Medication Alarms",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 300, 500, 300, 500],
    lightColor: "#037482",
    sound: "default",
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// ─── Refill reminder ─────────────────────────────────────────────────────────
/**
 * One-off notification — only fires when supply is already at/below threshold.
 * Deferred by 3 s so it never fires at the exact save moment.
 */
export async function scheduleRefillReminder(
  medication: Medication,
): Promise<void> {
  if (!medication.refillReminder) return;
  if (medication.currentSupply > medication.refillAt) return; // not low yet

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Refill Reminder",
        body:  `${medication.name} supply is low — only ${medication.currentSupply} units left. Time to refill!`,
        data:  { medicationId: medication.id, type: "refill" },
        sound: "default",
      },
      trigger: {
        // DATE trigger: fires once at the given timestamp (3 s from now)
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 3_000),
        ...(Platform.OS === "android" ? { channelId: CHANNEL_REMINDER } : {}),
      },
    });
  } catch (err) {
    console.error(
      `[MedRemind] Refill reminder schedule failed for ${medication.name}:`,
      err,
    );
  }
}
