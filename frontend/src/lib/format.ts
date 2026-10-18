import type { ExerciseCategory, ExerciseType, RecordType } from './types';

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return '—';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

/** A stopwatch reading: 4:05, or 1:04:05 past an hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  // Show the year only when it isn't this year, e.g. for records entered from before the app.
  const showYear = date.getFullYear() !== new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(showYear ? { year: 'numeric' } : {}),
  });
}

/** Local time of day, e.g. 18:30 or 6:30 PM depending on the device's settings. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD, for date inputs. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local time as HH:MM, for time inputs. */
export function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Combine a YYYY-MM-DD date and HH:MM time typed by the user into a local Date.
 * Returns null when either is malformed or names a day that doesn't exist (e.g. 2026-02-30).
 */
export function parseDateTimeInput(dateText: string, timeText = '12:00'): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(timeText.trim());
  if (!d || !t) return null;
  const [year, month, day, hours, minutes] = [...d.slice(1), ...t.slice(1)].map(Number);
  if (hours > 23 || minutes > 59) return null;
  const date = new Date(year, month - 1, day, hours, minutes);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function formatNumber(value: number | null | undefined, maxDecimals = 1): string {
  if (value == null) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

export const recordLabels: Record<RecordType, string> = {
  max_weight: 'Heaviest weight',
  max_reps: 'Most reps',
  max_volume: 'Best set volume',
  max_duration: 'Longest duration',
  max_distance: 'Longest distance',
};

export function formatRecordValue(type: RecordType, value: number): string {
  switch (type) {
    case 'max_weight':
      return `${formatNumber(value, 2)} kg`;
    case 'max_volume':
      return `${formatNumber(value)} kg`;
    case 'max_reps':
      return `${formatNumber(value, 0)} reps`;
    case 'max_duration':
      return formatDuration(value);
    case 'max_distance':
      return `${formatNumber(value, 0)} m`;
  }
}

/** Which records an exercise type tracks. Mirrors Exercise::personalRecordTypes() in the API. */
export function recordTypesFor(type: ExerciseType): RecordType[] {
  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      return ['max_weight', 'max_reps', 'max_volume'];
    case 'bodyweight_reps':
    case 'assisted_bodyweight':
      return ['max_reps'];
    case 'duration':
      return ['max_duration'];
    case 'distance_duration':
      return ['max_distance', 'max_duration'];
    case 'weight_distance':
      return ['max_weight', 'max_distance'];
  }
}

/**
 * Whether a set's weight × reps counts as volume. An assisted exercise's weight is help, not load.
 * Mirrors Exercise::countsTowardVolume() in the API.
 */
export function countsTowardVolume(type: ExerciseType): boolean {
  return type !== 'assisted_bodyweight';
}

/** Input label for typing a record value, and whether it takes decimals. */
export const recordInputs: Record<RecordType, { label: string; decimals: boolean }> = {
  max_weight: { label: 'Weight (kg)', decimals: true },
  max_reps: { label: 'Reps', decimals: false },
  max_volume: { label: 'Set volume (kg × reps)', decimals: true },
  max_duration: { label: 'Duration (seconds)', decimals: false },
  max_distance: { label: 'Distance (meters)', decimals: false },
};

export const exerciseTypeLabels: Record<ExerciseType, string> = {
  weight_reps: 'Weight & reps',
  bodyweight_reps: 'Bodyweight reps',
  weighted_bodyweight: 'Weighted bodyweight',
  assisted_bodyweight: 'Assisted bodyweight',
  duration: 'Duration',
  distance_duration: 'Distance & duration',
  weight_distance: 'Weight & distance',
};

/** The exercise picker's groups, in the order it shows them. */
export const exerciseCategoryLabels: Record<ExerciseCategory, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
  other: 'Other',
};

export type SetField = 'weight_kg' | 'reps' | 'distance_meters' | 'duration_seconds';

/** Which set inputs make sense for an exercise type, with their column labels. */
export function setFieldsFor(type: ExerciseType): { field: SetField; label: string }[] {
  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      return [
        { field: 'weight_kg', label: 'kg' },
        { field: 'reps', label: 'Reps' },
      ];
    case 'assisted_bodyweight':
      return [
        { field: 'weight_kg', label: 'Assist kg' },
        { field: 'reps', label: 'Reps' },
      ];
    case 'bodyweight_reps':
      return [{ field: 'reps', label: 'Reps' }];
    case 'duration':
      return [{ field: 'duration_seconds', label: 'Seconds' }];
    case 'distance_duration':
      return [
        { field: 'distance_meters', label: 'Meters' },
        { field: 'duration_seconds', label: 'Seconds' },
      ];
    case 'weight_distance':
      return [
        { field: 'weight_kg', label: 'kg' },
        { field: 'distance_meters', label: 'Meters' },
      ];
  }
}
