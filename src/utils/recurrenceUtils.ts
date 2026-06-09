import { TaskRecord, TaskCompletionRecord } from '../data/local/db';

export const END_OF_TIME = 4102444800000;

export const DAY_MAP: Record<string, number> = {
  su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

export const calculateNextOccurrenceDate = (
  task: Pick<TaskRecord, 'startDate' | 'dueAt' | 'repeatType' | 'repeatInterval' | 'repeatDays' | 'endDate'>,
  afterDate: number = Date.now()
): number => {
  if (task.repeatType === 'none' || !task.startDate) {
    return END_OF_TIME;
  }

  const baseDate = new Date(task.startDate);
  let next = new Date(baseDate);

  if (next.getTime() > afterDate) {
    return next.getTime();
  }

  const interval = Math.max(1, task.repeatInterval || 1);

  while (next.getTime() <= afterDate) {
    if (task.repeatType === 'daily') {
      next.setDate(next.getDate() + interval);
      if (task.repeatDays && task.repeatDays.length > 0) {
        const days = task.repeatDays.map(d => DAY_MAP[d.toLowerCase()]).sort();
        while (!days.includes(next.getDay())) {
          next.setDate(next.getDate() + 1);
        }
      }
    } else if (task.repeatType === 'weekly') {
      if (task.repeatDays && task.repeatDays.length > 0) {
        const days = task.repeatDays.map(d => DAY_MAP[d.toLowerCase()]).sort();
        const currentDay = next.getDay();
        let nextDay = days.find(d => d > currentDay);
        if (nextDay !== undefined) {
          next.setDate(next.getDate() + (nextDay - currentDay));
        } else {
          nextDay = days[0];
          const daysToAdd = (7 - currentDay) + nextDay + (interval - 1) * 7;
          next.setDate(next.getDate() + daysToAdd);
        }
      } else {
        next.setDate(next.getDate() + 7 * interval);
      }
    } else if (task.repeatType === 'monthly') {
      next.setMonth(next.getMonth() + interval);
    } else if (task.repeatType === 'yearly') {
      next.setFullYear(next.getFullYear() + interval);
    } else {
      break;
    }
  }

  if (task.endDate && next.getTime() > task.endDate) {
    return END_OF_TIME;
  }

  return next.getTime();
};

export const isSameCalendarDay = (a: number, b: number): boolean => {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

export type ExpandedTask = TaskRecord & {
  virtualId: string;
  occurrenceDate: number;
  isCompleted: boolean;
};

export const getExpandedTasksForRange = (
  tasks: TaskRecord[],
  completions: TaskCompletionRecord[],
  rangeStart: number,
  rangeEnd: number
): ExpandedTask[] => {
  const expanded: ExpandedTask[] = [];

  for (const task of tasks) {
    if (!task.startDate) continue;
    if (task.startDate > rangeEnd) continue;
    if (task.endDate && task.startDate > task.endDate) continue;

    let current = new Date(task.startDate);
    const interval = Math.max(1, task.repeatInterval || 1);

    // Fast-forward optimization for daily and simple weekly
    if (task.repeatType === 'daily') {
      if (current.getTime() < rangeStart && (!task.repeatDays || task.repeatDays.length === 0)) {
        const diffDays = Math.floor((rangeStart - current.getTime()) / (1000 * 60 * 60 * 24));
        const intervalsToSkip = Math.floor(diffDays / interval);
        current.setDate(current.getDate() + intervalsToSkip * interval);
      } else if (current.getTime() < rangeStart && task.repeatDays && task.repeatDays.length > 0) {
        const days = task.repeatDays.map(d => DAY_MAP[d.toLowerCase()]).sort();
        while (current.getTime() < rangeStart) {
          current.setDate(current.getDate() + interval);
          while (!days.includes(current.getDay())) {
            current.setDate(current.getDate() + 1);
          }
        }
      }
    } else if (task.repeatType === 'weekly' && (!task.repeatDays || task.repeatDays.length === 0)) {
      if (current.getTime() < rangeStart) {
        const diffDays = Math.floor((rangeStart - current.getTime()) / (1000 * 60 * 60 * 24));
        const intervalsToSkip = Math.floor(diffDays / (7 * interval));
        current.setDate(current.getDate() + intervalsToSkip * 7 * interval);
      }
    }

    const maxIterations = 2000;
    let iterations = 0;

    while (current.getTime() <= rangeEnd && iterations < maxIterations) {
      iterations++;
      
      if (current.getTime() >= rangeStart && current.getTime() <= rangeEnd) {
        const occTime = current.getTime();
        const isCompleted = completions.some(c => c.taskId === task.id && c.occurrenceDate === occTime);
        
        expanded.push({
          ...task,
          virtualId: `${task.id}-${occTime}`,
          occurrenceDate: occTime,
          isCompleted
        });
      }

      if (task.repeatType === 'none') break;

      if (task.repeatType === 'daily') {
        current.setDate(current.getDate() + interval);
        if (task.repeatDays && task.repeatDays.length > 0) {
          const days = task.repeatDays.map(d => DAY_MAP[d.toLowerCase()]).sort();
          while (!days.includes(current.getDay())) {
            current.setDate(current.getDate() + 1);
          }
        }
      } else if (task.repeatType === 'weekly') {
        if (task.repeatDays && task.repeatDays.length > 0) {
          const days = task.repeatDays.map(d => DAY_MAP[d.toLowerCase()]).sort();
          const currentDay = current.getDay();
          let nextDay = days.find(d => d > currentDay);
          if (nextDay !== undefined) {
            current.setDate(current.getDate() + (nextDay - currentDay));
          } else {
            nextDay = days[0];
            const daysToAdd = (7 - currentDay) + nextDay + (interval - 1) * 7;
            current.setDate(current.getDate() + daysToAdd);
          }
        } else {
          current.setDate(current.getDate() + 7 * interval);
        }
      } else if (task.repeatType === 'monthly') {
        current.setMonth(current.getMonth() + interval);
      } else if (task.repeatType === 'yearly') {
        current.setFullYear(current.getFullYear() + interval);
      } else {
        break;
      }

      if (task.endDate && current.getTime() > task.endDate) break;
    }
  }

  return expanded;
};
