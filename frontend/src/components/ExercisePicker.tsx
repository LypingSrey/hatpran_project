import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { exerciseCategoryLabels } from '@/lib/format';
import { makeStyles, radius, spacing, type, useColors } from '@/lib/theme';
import type { Exercise, ExerciseCategory } from '@/lib/types';
import { useApi } from '@/lib/useApi';

import { Button, Chip, EmptyState, ErrorBanner, GroupedRow, Loading, useText } from './ui';

type Filter = ExerciseCategory | 'all';

const categories = Object.keys(exerciseCategoryLabels) as ExerciseCategory[];

const primaryOf = (e: Exercise): ExerciseCategory => e.category ?? 'other';
const isIn = (e: Exercise, category: ExerciseCategory) => (e.categories ?? [primaryOf(e)]).includes(category);

/**
 * Full-screen sheet for choosing one or more exercises, grouped by muscle category. With `single`, a tap picks
 * and closes. Loads every exercise once when it opens, so switching categories and searching are instant.
 */
export function ExercisePicker({
  visible,
  onClose,
  onDone,
  excludeIds = [],
  single = false,
  title = single ? 'Choose exercise' : 'Add exercises',
  doneLabel = 'Add',
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (exercises: Exercise[]) => void;
  excludeIds?: number[];
  single?: boolean;
  title?: string;
  /** The bottom bar's button, e.g. "Start workout". */
  doneLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Filter>('all');
  const [selected, setSelected] = useState<Exercise[]>([]);
  const styles = useStyles();
  const t = useText();
  const c = useColors();

  // Loads with the screen, so the picker opens instantly, and again on each opening or return to the
  // screen, so a custom exercise made in the meantime shows up.
  const { data: exercises, error, refresh } = useApi(() => api.allExercises(), [visible]);

  const toggle = (exercise: Exercise) =>
    setSelected((current) =>
      current.some((e) => e.id === exercise.id)
        ? current.filter((e) => e.id !== exercise.id)
        : [...current, exercise],
    );

  // Every way out clears the picks, search and category, so the next opening starts fresh on "All".
  const reset = () => {
    setSelected([]);
    setSearch('');
    setCategory('all');
  };

  const close = () => {
    reset();
    onClose();
  };

  const done = (picked: Exercise[]) => {
    reset();
    onDone(picked);
  };

  const addCustom = (preset?: ExerciseCategory) => {
    close();
    router.push(preset ? `/exercise/new?category=${preset}` : '/exercise/new');
  };

  const available = (exercises ?? []).filter((e) => !excludeIds.includes(e.id));
  const query = search.trim();

  // Search looks across every category; "All" groups by each exercise's own category; a chip lists everything
  // tagged with it, including exercises whose own category is another one.
  // Empty sections are dropped, since SectionList only shows its empty state when there are none.
  const sections = (
    query
      ? [{ key: 'search', title: '', data: available.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())) }]
      : category === 'all'
        ? categories.map((cat) => ({
            key: cat,
            title: exerciseCategoryLabels[cat],
            data: available.filter((e) => primaryOf(e) === cat),
          }))
        : [{ key: category, title: '', data: available.filter((e) => isIn(e, category)) }]
  ).filter((section) => section.data.length > 0);

  const empty = query ? (
    <EmptyState
      title={`No exercises match '${query}'`}
      action={<Button title="Add custom exercise" icon="add" variant="secondary" onPress={() => addCustom()} />}
    />
  ) : (
    <EmptyState
      title={category === 'all' ? 'No exercises yet' : `No exercises in ${exerciseCategoryLabels[category]} yet`}
      action={
        <Button
          title="Add custom exercise"
          icon="add"
          variant="secondary"
          onPress={() => addCustom(category === 'all' ? undefined : category)}
        />
      }
    />
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Button title="Cancel" variant="ghost" onPress={close} />
          <Text style={t.heading}>{title}</Text>
          {/* Keeps the title centred. */}
          <View style={{ width: 80 }} />
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search all exercises"
            placeholderTextColor={c.textFaint}
            selectionColor={c.accent}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={styles.searchInput}
            accessibilityLabel="Search all exercises"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chipBar}
          contentContainerStyle={styles.chips}
        >
          {(['all', ...categories] as Filter[]).map((cat) => (
            <Chip
              key={cat}
              label={cat === 'all' ? 'All' : exerciseCategoryLabels[cat]}
              count={cat === 'all' ? available.length : available.filter((e) => isIn(e, cat)).length}
              selected={category === cat}
              onPress={() => {
                // A chip tap means "show me this group", so it ends any search.
                setSearch('');
                setCategory(cat);
              }}
            />
          ))}
        </ScrollView>

        {error ? <ErrorBanner message={error} onRetry={() => void refresh()} /> : null}

        {exercises === undefined && !error ? (
          <Loading />
        ) : (
          <SectionList
            // A new key per view remounts the list, so a chip tap always starts at the top.
            key={query ? 'search' : category}
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            stickySectionHeadersEnabled
            contentContainerStyle={styles.list}
            ListEmptyComponent={exercises ? empty : null}
            renderSectionHeader={({ section }) =>
              section.title ? (
                <Text style={styles.sectionHeader} accessibilityRole="header">
                  {`${section.title.toUpperCase()} · ${section.data.length}`}
                </Text>
              ) : null
            }
            renderItem={({ item, index, section }) => {
              const isSelected = selected.some((e) => e.id === item.id);
              return (
                <GroupedRow index={index} total={section.data.length}>
                  <Pressable
                    onPress={() => (single ? done([item]) : toggle(item))}
                    accessibilityRole={single ? 'button' : 'checkbox'}
                    accessibilityState={single ? undefined : { checked: isSelected }}
                    style={({ pressed }) => [styles.row, isSelected && styles.rowSelected, pressed && styles.rowPressed]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={t.body}>{item.name}</Text>
                      <Text style={t.caption}>
                        {[item.muscle_group?.name, item.equipment?.name, item.is_custom ? 'Custom' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    {query ? <Text style={styles.categoryTag}>{exerciseCategoryLabels[primaryOf(item)]}</Text> : null}
                    {single ? (
                      <Ionicons name="chevron-forward" size={20} color={c.textFaint} />
                    ) : (
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={26}
                        color={isSelected ? c.accent : c.ruleStrong}
                      />
                    )}
                  </Pressable>
                </GroupedRow>
              );
            }}
          />
        )}

        {single ? null : (
          <View style={styles.bottomBar}>
            <Text style={[t.label, styles.selectedCount]} accessibilityLiveRegion="polite">
              {selected.length === 0
                ? 'No exercises selected'
                : `${selected.length} exercise${selected.length === 1 ? '' : 's'} selected`}
            </Text>
            <Button
              title={doneLabel}
              disabled={selected.length === 0}
              onPress={() => done(selected)}
            />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    minHeight: 52,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.surfaceMuted,
  },
  searchInput: { ...type.body, flex: 1, minHeight: 44, color: c.text },
  // Never shrinks, or the list below squeezes it to nothing once it fills the screen.
  chipBar: { flexGrow: 0, flexShrink: 0 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sectionHeader: {
    ...type.caption,
    color: c.textMuted,
    letterSpacing: 0.6,
    backgroundColor: c.background,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 64,
  },
  rowSelected: { backgroundColor: c.accentSoft },
  rowPressed: { backgroundColor: c.surfaceMuted },
  categoryTag: { ...type.caption, color: c.textMuted },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.rule,
    backgroundColor: c.background,
  },
  selectedCount: { flex: 1, color: c.text },
}));
