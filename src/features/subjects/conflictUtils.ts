import { parseTimeToMinutes } from '../../utils/timeUtils';
import { type SubjectRecord } from '../../data/local/db';

export type TimeConflictParams = {
  id?: string;
  days: string[];
  startTime: string;
  endTime: string;
};

export type TimeConflict = {
  subject: SubjectRecord;
  sharedDays: string[];
  subjectStartTime: string;
  subjectEndTime: string;
};

export const findTimeConflicts = (
  current: TimeConflictParams,
  existing: SubjectRecord[]
): TimeConflict[] => {
  const currentStart = parseTimeToMinutes(current.startTime);
  const currentEnd = parseTimeToMinutes(current.endTime);

  if (currentStart === null || currentEnd === null) return [];

  return existing.flatMap((subject) => {
    // Skip if it's the same subject (for editing)
    if (current.id && subject.id === current.id) return [];

    // Check if they share any days
    const sharedDays = current.days.filter((day) =>
      (subject.days ?? []).includes(day)
    );
    if (sharedDays.length === 0) return [];

    // Check for time overlap
    const subjectStart = parseTimeToMinutes(subject.startTime);
    const subjectEnd = parseTimeToMinutes(subject.endTime);

    if (subjectStart === null || subjectEnd === null) return [];

    // Overlap condition: (StartA < EndB) && (EndA > StartB)
    if (!(currentStart < subjectEnd && currentEnd > subjectStart)) {
      return [];
    }

    return [{
      subject,
      sharedDays,
      subjectStartTime: subject.startTime ?? '',
      subjectEndTime: subject.endTime ?? '',
    }];
  });
};
