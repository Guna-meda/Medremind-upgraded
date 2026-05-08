package com.guna_meda.byciclerentalapp

import android.app.AlarmManager
import android.app.AlarmManager.AlarmClockInfo
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class AlarmSchedulerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AlarmScheduler"

    companion object {
        private const val PREFS_NAME = "MedAlarms"
        private const val KEY_ALARMS = "alarms"
        private const val TAG = "AlarmScheduler"
        private const val MODE_DAILY = "daily"

        fun rescheduleAllOnBoot(context: Context) {
            val records = loadAlarmRecords(context)
            try {
                records.forEach { record ->
                    scheduleFromRecord(context, record)
                }
                Log.d(TAG, "Rescheduled ${records.size} alarms after boot")
            } catch (error: Exception) {
                Log.e(TAG, "Failed to reschedule on boot: ${error.message}")
            }
        }

        fun handleTriggeredAlarm(context: Context, alarmId: Int) {
            val record = findAlarmRecord(context, alarmId) ?: return
            if (record.optString("mode", MODE_DAILY) == MODE_DAILY) {
                scheduleDailyAlarm(
                    context = context,
                    alarmId = alarmId,
                    medId = record.getString("medId"),
                    medName = record.getString("medName"),
                    dosage = record.optString("dosage", ""),
                    hour = record.getInt("hour"),
                    minute = record.getInt("minute"),
                )
            } else {
                removeAlarmRecord(context, alarmId)
            }
        }

        fun scheduleOneShot(
            context: Context,
            medId: String,
            medName: String,
            dosage: String,
            delayMs: Long,
        ) {
            val triggerAtMillis = System.currentTimeMillis() + delayMs
            val alarmId = stableAlarmId("$medId|$medName|$dosage|$triggerAtMillis")
            val timeStr = formatTime(triggerAtMillis)
            val pendingIntent = buildPendingIntent(context, alarmId, medId, medName, dosage, timeStr)
            scheduleAlarmManager(context, alarmId, pendingIntent, medId, medName, dosage, timeStr, triggerAtMillis)
        }

        fun scheduleDailyAlarm(
            context: Context,
            alarmId: Int,
            medId: String,
            medName: String,
            dosage: String,
            hour: Int,
            minute: Int,
        ) {
            val triggerCalendar = nextTriggerCalendar(hour, minute)
            val triggerAtMillis = triggerCalendar.timeInMillis
            val timeStr = "%02d:%02d".format(hour, minute)
            val pendingIntent = buildPendingIntent(context, alarmId, medId, medName, dosage, timeStr)
            scheduleAlarmManager(context, alarmId, pendingIntent, medId, medName, dosage, timeStr, triggerAtMillis)

            saveAlarmRecord(
                context = context,
                alarmId = alarmId,
                medId = medId,
                medName = medName,
                dosage = dosage,
                hour = hour,
                minute = minute,
                mode = MODE_DAILY,
                triggerAtMillis = triggerAtMillis,
            )
            Log.d(TAG, "Daily alarm scheduled for $medName at $timeStr (alarmId=$alarmId)")
        }

        private fun scheduleFromRecord(context: Context, record: JSONObject) {
            if (record.optString("mode", MODE_DAILY) != MODE_DAILY) return
            scheduleDailyAlarm(
                context = context,
                alarmId = record.getInt("alarmId"),
                medId = record.getString("medId"),
                medName = record.getString("medName"),
                dosage = record.optString("dosage", ""),
                hour = record.getInt("hour"),
                minute = record.getInt("minute"),
            )
        }

        private fun scheduleAlarmManager(
            context: Context,
            alarmId: Int,
            pendingIntent: PendingIntent,
            medId: String,
            medName: String,
            dosage: String,
            timeStr: String,
            triggerAtMillis: Long,
        ) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val canUseExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()

            if (canUseExact) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                } else {
                    @Suppress("DEPRECATION")
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
                }
                return
            }

            val showIntent = buildAlarmClockShowIntent(context, alarmId, medId, medName, dosage, timeStr)
            alarmManager.setAlarmClock(AlarmClockInfo(triggerAtMillis, showIntent), pendingIntent)
            Log.w(TAG, "Exact alarm permission unavailable; using alarm-clock fallback for alarmId=$alarmId")
        }

        private fun buildPendingIntent(
            context: Context,
            alarmId: Int,
            medId: String,
            medName: String,
            dosage: String,
            timeStr: String,
        ): PendingIntent {
            val intent = Intent(context, AlarmBroadcastReceiver::class.java).apply {
                putExtra(AlarmSoundService.EXTRA_ALARM_ID, alarmId)
                putExtra(AlarmSoundService.EXTRA_MED_NAME, medName)
                putExtra(AlarmSoundService.EXTRA_MED_DOSAGE, dosage)
                putExtra(AlarmSoundService.EXTRA_MED_ID, medId)
                putExtra(AlarmSoundService.EXTRA_ALARM_TIME, timeStr)
            }
            return PendingIntent.getBroadcast(
                context,
                alarmId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        private fun buildAlarmClockShowIntent(
            context: Context,
            alarmId: Int,
            medId: String,
            medName: String,
            dosage: String,
            timeStr: String,
        ): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                putExtra(AlarmSoundService.EXTRA_ALARM_ID, alarmId)
                putExtra(AlarmSoundService.EXTRA_MED_NAME, medName)
                putExtra(AlarmSoundService.EXTRA_MED_DOSAGE, dosage)
                putExtra(AlarmSoundService.EXTRA_MED_ID, medId)
                putExtra(AlarmSoundService.EXTRA_ALARM_TIME, timeStr)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            return PendingIntent.getActivity(
                context,
                alarmId + 10_000,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        private fun nextTriggerCalendar(hour: Int, minute: Int): Calendar {
            val now = Calendar.getInstance()
            return Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hour)
                set(Calendar.MINUTE, minute)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (before(now)) add(Calendar.DAY_OF_YEAR, 1)
            }
        }

        private fun formatTime(triggerAtMillis: Long): String {
            val calendar = Calendar.getInstance().apply { timeInMillis = triggerAtMillis }
            return "%02d:%02d".format(
                calendar.get(Calendar.HOUR_OF_DAY),
                calendar.get(Calendar.MINUTE),
            )
        }

        private fun stableAlarmId(seed: String): Int = Math.abs(seed.hashCode()).takeIf { it != 0 } ?: 1

        private fun loadAlarmRecords(context: Context): List<JSONObject> {
            val stored = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(KEY_ALARMS, "[]")
                ?: "[]"
            return try {
                val array = JSONArray(stored)
                List(array.length()) { index -> array.getJSONObject(index) }
            } catch (_: Exception) {
                emptyList()
            }
        }

        private fun findAlarmRecord(context: Context, alarmId: Int): JSONObject? {
            return loadAlarmRecords(context).firstOrNull { it.optInt("alarmId") == alarmId }
        }

        private fun saveAlarmRecord(
            context: Context,
            alarmId: Int,
            medId: String,
            medName: String,
            dosage: String,
            hour: Int,
            minute: Int,
            mode: String,
            triggerAtMillis: Long,
        ) {
            val records = loadAlarmRecords(context).toMutableList()
            records.removeAll { it.optInt("alarmId") == alarmId }
            records.add(JSONObject().apply {
                put("alarmId", alarmId)
                put("medId", medId)
                put("medName", medName)
                put("dosage", dosage)
                put("hour", hour)
                put("minute", minute)
                put("mode", mode)
                put("triggerAtMillis", triggerAtMillis)
            })
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_ALARMS, JSONArray(records).toString())
                .apply()
        }

        private fun removeAlarmRecord(context: Context, alarmId: Int) {
            val records = loadAlarmRecords(context).filter { it.optInt("alarmId") != alarmId }
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_ALARMS, JSONArray(records).toString())
                .apply()
        }
    }

    @ReactMethod
    fun scheduleAlarm(
        medId: String,
        medName: String,
        dosage: String,
        hour: Int,
        minute: Int,
        alarmId: Int,
        promise: Promise,
    ) {
        try {
            scheduleDailyAlarm(reactContext, alarmId, medId, medName, dosage, hour, minute)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("ERR_SCHEDULE", error.message, error)
        }
    }

    @ReactMethod
    fun cancelAlarm(alarmId: Int, promise: Promise) {
        try {
            val dummyIntent = Intent(reactContext, AlarmBroadcastReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                alarmId,
                dummyIntent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            )
            pendingIntent?.let {
                val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                alarmManager.cancel(it)
                it.cancel()
            }
            removeAlarmRecord(reactContext, alarmId)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("ERR_CANCEL", error.message, error)
        }
    }

    @ReactMethod
    fun cancelAlarmsForMedication(medId: String, promise: Promise) {
        try {
            val records = loadAlarmRecords(reactContext).filter { it.getString("medId") == medId }
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            records.forEach { record ->
                val alarmId = record.getInt("alarmId")
                val pendingIntent = PendingIntent.getBroadcast(
                    reactContext,
                    alarmId,
                    Intent(reactContext, AlarmBroadcastReceiver::class.java),
                    PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
                )
                pendingIntent?.let {
                    alarmManager.cancel(it)
                    it.cancel()
                }
                removeAlarmRecord(reactContext, alarmId)
            }
            promise.resolve(records.size)
        } catch (error: Exception) {
            promise.reject("ERR_CANCEL_MED", error.message, error)
        }
    }

    @ReactMethod
    fun stopAlarmSound(promise: Promise) {
        try {
            reactContext.stopService(Intent(reactContext, AlarmSoundService::class.java))
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("ERR_STOP", error.message, error)
        }
    }

    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            promise.resolve(alarmManager.canScheduleExactAlarms())
        } else {
            promise.resolve(true)
        }
    }
}
