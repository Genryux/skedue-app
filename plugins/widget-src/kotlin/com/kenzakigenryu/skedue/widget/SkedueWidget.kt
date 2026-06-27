package com.kenzakigenryu.skedue.widget

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.LocalContext
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

private val SUBJECT_ID_KEY = ActionParameters.Key<String>("subjectId")

class OpenSubjectAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    val subjectId = parameters[SUBJECT_ID_KEY] ?: return
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    intent?.putExtra("widgetAction", "open_subject")
    intent?.putExtra("subjectId", subjectId)
    intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    context.startActivity(intent)
  }
}

class OpenHomeAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    context.startActivity(intent)
  }
}

class SkedueWidget : GlanceAppWidget() {
  companion object {
    private val _refreshTrigger: MutableState<Int> = mutableStateOf(0)
    fun triggerRefresh() {
      _refreshTrigger.value++
    }
  }

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    Log.d("SkedueWidget", "provideGlance: started")
    provideContent { Content() }
  }

  @Composable
  private fun Content() {
    val refresh by _refreshTrigger
    val ctx = LocalContext.current
    val data = WidgetDataManager.load(ctx)
    Log.d("SkedueWidget", "Content: recomposed refresh=$refresh (scheduleItems=${data.scheduleItems.size}, urgentCount=${data.urgentCount})")
    val isDark = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    val bg = if (isDark) Color(0xFF1C2F2A) else Color(0xFFFFFFFF)
    val textPrimary = if (isDark) Color(0xFFD7E4DD) else Color(0xFF1E2B26)
    val textMuted = if (isDark) Color(0xFF90A39A) else Color(0xFF8F968F)
    val accent = Color(0xFF4D7E6A)
    val urgentRed = Color(0xFFE53935)
    val cardBg = if (isDark) Color(0xFF2A3D36) else Color(0xFFF8F7F2)
    val separator = if (isDark) Color(0xFF3A4D46) else Color(0xFFE0DDD5)

    Column(
      modifier = GlanceModifier.fillMaxSize().background(bg).padding(16.dp),
      verticalAlignment = Alignment.Top
    ) {
      Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
          text = "Today\u2019s Schedule",
          style = TextStyle(color = ColorProvider(textPrimary), fontSize = 16.sp, fontWeight = FontWeight.Bold),
          modifier = GlanceModifier.defaultWeight()
        )
        if (data.dateLabel.isNotEmpty()) {
          Text(
            text = data.dateLabel,
            style = TextStyle(color = ColorProvider(textMuted), fontSize = 11.sp)
          )
        }
      }

      Spacer(modifier = GlanceModifier.height(12.dp))

      if (data.scheduleItems.isEmpty()) {
        Text(
          text = "No classes today",
          style = TextStyle(color = ColorProvider(textMuted), fontSize = 13.sp),
          modifier = GlanceModifier.padding(vertical = 24.dp)
        )
        Spacer(modifier = GlanceModifier.defaultWeight())
      } else {
        LazyColumn(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
          items(data.scheduleItems.size) { index ->
            val item = data.scheduleItems[index]
            Row(
              modifier = GlanceModifier
                .fillMaxWidth()
                .background(cardBg)
                .clickable(
                  actionRunCallback<OpenSubjectAction>(
                    actionParametersOf(SUBJECT_ID_KEY to item.id)
                  )
                ),
              verticalAlignment = Alignment.Top
            ) {
              Column(modifier = GlanceModifier.defaultWeight()) {
                Column(modifier = GlanceModifier.padding(12.dp)) {
                  Text(
                    text = item.title,
                    style = TextStyle(color = ColorProvider(textPrimary), fontSize = 13.sp, fontWeight = FontWeight.Bold),
                    maxLines = 1
                  )
                  Spacer(modifier = GlanceModifier.height(2.dp))
                  Text(
                    text = item.timeRange,
                    style = TextStyle(color = ColorProvider(textMuted), fontSize = 11.sp),
                    maxLines = 1
                  )
                  if (item.location.isNotEmpty()) {
                    Text(
                      text = item.location,
                      style = TextStyle(color = ColorProvider(textMuted), fontSize = 11.sp),
                      maxLines = 1
                    )
                  }
                }
                Row(
                  modifier = GlanceModifier.fillMaxWidth().height(1.dp).background(separator)
                ) {}
              }
            }
          }
        }
      }

      Spacer(modifier = GlanceModifier.height(4.dp))

      Row(
        modifier = GlanceModifier
          .fillMaxWidth()
          .clickable(actionRunCallback<OpenHomeAction>()),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        if (data.urgentCount > 0) {
          Text(
            text = "\u25CF",
            style = TextStyle(
              color = ColorProvider(urgentRed),
              fontSize = 10.sp
            ),
            modifier = GlanceModifier.padding(end = 6.dp)
          )
        }
        Text(
          text = if (data.urgentCount > 0) "${data.urgentCount} urgent task${if (data.urgentCount != 1) "s" else ""} today"
            else "No urgent tasks",
          style = TextStyle(
            color = ColorProvider(textPrimary),
            fontSize = 12.sp,
            fontWeight = if (data.urgentCount > 0) FontWeight.Bold else FontWeight.Normal
          )
        )
      }
    }
  }
}
