package com.kenzakigenryu.skedue.widget

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

object WidgetDataManager {
  private const val PREFS_NAME = "skedue_widget"
  private const val KEY_DATA = "widget_data"

  fun load(context: Context): WidgetData {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val json = prefs.getString(KEY_DATA, null) ?: return WidgetData("", emptyList(), 0)
    return parse(json)
  }

  private fun parse(json: String): WidgetData {
    return try {
      val obj = JSONObject(json)
      val scheduleArr = obj.optJSONArray("schedule") ?: JSONArray()
      val items = mutableListOf<ScheduleItem>()
      for (i in 0 until scheduleArr.length()) {
        val item = scheduleArr.getJSONObject(i)
        items.add(
          ScheduleItem(
            id = item.optString("id", ""),
            title = item.optString("title", ""),
            timeRange = item.optString("timeRange", ""),
            location = item.optString("location", "")
          )
        )
      }
      WidgetData(
        dateLabel = obj.optString("dateLabel", ""),
        scheduleItems = items,
        urgentCount = obj.optInt("urgentCount", 0)
      )
    } catch (e: Exception) {
      WidgetData("", emptyList(), 0)
    }
  }
}
