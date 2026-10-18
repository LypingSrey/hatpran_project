import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Chip, ErrorBanner, Field, Section } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { exerciseTypeLabels } from '@/lib/format';
import { makeStyles, spacing } from '@/lib/theme';
import type { ExerciseCategory, ExerciseType } from '@/lib/types';
import { useApi } from '@/lib/useApi';

const exerciseTypes = Object.keys(exerciseTypeLabels) as ExerciseType[];

/** The muscle group to start on when the picker sends a category over; "other" starts on none. */
const categoryMuscleGroups: Record<ExerciseCategory, string | null> = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  legs: 'quadriceps',
  core: 'abs',
  cardio: 'cardio',
  other: null,
};

export default function NewExerciseScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('weight_reps');
  const { category } = useLocalSearchParams<{ category?: ExerciseCategory }>();
  // Undefined until the user taps a muscle group, so the one the picker's category suggests shows till then.
  const [pickedMuscleGroupId, setMuscleGroupId] = useState<number | null>();
  const [equipmentId, setEquipmentId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const styles = useStyles();

  const muscleGroups = useApi(() => api.muscleGroups());
  const equipment = useApi(() => api.equipment());

  const presetSlug = category ? categoryMuscleGroups[category] : null;
  const muscleGroupId =
    pickedMuscleGroupId !== undefined
      ? pickedMuscleGroupId
      : (muscleGroups.data?.data.find((mg) => mg.slug === presetSlug)?.id ?? null);

  const save = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.createExercise({
        name: name.trim(),
        exercise_type: exerciseType,
        muscle_group_id: muscleGroupId,
        equipment_id: equipmentId,
        description: description.trim() || null,
      });
      router.replace(`/exercise/${data.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('Something went wrong.', 0));
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {error && !error.field('name') ? <ErrorBanner message={error.message} /> : null}
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Zercher Squat" error={error?.field('name')} />
      <Field label="Description (optional)" value={description} onChangeText={setDescription} multiline />

      <ChoiceGroup title="How is it measured?">
        {exerciseTypes.map((type) => (
          <Chip key={type} label={exerciseTypeLabels[type]} selected={exerciseType === type} onPress={() => setExerciseType(type)} />
        ))}
      </ChoiceGroup>

      <ChoiceGroup title="Muscle group">
        {(muscleGroups.data?.data ?? []).map((mg) => (
          <Chip
            key={mg.id}
            label={mg.name}
            selected={muscleGroupId === mg.id}
            onPress={() => setMuscleGroupId(muscleGroupId === mg.id ? null : mg.id)}
          />
        ))}
      </ChoiceGroup>

      <ChoiceGroup title="Equipment">
        {(equipment.data?.data ?? []).map((eq) => (
          <Chip
            key={eq.id}
            label={eq.name}
            selected={equipmentId === eq.id}
            onPress={() => setEquipmentId(equipmentId === eq.id ? null : eq.id)}
          />
        ))}
      </ChoiceGroup>

      <Button title="Save exercise" onPress={save} loading={submitting} disabled={!name.trim()} style={styles.save} />
    </ScrollView>
  );
}

/** A heading with a wrapping row of choice chips under it. */
function ChoiceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <Section title={title} style={styles.group}>
      <View style={styles.chips}>{children}</View>
    </Section>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { backgroundColor: c.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl },
  group: { marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  save: { marginTop: spacing.md },
}));
