export type ExerciseType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'weighted_bodyweight'
  | 'assisted_bodyweight'
  | 'duration'
  | 'distance_duration'
  | 'weight_distance';

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export type RecordType = 'max_weight' | 'max_reps' | 'max_volume' | 'max_duration' | 'max_distance';

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface NamedRef {
  id: number;
  name: string;
  slug: string;
}

export interface Exercise {
  id: number;
  name: string;
  description: string | null;
  instructions: string | null;
  exercise_type: ExerciseType;
  is_custom: boolean;
  muscle_group?: NamedRef | null;
  equipment?: NamedRef | null;
  /** The picker group it's listed under; with the muscle group loaded. */
  category?: ExerciseCategory;
  /** Every picker group it shows up under, its own first. */
  categories?: ExerciseCategory[];
  created_at: string;
}

export type ExerciseCategory =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'core'
  | 'cardio'
  | 'other';

export interface ExerciseSet {
  id: number;
  set_number: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  is_completed: boolean;
  volume: number;
}

export interface WorkoutExercise {
  id: number;
  order: number;
  notes: string | null;
  exercise?: Exercise;
  sets?: ExerciseSet[];
  /** Ticked sets from the last finished workout with this exercise; empty the first time. */
  previous_sets?: ExerciseSet[];
}

export interface TemplateExercise {
  id: number;
  order: number;
  target_sets: number | null;
  target_reps: number | null;
  notes: string | null;
  exercise?: Exercise;
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  notes: string | null;
  times_used: number;
  last_used_at: string | null;
  exercises?: TemplateExercise[];
  created_at: string;
}

export interface Workout {
  id: number;
  name: string;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  is_completed: boolean;
  total_volume?: number;
  total_sets?: number;
  template?: WorkoutTemplate | null;
  exercises?: WorkoutExercise[];
  created_at: string;
}

export interface PersonalRecord {
  id: number;
  record_type: RecordType;
  value: number;
  achieved_at: string;
  exercise_set_id: number | null;
  manual_record_id: number | null;
  /** 'manual' when the best is one the user entered by hand, otherwise a logged set. */
  source: 'workout' | 'manual';
  exercise?: Exercise;
  /** The workout the record was set in, when the API includes it. */
  workout?: { id: number; name: string } | null;
}

/** A best the user entered by hand, e.g. a lift from before they used the app. */
export interface ManualRecord {
  id: number;
  record_type: RecordType;
  value: number;
  achieved_at: string;
  exercise?: Exercise;
}

export interface UserStats {
  workouts_count: number;
  total_duration_seconds: number;
  total_sets: number;
  total_volume: number;
  records_count: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface AuthResponse {
  user: User;
  token: string;
}
