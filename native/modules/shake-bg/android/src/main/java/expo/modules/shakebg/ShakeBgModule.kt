package expo.modules.shakebg

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ShakeBgModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShakeBg")

    AsyncFunction("start") { fortunes: List<String> ->
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(ctx, ShakeService::class.java).apply {
        putStringArrayListExtra("fortunes", ArrayList(fortunes))
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
      true
    }

    AsyncFunction("stop") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      ctx.stopService(Intent(ctx, ShakeService::class.java))
      true
    }

    AsyncFunction("isRunning") {
      ShakeService.running
    }
  }
}
