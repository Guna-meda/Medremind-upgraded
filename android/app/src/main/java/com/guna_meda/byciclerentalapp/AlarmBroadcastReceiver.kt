package com.guna_meda.byciclerentalapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * BroadcastReceiver woken by AlarmManager at the scheduled time.
 * Immediately starts AlarmSoundService (foreground) which:
 *   1. Starts ringing / vibrating
 *   2. Launches AlarmActivity (full-screen UI)
 *
 * Also handles BOOT_COMPLETED so alarms survive device restarts.
 */
class AlarmBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_REBOOT,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON" -> {
                // Re-schedule all saved alarms after reboot
                AlarmSchedulerModule.rescheduleAllOnBoot(context)
                return
            }
        }

        val alarmId = intent.getIntExtra(AlarmSoundService.EXTRA_ALARM_ID, -1)
        val medName   = intent.getStringExtra(AlarmSoundService.EXTRA_MED_NAME)   ?: return
        val medDosage = intent.getStringExtra(AlarmSoundService.EXTRA_MED_DOSAGE) ?: ""
        val medId     = intent.getStringExtra(AlarmSoundService.EXTRA_MED_ID)     ?: ""
        val alarmTime = intent.getStringExtra(AlarmSoundService.EXTRA_ALARM_TIME) ?: ""

        if (alarmId != -1) {
            AlarmSchedulerModule.handleTriggeredAlarm(context, alarmId)
        }

        val serviceIntent = Intent(context, AlarmSoundService::class.java).apply {
            putExtra(AlarmSoundService.EXTRA_ALARM_ID, alarmId)
            putExtra(AlarmSoundService.EXTRA_MED_NAME,   medName)
            putExtra(AlarmSoundService.EXTRA_MED_DOSAGE, medDosage)
            putExtra(AlarmSoundService.EXTRA_MED_ID,     medId)
            putExtra(AlarmSoundService.EXTRA_ALARM_TIME, alarmTime)
        }

        ContextCompat.startForegroundService(context, serviceIntent)
    }
}
