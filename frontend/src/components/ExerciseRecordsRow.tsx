import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { formatDate } from '@/lib/format';
import type { ExerciseRecords } from '@/lib/recordGroups';
import { makeStyles, radius, spacing, useColors } from '@/lib/theme';

import { useText } from './ui';

/** One exercise that has records: its name, how many and when the latest was set. Opens the exercise's records. */
export function ExerciseRecordsRow({ group }: { group: ExerciseRecords }) {
  const styles = useStyles();
  const t = useText();
  const c = useColors();
  const count = group.records.length;
  const summary = `${count} record${count === 1 ? '' : 's'} · ${formatDate(group.latest)}`;

  return (
    <Pressable
      onPress={() => router.push(`/exercise/${group.exerciseId}`)}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${summary}`}
      accessibilityHint="Open this exercise's records"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.trophy}>
        <Ionicons name="trophy" size={18} color={c.record} />
      </View>
      <View style={styles.rowText}>
        <Text style={t.bodyStrong} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={t.caption}>{summary}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    minHeight: 68,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowPressed: { backgroundColor: c.surfaceMuted },
  trophy: {
    width: 32,
    height: 32,
    borderRadius: radius.round,
    backgroundColor: c.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
}));
