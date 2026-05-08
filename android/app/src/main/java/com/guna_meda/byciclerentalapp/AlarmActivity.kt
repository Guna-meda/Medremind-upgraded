package com.guna_meda.byciclerentalapp

import android.app.Activity
import android.app.KeyguardManager
import android.content.Intent
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

class AlarmActivity : Activity() {

    private val snoozeMinutes = 10L
    private var currentAlarmId = -1
    private var currentMedId = ""
    private var currentMedName = "Medication"
    private var currentDosage = ""
    private var currentAlarmTime = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureLockscreenWindow()
        bindIntent(intent)
        renderContent()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            setIntent(intent)
            bindIntent(intent)
            renderContent()
        }
    }

    private fun configureLockscreenWindow() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            val keyguardManager = getSystemService(KeyguardManager::class.java)
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
            )
        }
    }

    private fun bindIntent(intent: Intent) {
        currentAlarmId = intent.getIntExtra(AlarmSoundService.EXTRA_ALARM_ID, -1)
        currentMedName = intent.getStringExtra(AlarmSoundService.EXTRA_MED_NAME) ?: "Medication"
        currentDosage = intent.getStringExtra(AlarmSoundService.EXTRA_MED_DOSAGE) ?: ""
        currentMedId = intent.getStringExtra(AlarmSoundService.EXTRA_MED_ID) ?: ""
        currentAlarmTime = intent.getStringExtra(AlarmSoundService.EXTRA_ALARM_TIME) ?: ""
    }

    private fun renderContent() {
        setContentView(buildUI(currentMedName, currentDosage, currentAlarmTime, currentMedId, currentAlarmId))
    }

    private fun buildUI(
        medName: String,
        dosage: String,
        time: String,
        medId: String,
        alarmId: Int,
    ): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(0xFF025a64.toInt())
            setPadding(48, 80, 48, 80)
        }

        val headerChip = TextView(this).apply {
            text = "MEDICATION ALARM"
            textSize = 13f
            gravity = Gravity.CENTER
            setTextColor(0xFF8bdcf1.toInt())
            setPadding(28, 12, 28, 12)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = 999f
                setColor(0x1AFFFFFF)
            }
        }

        val iconCircle = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(160, 160).also {
                it.topMargin = 28
                it.bottomMargin = 32
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0x26FFFFFF)
            }
        }

        val icon = TextView(this).apply {
            text = "ALARM"
            textSize = 28f
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(0xFFFFFFFF.toInt())
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
        }
        iconCircle.addView(icon)

        val nameView = TextView(this).apply {
            text = medName
            textSize = 30f
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(0, 0, 0, 10)
        }

        val dosageView = TextView(this).apply {
            text = dosage
            textSize = 20f
            gravity = Gravity.CENTER
            setTextColor(0xFFD3EEF5.toInt())
            setPadding(0, 0, 0, 8)
        }

        val timeView = TextView(this).apply {
            text = if (time.isBlank()) "" else time
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(0xFF7ab5c0.toInt())
            setPadding(0, 0, 0, 48)
        }

        val divider = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                1,
            ).also { it.bottomMargin = 48 }
            setBackgroundColor(0x22FFFFFF)
        }

        val snoozeBtn = Button(this).apply {
            text = "Snooze ${snoozeMinutes} min"
            textSize = 17f
            setTextColor(0xFF037482.toInt())
            setBackgroundColor(0xFFD3EEF5.toInt())
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                130,
            ).also { it.bottomMargin = 18 }
            setOnClickListener { snooze(medId, medName, dosage, alarmId) }
        }

        val dismissBtn = Button(this).apply {
            text = "Dismiss"
            textSize = 17f
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFF037482.toInt())
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                130,
            )
            setOnClickListener { dismiss() }
        }

        root.addView(headerChip)
        root.addView(iconCircle)
        root.addView(nameView)
        root.addView(dosageView)
        root.addView(timeView)
        root.addView(divider)
        root.addView(snoozeBtn)
        root.addView(dismissBtn)

        return root
    }

    private fun dismiss() {
        stopAlarmService()
        finish()
    }

    private fun snooze(medId: String, medName: String, dosage: String, alarmId: Int) {
        stopAlarmService()
        AlarmSchedulerModule.scheduleOneShot(
            applicationContext,
            medId = medId,
            medName = medName,
            dosage = dosage,
            delayMs = snoozeMinutes * 60_000L,
        )
        if (alarmId != -1) {
            // Let the current ringing instance stop cleanly; the new snooze is a one-shot alarm.
        }
        finish()
    }

    private fun stopAlarmService() {
        stopService(Intent(this, AlarmSoundService::class.java))
    }

    override fun onBackPressed() {
        // no-op; alarm must be dismissed or snoozed explicitly
    }
}
