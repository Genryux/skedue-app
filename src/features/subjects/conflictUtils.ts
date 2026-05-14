import { parseTimeToMinutes } from '../../utils/timeUtils';
import { type SubjectRecord } from '../../data/local/db';

export type TimeConflictParams = {
  id?: string;
  days: string[];
  startTime: string;
  endTime: string;
};

export const findTimeConflicts = (
  current: TimeConflictParams,
  existing: SubjectRecord[]
): SubjectRecord[] => {
  const currentStart = parseTimeToMinutes(current.startTime);
  const currentEnd = parseTimeToMinutes(current.endTime);

  if (currentStart === null || currentEnd === null) return [];

  return existing.filter((subject) => {
    // Skip if it's the same subject (for editing)
    if (current.id && subject.id === current.id) return false;

    // Check if they share any days
    const sharedDays = current.days.filter((day) =>
      (subject.days ?? []).includes(day)
    );
    if (sharedDays.length === 0) return false;

    // Check for time overlap
    const subjectStart = parseTimeToMinutes(subject.startTime);
    const subjectEnd = parseTimeToMinutes(subject.endTime);

    if (subjectStart === null || subjectEnd === null) return false;

    // Overlap condition: (StartA < EndB) && (EndA > StartB)
    return currentStart < subjectEnd && currentEnd > subjectStart;
  });
};
