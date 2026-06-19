package com.kenzakigenryu.skedue.widget

data class WidgetData(
  val dateLabel: String,
  val scheduleItems: List<ScheduleItem>,
  val urgentCount: Int
)

data class ScheduleItem(
  val id: String,
  val title: String,
  val timeRange: String,
  val location: String
)
