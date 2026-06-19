package com.kenzakigenryu.skedue.widget

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.action.ActionParameters
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.LazyColumn
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

object OpenSubjectAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, actionParameters: ActionParameters) {
    val subjectId = actionParameters[SUBJECT_ID_KEY] ?: return
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    intent?.putExtra("widgetAction", "open_subject")
    intent?.putExtra("subjectId", subjectId)
    intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    context.startActivity(intent)
  }
}

object OpenHomeAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, actionParameters: ActionParameters) {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    intent?.putExtra("widgetAction", "open_home")
    intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    context.startActivity(intent)
  }
}

private val SUBJECT_ID_KEY = ActionParameters.Key<String>("subjectId")

class SkedueWidget : GlanceAppWidget() {

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val data = WidgetDataManager.load(context)
    provideContent { Content(data = data) }
  }

  @Composable
  private fun Content(data: WidgetData) {
    val ctx = LocalContext.current
    val isDark = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    val bg = if (isDark) Color(0xFF1C2F2A) else Color(0xFFFFFFFF)
    val textPrimary = if (isDark) Color(0xFFD7E4DD) else Color(0xFF1E2B26)
    val textMuted = if (isDark) Color(0xFF90A39A) else Color(0xFF8F968F)
    val accent = Color(0xFF4D7E6A)
    val cardBg = if (isDark) Color(0xFF2A3D36) else Color(0xFFF8F7F2)

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
      } else {
        LazyColumn(modifier = GlanceModifier.fillMaxWidth()) {
          items(data.scheduleItems.size) { index ->
            val item = data.scheduleItems[index]
            Row(
              modifier = GlanceModifier
                .fillMaxWidth()
                .background(cardBg)
                .padding(12.dp)
                .clickable(onClick = OpenSubjectAction::class, actionParametersOf(SUBJECT_ID_KEY to item.id)),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Column(modifier = GlanceModifier.defaultWeight()) {
                Text(
                  text = item.title,
                  style = TextStyle(color = ColorProvider(textPrimary), fontSize = 13.sp, fontWeight = FontWeight.Bold),
                  maxLines = 1
                )
                Spacer(modifier = GlanceModifier.height(4.dp))
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
            }
            if (index < data.scheduleItems.size - 1) {
              Spacer(modifier = GlanceModifier.height(8.dp))
            }
          }
        }
      }

      Spacer(modifier = GlanceModifier.height(8.dp))

      Row(
        modifier = GlanceModifier.fillMaxWidth().clickable(onClick = OpenHomeAction::class),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = if (data.urgentCount > 0) "\u26A0  ${data.urgentCount} urgent task${if (data.urgentCount != 1) "s" else ""} today"
            else "No urgent tasks",
          style = TextStyle(
            color = ColorProvider(if (data.urgentCount > 0) accent else textPrimary),
            fontSize = 12.sp,
            fontWeight = if (data.urgentCount > 0) FontWeight.Bold else FontWeight.Normal
          )
        )
      }
    }
  }
}
