import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { MuscleIcon } from '@/components/MuscleIcon';
import { EmptyState, ErrorBanner, GroupedRow, Loading, ScreenTitle, useText } from '@/components/ui';
import { api } from '@/lib/api';
import { groupByMuscle } from '@/lib/recordGroups';
import { makeStyles, radius, spacing, useColors } from '@/lib/theme';
import { useApi } from '@/lib/useApi';

/** Records split by muscle group (Chest, Back, …); a category opens its exercises and their records. */
export default function RecordsScreen() {
  // Load every page: records are grouped, so a partial list would split or drop groups.
  const { data, error, isLoading, isRefreshing, refresh } = useApi(() => api.allPersonalRecords());
  const styles = useStyles();
  const t = useText();
  const c = useColors();

  if (isLoading && !data) return <Loading />;

  const categories = groupByMuscle(data ?? []);

  return (
    <FlatList
      data={categories}
      keyExtractor={(category) => category.key}
      style={styles.screen}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={c.textMuted} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle
            title="Records"
            right={
              <Pressable
                onPress={() => router.push('/record/manual')}
                accessibilityRole="button"
                accessibilityLabel="Add a past record"
                style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={26} color={c.onAccent} />
              </Pressable>
            }
          />
          {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        error ? null : (
          <EmptyState
            title="No records yet"
            message="Finish a workout with ticked sets, or add a best you set before, and it will appear here."
          />
        )
      }
      renderItem={({ item, index }) => {
        const exercises = item.exercises.length;
        return (
          <GroupedRow index={index} total={categories.length}>
            <Pressable
              onPress={() => router.push({ pathname: '/records/[group]', params: { group: item.key } })}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${exercises} exercise${exercises === 1 ? '' : 's'}, ${item.recordCount} records`}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.badge}>
                <MuscleIcon name={item.name} color={c.accent} />
              </View>
              <View style={styles.rowText}>
                <Text style={t.bodyStrong}>{item.name}</Text>
                <Text style={t.caption} numberOfLines={1}>
                  {exercises} exercise{exercises === 1 ? '' : 's'} · {item.exercises.map((e) => e.name).join(', ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
            </Pressable>
          </GroupedRow>
        );
      }}
    />
  );
}

const useStyles = makeStyles((c) => ({
  screen: { backgroundColor: c.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: c.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    minHeight: 68,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowPressed: { backgroundColor: c.surfaceMuted },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
}));
