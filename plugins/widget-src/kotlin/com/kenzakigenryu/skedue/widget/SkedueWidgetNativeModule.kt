package com.kenzakigenryu.skedue.widget

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SkedueWidgetNativeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SkedueWidgetNative"

  private val appContext: Context
    get() = reactApplicationContext

  @ReactMethod
  fun writeWidgetData(json: String) {
    WidgetDataManager.write(appContext, json)
  }

  @ReactMethod
  fun requestGlanceUpdate() {
    CoroutineScope(Dispatchers.IO).launch {
      try {
        SkedueWidget().updateAll(appContext)
      } catch (e: Exception) {
        Log.e("SkedueWidget", "update failed", e)
      }
    }
  }
}
