import { getAllTasks, getSubjects } from '../data/local/db';
import { parseTimeToMinutes } from '../utils/timeUtils';
import { isSameCalendarDay } from '../utils/recurrenceUtils';
import { writeWidgetData, requestGlanceUpdate } from '../../modules/skedue-widget/index';

const DAY_MAP_JS: Record<string, number> = {
  Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6,
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

export const END_OF_TIME = 4102444800000;

const formatTime = (time: string | null | undefined) => {
  if (!time) return '';
  if (/am|pm/i.test(time)) return time;
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
};

const isBeforeToday = (date: number) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return date < todayStart.getTime();
};

export async function syncWidgetData() {
  try {
    const now = new Date();
    const todayDay = now.getDay();

    const subjects = await getSubjects();
    const todaySubjects = subjects
      .filter((s) => !s.isArchived && (s.days ?? []).some((day) => DAY_MAP_JS[day] === todayDay))
      .map((s) => ({
        id: s.id,
        title: s.title,
        timeRange: s.startTime && s.endTime
          ? `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`
          : s.startTime
            ? formatTime(s.startTime)
            : '',
        location: s.location ?? '',
      }))
      .sort((a, b) => {
        const aTime = parseTimeToMinutes(a.timeRange.split(' - ')[0]) ?? 0;
        const bTime = parseTimeToMinutes(b.timeRange.split(' - ')[0]) ?? 0;
        return aTime - bTime;
      });

    const archivedSubjectIds = new Set(
      subjects.filter((s) => s.isArchived).map((s) => s.id)
    );
    const tasks = await getAllTasks();
    const pending = tasks.filter(
      (t) => t.nextOccurrenceDate < END_OF_TIME && !archivedSubjectIds.has(t.subjectId)
    );
    const urgentCount = pending.filter(
      (t) => isBeforeToday(t.nextOccurrenceDate) || isSameCalendarDay(t.nextOccurrenceDate, Date.now())
    ).length;

    const widgetData = {
      dateLabel: now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      schedule: todaySubjects,
      urgentCount,
    };

    await writeWidgetData(JSON.stringify(widgetData));
    await requestGlanceUpdate();
  } catch (error) {
    console.warn('Failed to sync widget data', error);
  }
}
