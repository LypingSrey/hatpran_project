import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { ExerciseRecordsRow } from '@/components/ExerciseRecordsRow';
import { EmptyState, ErrorBanner, GroupedRow, Loading, useText } from '@/components/ui';
import { api } from '@/lib/api';
import { groupByMuscle } from '@/lib/recordGroups';
import { makeStyles, spacing, useColors } from '@/lib/theme';
import { useApi } from '@/lib/useApi';

/** One muscle group's exercises that have a record, most recently improved first; each opens its own records. */
export default function RecordCategoryScreen() {
  const { group } = useLocalSearchParams<{ group: string }>();
  const { data, error, isLoading, isRefreshing, refresh } = useApi(() => api.allPersonalRecords());
  const styles = useStyles();
  const t = useText();
  const c = useColors();

  if (isLoading && !data) return <Loading />;

  const category = groupByMuscle(data ?? []).find((candidate) => candidate.key === group);
  const exercises = category?.exercises ?? [];

  return (
    <FlatList
      data={exercises}
      keyExtractor={(e) => String(e.exerciseId)}
      style={styles.screen}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={c.textMuted} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Stack.Screen options={{ title: '' }} />
          <Text style={t.title}>{category?.name ?? 'Records'}</Text>
          {category ? (
            <Text style={t.muted}>
              {exercises.length} exercise{exercises.length === 1 ? '' : 's'} · {category.recordCount} record
              {category.recordCount === 1 ? '' : 's'}
            </Text>
          ) : null}
          {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}
        </View>
      }
      ListEmptyComponent={
        error ? null : <EmptyState title="No records here yet" message="Records for this muscle group will show up here." />
      }
      renderItem={({ item, index }) => (
        <GroupedRow index={index} total={exercises.length}>
          <ExerciseRecordsRow group={item} />
        </GroupedRow>
      )}
    />
  );
}

const useStyles = makeStyles((c) => ({
  screen: { backgroundColor: c.background },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xxxl },
  header: { gap: 2, paddingHorizontal: spacing.xs, marginBottom: spacing.md },
}));
