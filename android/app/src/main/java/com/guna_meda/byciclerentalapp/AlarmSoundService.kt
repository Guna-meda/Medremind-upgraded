package com.guna_meda.byciclerentalapp

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

class AlarmSoundService : Service() {

    companion object {
        const val CHANNEL_ID = "med_alarm_fg"
        const val FG_NOTIF_ID = 7777
        const val ACTION_STOP = "com.guna_meda.byciclerentalapp.STOP_ALARM"
        const val ACTION_SNOOZE = "com.guna_meda.byciclerentalapp.SNOOZE_ALARM"
        const val EXTRA_MED_NAME = "medName"
        const val EXTRA_MED_DOSAGE = "medDosage"
        const val EXTRA_MED_ID = "medId"
        const val EXTRA_ALARM_TIME = "alarmTime"
        const val EXTRA_ALARM_ID = "alarmId"
        const val EXTRA_SNOOZE_MINUTES = "snoozeMinutes"
        private const val DEFAULT_SNOOZE_MINUTES = 10L
    }

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopAlarm()
                return START_NOT_STICKY
            }
            ACTION_SNOOZE -> {
                scheduleSnooze(intent)
                stopAlarm()
                return START_NOT_STICKY
            }
        }

        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        val medName = intent.getStringExtra(EXTRA_MED_NAME) ?: "Medication"
        val medDosage = intent.getStringExtra(EXTRA_MED_DOSAGE) ?: ""
        val medId = intent.getStringExtra(EXTRA_MED_ID) ?: ""
        val alarmTime = intent.getStringExtra(EXTRA_ALARM_TIME) ?: ""
        val alarmId = intent.getIntExtra(EXTRA_ALARM_ID, -1)

        createNotificationChannel()
        val notification = buildForegroundNotification(medName, medDosage, medId, alarmTime, alarmId)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(FG_NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            @Suppress("DEPRECATION")
            startForeground(FG_NOTIF_ID, notification)
        }

        startRinging()
        return START_REDELIVER_INTENT
    }

    private fun startRinging() {
        stopRinging()
        try {
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(applicationContext, alarmUri)
                isLooping = true
                prepare()
                val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVolume, 0)
                start()
            }
        } catch (error: Exception) {
            error.printStackTrace()
        }

        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        val pattern = longArrayOf(0, 700, 300)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, 0)
        }
    }

    private fun buildForegroundNotification(
        medName: String,
        dosage: String,
        medId: String,
        alarmTime: String,
        alarmId: Int,
    ): Notification {
        val fullScreenIntent = buildAlarmActivityIntent(medName, dosage, medId, alarmTime, alarmId)
        val snoozeIntent = Intent(this, AlarmSoundService::class.java).apply {
            action = ACTION_SNOOZE
            putExtra(EXTRA_MED_NAME, medName)
            putExtra(EXTRA_MED_DOSAGE, dosage)
            putExtra(EXTRA_MED_ID, medId)
            putExtra(EXTRA_ALARM_TIME, alarmTime)
            putExtra(EXTRA_ALARM_ID, alarmId)
        }
        val stopIntent = Intent(this, AlarmSoundService::class.java).apply {
            action = ACTION_STOP
        }
        val snoozePi = PendingIntent.getService(
            this,
            alarmId + 1,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopPi = PendingIntent.getService(
            this,
            alarmId + 2,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Medication Alarm")
            .setContentText(if (dosage.isBlank()) medName else "$medName - $dosage")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(fullScreenIntent)
            .setFullScreenIntent(fullScreenIntent, true)
            .addAction(android.R.drawable.ic_media_pause, "Snooze", snoozePi)
            .addAction(android.R.drawable.ic_delete, "Dismiss", stopPi)
            .build()
    }

    private fun buildAlarmActivityIntent(
        medName: String,
        medDosage: String,
        medId: String,
        alarmTime: String,
        alarmId: Int,
    ): PendingIntent {
        val activityIntent = Intent(this, AlarmActivity::class.java).apply {
            putExtra(EXTRA_MED_NAME, medName)
            putExtra(EXTRA_MED_DOSAGE, medDosage)
            putExtra(EXTRA_MED_ID, medId)
            putExtra(EXTRA_ALARM_TIME, alarmTime)
            putExtra(EXTRA_ALARM_ID, alarmId)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
        }
        return PendingIntent.getActivity(
            this,
            alarmId,
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Medication Alarm Service",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                setBypassDnd(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun stopAlarm() {
        stopRinging()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            @Suppress("DEPRECATION")
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    private fun stopRinging() {
        mediaPlayer?.runCatching {
            if (isPlaying) stop()
            release()
        }
        mediaPlayer = null
        vibrator?.cancel()
        vibrator = null
    }

    private fun scheduleSnooze(intent: Intent) {
        val medName = intent.getStringExtra(EXTRA_MED_NAME) ?: "Medication"
        val medDosage = intent.getStringExtra(EXTRA_MED_DOSAGE) ?: ""
        val medId = intent.getStringExtra(EXTRA_MED_ID) ?: ""
        val snoozeMinutes = intent.getLongExtra(EXTRA_SNOOZE_MINUTES, DEFAULT_SNOOZE_MINUTES)
        AlarmSchedulerModule.scheduleOneShot(
            applicationContext,
            medId = medId,
            medName = medName,
            dosage = medDosage,
            delayMs = snoozeMinutes * 60_000L,
        )
    }

    override fun onDestroy() {
        stopRinging()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            @Suppress("DEPRECATION")
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
