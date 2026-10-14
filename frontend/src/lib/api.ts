import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { fetchAllPages } from './paginate';
import type {
  AuthResponse,
  Exercise,
  ExerciseSet,
  ExerciseType,
  ManualRecord,
  NamedRef,
  Paginated,
  PersonalRecord,
  RecordType,
  SetType,
  User,
  UserStats,
  Workout,
  WorkoutExercise,
  WorkoutTemplate,
} from './types';

/**
 * The Laravel API base URL, in order of preference:
 * 1. EXPO_PUBLIC_API_URL, if set.
 * 2. In development on a device, the host of the Expo dev server the app was loaded from
 *    (your Mac's LAN IP), since 127.0.0.1 on a phone points at the phone itself.
 * 3. Localhost (iOS simulator, web), or 10.0.2.2 for the Android emulator.
 */
function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const devServerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (Platform.OS !== 'web' && devServerHost && devServerHost !== 'localhost' && devServerHost !== '127.0.0.1') {
    return `http://${devServerHost}:8000/api`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : 'http://127.0.0.1:8000/api';
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: Record<string, string[]> = {},
  ) {
    super(message);
  }

  /** First validation message for a field, if any. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        // FormData sets its own multipart Content-Type, including the boundary.
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Can't reach the server at ${API_URL}. Is the Laravel API running?`, 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && authToken) {
      onUnauthorized?.();
    }
    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      response.status,
      payload?.errors ?? {},
    );
  }

  return payload as T;
}

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

type Data<T> = { data: T };

export interface SetInput {
  set_type?: SetType;
  weight_kg?: number | null;
  reps?: number | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
  is_completed?: boolean;
}

export interface CompleteWorkoutResponse extends Data<Workout> {
  personal_records: PersonalRecord[];
}

/** A manual record plus the record it now competes for (null when no record exists). */
export interface ManualRecordResponse extends Data<ManualRecord> {
  personal_record: PersonalRecord | null;
}

export const api = {
  register: (body: { name: string; email: string; password: string; password_confirmation: string }) =>
    request<AuthResponse>('POST', '/register', body),
  login: (body: { email: string; password: string }) => request<AuthResponse>('POST', '/login', body),
  logout: () => request<{ message: string }>('POST', '/logout'),
  me: () => request<User>('GET', '/user'),
  updateProfile: (body: { name?: string; email?: string; current_password?: string }) =>
    request<User>('PUT', '/user', body),
  updatePassword: (body: { current_password: string; password: string; password_confirmation: string }) =>
    request<{ message: string }>('PUT', '/user/password', body),
  stats: () => request<Data<UserStats>>('GET', '/user/stats'),
  uploadAvatar: (form: FormData) => request<User>('POST', '/user/avatar', form),
  deleteAvatar: () => request<User>('DELETE', '/user/avatar'),
  deleteAccount: (body: { current_password: string }) => request<void>('DELETE', '/user', body),

  muscleGroups: () => request<Data<NamedRef[]>>('GET', '/muscle-groups'),
  equipment: () => request<Data<NamedRef[]>>('GET', '/equipment'),

  exercises: (params: { search?: string; muscle_group_id?: number; custom_only?: boolean; page?: number } = {}) =>
    request<Paginated<Exercise>>('GET', '/exercises' + query({ per_page: 100, ...params })),
  exercise: (id: number) => request<Data<Exercise>>('GET', `/exercises/${id}`),
  createExercise: (body: {
    name: string;
    exercise_type: ExerciseType;
    muscle_group_id?: number | null;
    equipment_id?: number | null;
    description?: string | null;
  }) => request<Data<Exercise>>('POST', '/exercises', body),
  deleteExercise: (id: number) => request<void>('DELETE', `/exercises/${id}`),
  exerciseRecords: (id: number) => request<Data<PersonalRecord[]>>('GET', `/exercises/${id}/personal-records`),

  workouts: (params: { completed?: boolean; in_progress?: boolean; page?: number; per_page?: number } = {}) =>
    request<Paginated<Workout>>('GET', '/workouts' + query(params)),
  workout: (id: number) => request<Data<Workout>>('GET', `/workouts/${id}`),
  createWorkout: (body: {
    name: string;
    notes?: string | null;
    exercises?: { exercise_id: number; sets?: SetInput[] }[];
  }) => request<Data<Workout>>('POST', '/workouts', body),
  updateWorkout: (
    id: number,
    body: { name?: string; notes?: string | null; started_at?: string; completed_at?: string | null },
  ) =>
    request<CompleteWorkoutResponse>('PUT', `/workouts/${id}`, body),
  completeWorkout: (id: number) => request<CompleteWorkoutResponse>('POST', `/workouts/${id}/complete`),
  deleteWorkout: (id: number) => request<void>('DELETE', `/workouts/${id}`),

  addWorkoutExercise: (workoutId: number, body: { exercise_id: number; notes?: string | null; sets?: SetInput[] }) =>
    request<Data<WorkoutExercise>>('POST', `/workouts/${workoutId}/exercises`, body),
  deleteWorkoutExercise: (id: number) => request<void>('DELETE', `/workout-exercises/${id}`),

  addSet: (workoutExerciseId: number, body: SetInput) =>
    request<Data<ExerciseSet>>('POST', `/workout-exercises/${workoutExerciseId}/sets`, body),
  updateSet: (id: number, body: SetInput) => request<Data<ExerciseSet>>('PUT', `/sets/${id}`, body),
  deleteSet: (id: number) => request<void>('DELETE', `/sets/${id}`),

  templates: () => request<Paginated<WorkoutTemplate>>('GET', '/workout-templates' + query({ per_page: 100 })),
  template: (id: number) => request<Data<WorkoutTemplate>>('GET', `/workout-templates/${id}`),
  createTemplate: (body: {
    name: string;
    notes?: string | null;
    exercises: { exercise_id: number; target_sets?: number | null; target_reps?: number | null }[];
  }) => request<Data<WorkoutTemplate>>('POST', '/workout-templates', body),
  deleteTemplate: (id: number) => request<void>('DELETE', `/workout-templates/${id}`),
  startTemplate: (id: number) => request<Data<Workout>>('POST', `/workout-templates/${id}/start`),

  personalRecords: (params: { per_page?: number; page?: number } = {}) =>
    request<Paginated<PersonalRecord>>('GET', '/personal-records' + query({ per_page: 100, ...params })),
  /** Every record, across all pages, for screens that group them by exercise. */
  allPersonalRecords: () => fetchAllPages((page) => api.personalRecords({ page })),

  manualRecords: (params: { exercise_id?: number } = {}) =>
    request<Paginated<ManualRecord>>('GET', '/manual-records' + query({ per_page: 100, ...params })),
  manualRecord: (id: number) => request<ManualRecordResponse>('GET', `/manual-records/${id}`),
  createManualRecord: (body: { exercise_id: number; record_type: RecordType; value: number; achieved_at: string }) =>
    request<ManualRecordResponse>('POST', '/manual-records', body),
  updateManualRecord: (id: number, body: { value?: number; achieved_at?: string }) =>
    request<ManualRecordResponse>('PUT', `/manual-records/${id}`, body),
  deleteManualRecord: (id: number) => request<void>('DELETE', `/manual-records/${id}`),
};
