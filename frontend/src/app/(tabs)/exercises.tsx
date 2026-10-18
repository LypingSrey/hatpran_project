import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Chip, EmptyState, ErrorBanner, GroupedRow, Loading, ScreenTitle, useText } from '@/components/ui';
import { api } from '@/lib/api';
import { exerciseTypeLabels } from '@/lib/format';
import { makeStyles, radius, spacing, type, useColors } from '@/lib/theme';
import { useApi } from '@/lib/useApi';

export default function ExercisesScreen() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [muscleGroupId, setMuscleGroupId] = useState<number | undefined>();
  const [customOnly, setCustomOnly] = useState(false);
  const styles = useStyles();
  const t = useText();
  const c = useColors();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const muscleGroups = useApi(() => api.muscleGroups());
  const exercises = useApi(
    () =>
      api.exercises({
        search: debouncedSearch || undefined,
        muscle_group_id: muscleGroupId,
        custom_only: customOnly || undefined,
      }),
    [debouncedSearch, muscleGroupId, customOnly],
  );

  const list = exercises.data?.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <View style={styles.titleRow}>
          <ScreenTitle
            title="Exercises"
            right={
              <Pressable
                onPress={() => router.push('/exercise/new')}
                accessibilityRole="button"
                accessibilityLabel="New custom exercise"
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={26} color={c.onAccent} />
              </Pressable>
            }
          />
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search exercises"
            placeholderTextColor={c.textFaint}
            selectionColor={c.accent}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={styles.searchInput}
            accessibilityLabel="Search exercises"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Custom" selected={customOnly} onPress={() => setCustomOnly((v) => !v)} />
          <Chip label="All muscles" selected={muscleGroupId === undefined} onPress={() => setMuscleGroupId(undefined)} />
          {(muscleGroups.data?.data ?? []).map((mg) => (
            <Chip
              key={mg.id}
              label={mg.name}
              selected={muscleGroupId === mg.id}
              onPress={() => setMuscleGroupId(muscleGroupId === mg.id ? undefined : mg.id)}
            />
          ))}
        </ScrollView>
      </View>

      {exercises.isLoading && !exercises.data ? (
        <Loading />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(e) => String(e.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            exercises.error ? <ErrorBanner message={exercises.error} onRetry={exercises.refresh} /> : null
          }
          ListEmptyComponent={
            exercises.error ? null : <EmptyState title="No exercises match" message="Try a different search or filter." />
          }
          renderItem={({ item, index }) => (
            <GroupedRow index={index} total={list.length}>
              <Pressable
                onPress={() => router.push(`/exercise/${item.id}`)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
              >
                <View style={styles.rowText}>
                  <Text style={t.body}>{item.name}</Text>
                  <Text style={t.caption}>
                    {[item.muscle_group?.name, item.equipment?.name, exerciseTypeLabels[item.exercise_type]]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {item.is_custom ? <Text style={styles.customBadge}>Custom</Text> : null}
                <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
              </Pressable>
            </GroupedRow>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  filters: { gap: spacing.md, paddingBottom: spacing.md },
  titleRow: { paddingHorizontal: spacing.lg },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: c.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.md,
    backgroundColor: c.surfaceMuted,
  },
  searchInput: { ...type.body, flex: 1, minHeight: 46, color: c.text },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  rowPressed: { backgroundColor: c.surfaceMuted },
  rowText: { flex: 1, gap: 2 },
  customBadge: {
    ...type.caption,
    fontFamily: type.label.fontFamily,
    color: c.accent,
    backgroundColor: c.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
}));
