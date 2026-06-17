package expo.modules.shakebg

import android.app.*
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlin.math.sqrt
import kotlin.random.Random

class ShakeService : Service(), SensorEventListener {
  companion object {
    @Volatile var running = false
    const val CHANNEL_PERSIST = "shake_persist"
    const val CHANNEL_FORTUNE = "fortune"
    const val NOTIF_ID_PERSIST = 9001
    const val SHAKE_G = 2.2f
    const val COOLDOWN_MS = 4000L
  }

  private lateinit var sensorManager: SensorManager
  private var accel: Sensor? = null
  private var fortunes: List<String> = emptyList()
  private var lastShake = 0L

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    accel = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    createChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    intent?.getStringArrayListExtra("fortunes")?.let { fortunes = it.toList() }
    if (fortunes.isEmpty()) fortunes = listOf("오늘도 좋은 하루 되세요 ✨")
    startForeground(NOTIF_ID_PERSIST, buildPersistNotification())
    accel?.let {
      sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
    }
    running = true
    return START_STICKY
  }

  override fun onDestroy() {
    sensorManager.unregisterListener(this)
    running = false
    super.onDestroy()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun onSensorChanged(event: SensorEvent) {
    val x = event.values[0]; val y = event.values[1]; val z = event.values[2]
    val gForce = sqrt(x*x + y*y + z*z) / SensorManager.GRAVITY_EARTH
    if (gForce > SHAKE_G) {
      val now = System.currentTimeMillis()
      if (now - lastShake > COOLDOWN_MS) {
        lastShake = now
        sendFortune()
      }
    }
  }

  private fun sendFortune() {
    val text = fortunes[Random.nextInt(fortunes.size)]
    val notif = NotificationCompat.Builder(this, CHANNEL_FORTUNE)
      .setSmallIcon(android.R.drawable.star_on)
      .setContentTitle("🥠 오늘의 포춘쿠키")
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setVibrate(longArrayOf(0, 80, 60, 80))
      .build()
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      .notify(Random.nextInt(100000), notif)
  }

  private fun buildPersistNotification(): Notification {
    return NotificationCompat.Builder(this, CHANNEL_PERSIST)
      .setSmallIcon(android.R.drawable.star_on)
      .setContentTitle("🥠 포춘쿠키 대기 중")
      .setContentText("핸드폰을 흔들면 운세를 보내드려요")
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .build()
  }

  private fun createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_PERSIST, "흔들기 감지", NotificationManager.IMPORTANCE_LOW).apply {
        description = "백그라운드 흔들기 감지 상태 표시"
      }
    )
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_FORTUNE, "포춘쿠키 알림", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "운세 멘트를 전달합니다"
        enableVibration(true)
      }
    )
  }
}
