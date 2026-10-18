import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

import { api, ApiError } from './api';
import type { Workout } from './types';
import { errorMessage } from './useApi';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
}

let presentConfirm: ((request: ConfirmRequest) => void) | null = null;

/** Lets the in-app dialog (ConfirmDialogHost) show web confirmations. Returns a function that unregisters it. */
export function setConfirmPresenter(present: (request: ConfirmRequest) => void) {
  presentConfirm = present;
  return () => {
    if (presentConfirm === present) presentConfirm = null;
  };
}

/**
 * Ask before acting. Native gets an Alert; web gets the in-app dialog, since the browser's own confirm can't show
 * a red Delete button (window.confirm stays as a fallback). Destructive actions get a red button.
 */
export function confirm(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  { destructive = true }: { destructive?: boolean } = {},
) {
  if (Platform.OS === 'web') {
    if (presentConfirm) presentConfirm({ title, message, confirmLabel, destructive, onConfirm });
    else if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

/** A one-button message, calling onClose once it's dismissed. */
export function notify(title: string, message: string, onClose?: () => void) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(`${title}\n\n${message}`);
    onClose?.();
    return;
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: onClose }]);
}

export function showError(e: unknown) {
  const message = errorMessage(e);
  if (Platform.OS === 'web') globalThis.alert?.(message);
  else Alert.alert('Could not save', message);
}

/** Only one workout runs at a time: point back to the one in progress instead of starting another. */
export function offerResume(workout: Workout) {
  confirm(
    'Workout in progress',
    `Finish or delete “${workout.name}” before starting a new one.`,
    'Resume',
    () => router.push(`/workout/${workout.id}`),
    { destructive: false },
  );
}

/** When a start was refused because a workout is in progress (409), offer to resume it. Returns whether it did. */
export async function offerResumeIfBusy(e: unknown): Promise<boolean> {
  if (!(e instanceof ApiError && e.status === 409)) return false;
  const active = (await api.workouts({ in_progress: true, per_page: 1 }).catch(() => null))?.data[0];
  if (active) offerResume(active);
  return !!active;
}
