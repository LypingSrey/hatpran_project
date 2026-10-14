import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExercisePicker } from '@/components/ExercisePicker';
import { SetRow } from '@/components/SetRow';
import { Button, Card, ErrorBanner, Loading, useText } from '@/components/ui';
import { api, type SetInput } from '@/lib/api';
import { confirm, showError } from '@/lib/dialogs';
import { easeOut, enter } from '@/lib/motion';
import {
  countsTowardVolume,
  formatClock,
  formatDate,
  formatDuration,
  formatNumber,
  formatRecordValue,
  formatTime,
  recordLabels,
  setFieldsFor,
} from '@/lib/format';
import { fonts, makeStyles, radius, spacing, type, useColors } from '@/lib/theme';
import type { Exercise, ExerciseSet, PersonalRecord, Workout, WorkoutExercise } from '@/lib/types';
import { useApi } from '@/lib/useApi';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const { data, error, isLoading, refresh, setData } = useApi(() => api.workout(workoutId), [workoutId]);
  const [newRecords, setNewRecords] = useState<PersonalRecord[] | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingExercises, setAddingExercises] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const styles = useStyles();
  const t = useText();
  const c = useColors();
  const insets = useSafeAreaInsets();
  // Short phones (iPhone SE, many Androids) get a tighter summary so the first card's Add set stays above Finish.
  const compact = useWindowDimensions().height < 740;

  const workout = data?.data;

  // Live timer while the workout is in progress.
  useEffect(() => {
    if (!workout || workout.is_completed) return;
    const tick = () => setElapsed(Math.max(0, (Date.now() - new Date(workout.started_at).getTime()) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [workout]);

  if (isLoading && !workout) return <Loading />;
  if (!workout) {
    return (
      <View style={styles.page}>
        <ErrorBanner message={error ?? 'Workout not found.'} onRetry={refresh} />
      </View>
    );
  }

  // Totals are derived locally so they update as sets are ticked, before any refetch.
  const allSets = (workout.exercises ?? []).flatMap((we) => we.sets ?? []);
  const completedSets = allSets.filter((s) => s.is_completed);
  const totalVolume = (workout.exercises ?? [])
    .filter((we) => countsTowardVolume(we.exercise?.exercise_type ?? 'weight_reps'))
    .flatMap((we) => we.sets ?? [])
    .filter((s) => s.is_completed)
    .reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
  // The next set to do in this session: the first unticked one, in order.
  const currentSetId = workout.is_completed ? null : (allSets.find((s) => !s.is_completed)?.id ?? null);

  const replaceWorkout = (updater: (w: Workout) => Workout) =>
    setData((current) => (current ? { data: updater(current.data) } : current));

  const replaceSets = (workoutExerciseId: number, updater: (sets: ExerciseSet[]) => ExerciseSet[]) =>
    replaceWorkout((w) => ({
      ...w,
      exercises: w.exercises?.map((we) => (we.id === workoutExerciseId ? { ...we, sets: updater(we.sets ?? []) } : we)),
    }));

  // Show the change at once (ticks turn green without waiting on gym signal), then take the server's
  // version; if the save fails, put the set back as it was and say so.
  const saveSet = async (we: WorkoutExercise, set: ExerciseSet, changes: SetInput) => {
    replaceSets(we.id, (sets) => sets.map((s) => (s.id === set.id ? { ...s, ...changes } : s)));
    try {
      const { data: updated } = await api.updateSet(set.id, changes);
      replaceSets(we.id, (sets) => sets.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      replaceSets(we.id, (sets) => sets.map((s) => (s.id === set.id ? set : s)));
      showError(e);
    }
  };

  const addSet = async (we: WorkoutExercise) => {
    // Pre-fill with the previous set so the next one is a single tap.
    const last = we.sets?.at(-1);
    const prefill: SetInput = last
      ? {
          weight_kg: last.weight_kg,
          reps: last.reps,
          distance_meters: last.distance_meters,
          duration_seconds: last.duration_seconds,
        }
      : {};
    try {
      const { data: created } = await api.addSet(we.id, prefill);
      replaceSets(we.id, (sets) => [...sets, created]);
    } catch (e) {
      showError(e);
    }
  };

  // Take the set off at once and number the rest 1, 2, 3 as the server will; if the delete fails, put it back.
  const removeSet = async (we: WorkoutExercise, set: ExerciseSet) => {
    const index = (we.sets ?? []).findIndex((s) => s.id === set.id);
    const renumber = (sets: ExerciseSet[]) => sets.map((s, i) => ({ ...s, set_number: i + 1 }));
    replaceSets(we.id, (sets) => renumber(sets.filter((s) => s.id !== set.id)));
    try {
      await api.deleteSet(set.id);
    } catch (e) {
      replaceSets(we.id, (sets) => renumber([...sets.slice(0, index), set, ...sets.slice(index)]));
      showError(e);
    }
  };

  const deleteSet = (we: WorkoutExercise, set: ExerciseSet) =>
    confirm('Delete set?', `Set ${set.set_number} will be removed.`, 'Delete', () => removeSet(we, set));

  // Add the picked exercises to the end of the workout, in the order they were picked, each with three blank
  // sets as when starting a workout. Stops at the first failure so the list never ends up out of order.
  const addExercises = async (picked: Exercise[]) => {
    setPickerOpen(false);
    setAddingExercises(true);
    try {
      for (const exercise of picked) {
        const { data: created } = await api.addWorkoutExercise(workout.id, {
          exercise_id: exercise.id,
          sets: [{}, {}, {}],
        });
        replaceWorkout((w) => ({ ...w, exercises: [...(w.exercises ?? []), created] }));
      }
    } catch (e) {
      showError(e);
    } finally {
      setAddingExercises(false);
    }
  };

  // Take the exercise off at once; if the delete fails, put it back where it was.
  const removeExercise = (we: WorkoutExercise) =>
    confirm(
      'Remove exercise?',
      `${we.exercise?.name ?? 'This exercise'} and its sets will be removed from this workout.`,
      'Remove',
      async () => {
        const index = (workout.exercises ?? []).findIndex((e) => e.id === we.id);
        replaceWorkout((w) => ({ ...w, exercises: w.exercises?.filter((e) => e.id !== we.id) }));
        try {
          await api.deleteWorkoutExercise(we.id);
        } catch (e) {
          replaceWorkout((w) => {
            const rest = w.exercises ?? [];
            return { ...w, exercises: [...rest.slice(0, index), we, ...rest.slice(index)] };
          });
          showError(e);
        }
      },
    );

  const finish = async () => {
    const pending = allSets.filter((s) => !s.is_completed).length;
    const doFinish = async () => {
      setFinishing(true);
      try {
        const response = await api.completeWorkout(workout.id);
        setData(() => ({ data: response.data }));
        setNewRecords(response.personal_records);
      } catch (e) {
        showError(e);
      } finally {
        setFinishing(false);
      }
    };
    if (pending > 0) {
      confirm(
        'Finish workout?',
        `${pending} set${pending === 1 ? ' is' : 's are'} not ticked and won't count toward volume or records.`,
        'Finish',
        doFinish,
      );
    } else {
      await doFinish();
    }
  };

  const remove = () =>
    confirm('Delete workout?', 'This workout and its sets will be permanently deleted.', 'Delete', async () => {
      try {
        await api.deleteWorkout(workout.id);
        router.back();
      } catch (e) {
        showError(e);
      }
    });

  const progress = allSets.length > 0 ? completedSets.length / allSets.length : 0;

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/workout/edit/${workout.id}`)}
              accessibilityRole="button"
              accessibilityLabel="Edit workout details"
              hitSlop={12}
              style={styles.headerButton}
            >
              <Text style={styles.headerAction}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.page, !workout.is_completed && { paddingBottom: 120 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Rows already there when the screen opens just appear; only sets added or removed afterwards animate. */}
          <LayoutAnimationConfig skipEntering skipExiting>
            <View style={[styles.titleBlock, compact && styles.titleBlockCompact]}>
              <Text style={t.title}>{workout.name}</Text>
              <Text style={t.muted}>
                {formatDate(workout.started_at)} · Started {formatTime(workout.started_at)}
                {workout.template ? ` · ${workout.template.name}` : ''}
              </Text>
            </View>

            {newRecords ? (
              <Animated.View entering={enter}>
                <FinishedNote records={newRecords} />
              </Animated.View>
            ) : null}

            <Card style={[styles.summary, compact && styles.summaryCompact]}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryMain}>
                  <Text style={t.caption}>{workout.is_completed ? 'Duration' : 'Elapsed'}</Text>
                  <Text style={[t.figure, compact && styles.figureCompact]}>
                    {workout.is_completed ? formatDuration(workout.duration_seconds) : formatClock(elapsed)}
                  </Text>
                </View>
                <View style={styles.summaryStats}>
                  <View style={styles.stat}>
                    <Text style={t.stat}>{formatNumber(totalVolume, 0)}</Text>
                    <Text style={t.caption}>kg volume</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={t.stat}>
                      {completedSets.length}/{allSets.length}
                    </Text>
                    <Text style={t.caption}>sets done</Text>
                  </View>
                </View>
              </View>
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityLabel="Sets done"
                accessibilityValue={{ min: 0, max: allSets.length, now: completedSets.length }}
              >
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(progress * 100)}%`,
                      transitionProperty: 'width',
                      transitionDuration: 250,
                      transitionTimingFunction: easeOut,
                    },
                  ]}
                />
              </View>
            </Card>

            {workout.notes ? (
              <Card>
                <Text style={t.body}>{workout.notes}</Text>
              </Card>
            ) : null}

            {(workout.exercises ?? []).length === 0 ? (
              <Card>
                <Text style={t.muted}>This workout has no exercises.</Text>
              </Card>
            ) : null}

            {(workout.exercises ?? []).map((we) => {
              const exerciseType = we.exercise?.exercise_type ?? 'weight_reps';
              const detail = [we.exercise?.muscle_group?.name, we.exercise?.equipment?.name].filter(Boolean).join(' · ');
              return (
                <Card key={we.id} style={styles.exercise}>
                  <View style={styles.exerciseHeadRow}>
                    <View style={styles.exerciseHead}>
                      <Text style={t.heading} accessibilityRole="header">
                        {we.exercise?.name ?? 'Exercise'}
                      </Text>
                      {detail ? <Text style={t.caption}>{detail}</Text> : null}
                      {we.notes ? <Text style={t.muted}>{we.notes}</Text> : null}
                    </View>
                    <Pressable
                      onPress={() => removeExercise(we)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${we.exercise?.name ?? 'exercise'}`}
                      hitSlop={8}
                      style={styles.removeExercise}
                    >
                      <Ionicons name="close" size={22} color={c.textMuted} />
                    </Pressable>
                  </View>

                  <View style={styles.columns}>
                    <Text style={[t.column, styles.setColumn]}>Set</Text>
                    {setFieldsFor(exerciseType).map(({ field, label }) => (
                      <Text key={field} style={[t.column, styles.fieldColumn]}>
                        {label}
                      </Text>
                    ))}
                    <Text style={[t.column, styles.tickColumn]}>Done</Text>
                  </View>

                  {/* A card added mid-session shows its first sets at once; only sets added later animate. */}
                  <LayoutAnimationConfig skipEntering>
                    <View style={styles.sets}>
                      {(we.sets ?? []).map((set, index, sets) => (
                        <SetRow
                          key={set.id}
                          set={set}
                          exerciseType={exerciseType}
                          isCurrent={set.id === currentSetId}
                          hints={index > 0 ? sets[index - 1] : {}}
                          onSave={(changes) => saveSet(we, set, changes)}
                          onDelete={() => deleteSet(we, set)}
                          onRemove={() => void removeSet(we, set)}
                        />
                      ))}
                    </View>
                  </LayoutAnimationConfig>

                  <Button
                    title="Add set"
                    icon="add"
                    variant="secondary"
                    onPress={() => addSet(we)}
                    style={styles.addSet}
                  />
                </Card>
              );
            })}

            <Button
              title="Add exercise"
              icon="add"
              variant="secondary"
              onPress={() => setPickerOpen(true)}
              loading={addingExercises}
            />

            <Text style={[t.caption, styles.hint]}>
              Tap a set number to switch warmup, drop or failure. Swipe a set left to delete it.
            </Text>

            <Button title="Delete workout" variant="danger" onPress={remove} />
          </LayoutAnimationConfig>
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePicker
        visible={pickerOpen}
        excludeIds={(workout.exercises ?? []).flatMap((we) => (we.exercise ? [we.exercise.id] : []))}
        onClose={() => setPickerOpen(false)}
        onDone={(picked) => void addExercises(picked)}
      />

      {/* Finish sits under the thumb for the whole session. */}
      {!workout.is_completed ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Button title="Finish workout" onPress={finish} loading={finishing} />
        </View>
      ) : null}
    </View>
  );
}

function FinishedNote({ records }: { records: PersonalRecord[] }) {
  const styles = useStyles();
  const t = useText();
  const c = useColors();

  if (records.length === 0) {
    return (
      <Card style={styles.finished}>
        <View style={styles.finishedHead}>
          <Ionicons name="checkmark-circle" size={24} color={c.success} />
          <Text style={t.heading}>Workout complete</Text>
        </View>
        <Text style={t.muted}>No new records this time. Keep pushing.</Text>
      </Card>
    );
  }
  return (
    <Card style={styles.finished}>
      <View style={styles.finishedHead}>
        <Ionicons name="trophy" size={22} color={c.record} />
        <Text style={t.heading}>
          {records.length} new personal record{records.length === 1 ? '' : 's'}
        </Text>
      </View>
      {records.map((r) => (
        <View key={r.id} style={styles.recordLine}>
          <Text style={[t.body, styles.flex]}>
            {r.exercise?.name} · {recordLabels[r.record_type]}
          </Text>
          <Text style={styles.highlighted}>{formatRecordValue(r.record_type, r.value)}</Text>
        </View>
      ))}
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1, backgroundColor: c.background },
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  titleBlock: { gap: 2, paddingHorizontal: spacing.xs, marginBottom: spacing.xs },
  summary: { gap: spacing.md, padding: spacing.lg + 2 },
  summaryCompact: { gap: spacing.sm, padding: spacing.md + 2 },
  figureCompact: { fontSize: 36, lineHeight: 42 },
  titleBlockCompact: { marginBottom: 0 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  summaryMain: { gap: 2, flexShrink: 1 },
  summaryStats: { flexDirection: 'row', gap: spacing.lg },
  stat: { alignItems: 'flex-end' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: c.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: c.success },
  exercise: { gap: spacing.md },
  exerciseHeadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  exerciseHead: { gap: 2, flex: 1 },
  removeExercise: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -10, marginRight: -10 },
  columns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs + 2 },
  setColumn: { width: 36, textAlign: 'center' },
  fieldColumn: { flex: 1, textAlign: 'center' },
  tickColumn: { width: 44, textAlign: 'center' },
  sets: { gap: spacing.xs },
  addSet: { minHeight: 44 },
  hint: { textAlign: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  headerAction: { fontFamily: fonts.semibold, fontSize: 17, color: c.accent },
  // Phones inset header buttons themselves; the web header does not.
  headerButton: { paddingHorizontal: Platform.OS === 'web' ? spacing.lg : 0 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: c.background,
    borderTopWidth: 1,
    borderTopColor: c.rule,
  },
  finished: { gap: spacing.sm },
  finishedHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recordLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 },
  highlighted: {
    ...type.bodyStrong,
    fontVariant: ['tabular-nums'],
    color: c.onHighlight,
    backgroundColor: c.highlight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
}));
