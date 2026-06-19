package com.kenzakigenryu.skedue.widget

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SkedueWidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    const val PREFS_NAME = "skedue_widget"
    const val NAME = "SkedueWidget"
  }

  private val widget by lazy { SkedueWidget() }

  override fun getName(): String = NAME

  private fun getPrefs(): SharedPreferences {
    return reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }

  @ReactMethod
  fun writeWidgetData(json: String, promise: Promise) {
    try {
      val editor = getPrefs().edit()
      editor.putString("widget_data", json)
      editor.putLong("last_sync", System.currentTimeMillis())
      editor.apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("WRITE_ERROR", "Failed to write widget data", e)
    }
  }

  @ReactMethod
  fun requestGlanceUpdate(promise: Promise) {
    try {
      widget.updateAll(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("UPDATE_ERROR", "Failed to update widget", e)
    }
  }
}
