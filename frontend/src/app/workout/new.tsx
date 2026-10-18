import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ExercisePicker } from '@/components/ExercisePicker';
import { Stepper } from '@/components/Stepper';
import { Button, Card, Chip, ErrorBanner, Field, Rule, Section, useText } from '@/components/ui';
import { api } from '@/lib/api';
import { offerResumeIfBusy } from '@/lib/dialogs';
import { makeStyles, spacing, useColors } from '@/lib/theme';
import type { Exercise } from '@/lib/types';
import { errorMessage } from '@/lib/useApi';

interface Entry {
  exercise: Exercise;
  sets: number;
}

// Shown after today's time-of-day name, so there's never a "Morning workout" chip in the evening.
const NAME_SUGGESTIONS = ['Push day', 'Pull day', 'Leg day', 'Full body'];

function defaultName(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning workout';
  if (hour < 17) return 'Afternoon workout';
  return 'Evening workout';
}

export default function NewWorkoutScreen() {
  const [name, setName] = useState(defaultName);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles();
  const t = useText();
  const c = useColors();

  const start = async (list: Entry[] = entries) => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.createWorkout({
        name: name.trim() || defaultName(),
        exercises: list.map((e) => ({
          exercise_id: e.exercise.id,
          sets: Array.from({ length: e.sets }, () => ({})),
        })),
      });
      router.replace(`/workout/${data.id}`);
    } catch (e) {
      setSubmitting(false);
      if (await offerResumeIfBusy(e)) return;
      setError(errorMessage(e));
    }
  };

  const changeSets = (index: number, delta: number) =>
    setEntries((current) =>
      current.map((e, i) => (i === index ? { ...e, sets: Math.min(20, Math.max(1, e.sets + delta)) } : e)),
    );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.name}>
        <Field label="Workout name" value={name} onChangeText={setName} />
        <View style={styles.suggestions}>
          {[defaultName(), ...NAME_SUGGESTIONS].map((suggestion) => (
            <Chip key={suggestion} label={suggestion} selected={name === suggestion} onPress={() => setName(suggestion)} />
          ))}
        </View>
      </View>

      <Section title="Exercises" style={styles.section}>
        {entries.length === 0 ? (
          <Text style={t.muted}>Add the exercises you plan to do. You can add more sets as you go.</Text>
        ) : (
          <Card flush>
            {entries.map((entry, index) => (
              <Fragment key={entry.exercise.id}>
                {index > 0 ? <Rule /> : null}
                <View style={styles.entry}>
                  <View style={styles.entryText}>
                    <Text style={t.body}>{entry.exercise.name}</Text>
                    <Text style={t.caption}>
                      {entry.sets} set{entry.sets === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Stepper label="sets" onMinus={() => changeSets(index, -1)} onPlus={() => changeSets(index, 1)} />
                  <Pressable
                    onPress={() => setEntries((current) => current.filter((_, i) => i !== index))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry.exercise.name}`}
                    style={styles.remove}
                  >
                    <Ionicons name="close" size={22} color={c.textMuted} />
                  </Pressable>
                </View>
              </Fragment>
            ))}
          </Card>
        )}
        <Button title="Add exercises" icon="add" variant="secondary" onPress={() => setPickerOpen(true)} />
      </Section>

      <Button title="Start workout" onPress={() => void start()} loading={submitting} style={styles.start} />

      <ExercisePicker
        visible={pickerOpen}
        excludeIds={entries.map((e) => e.exercise.id)}
        doneLabel="Start workout"
        onClose={() => setPickerOpen(false)}
        // The picker's Start workout starts right away, with three sets for each exercise picked.
        onDone={(picked) => {
          const list = [...entries, ...picked.map((exercise) => ({ exercise, sets: 3 }))];
          setEntries(list);
          setPickerOpen(false);
          void start(list);
        }}
      />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { backgroundColor: c.background },
  page: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  name: { gap: spacing.sm },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { marginTop: spacing.xl },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 68, paddingVertical: spacing.sm, paddingLeft: spacing.lg, paddingRight: spacing.sm },
  entryText: { flex: 1, gap: 2 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  start: { marginTop: spacing.xl },
}));
