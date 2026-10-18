import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatDate, formatRecordValue, formatTime, recordLabels } from '@/lib/format';
import { makeStyles, radius, spacing, type, useColors } from '@/lib/theme';
import type { PersonalRecord } from '@/lib/types';

import { Button, useText } from './ui';

/** Where to go to change a record: the entry the user typed in, or the workout whose set holds it. */
function editRoute(record: PersonalRecord): Href | null {
  if (record.source === 'manual' && record.manual_record_id) {
    return { pathname: '/record/manual', params: { id: record.manual_record_id } };
  }
  if (record.workout) return `/workout/${record.workout.id}`;
  return null;
}

/**
 * One record line: what it is and its value. Tapping shows where and when it was set, with a button
 * to edit the manual entry or open the workout, since those sets are what the record is computed from.
 */
export function RecordRow({ record }: { record: PersonalRecord }) {
  const [expanded, setExpanded] = useState(false);
  const styles = useStyles();
  const t = useText();
  const c = useColors();
  const route = editRoute(record);
  const isManual = record.source === 'manual';
  const label = recordLabels[record.record_type];
  const origin = isManual ? 'Entered by you' : (record.workout?.name ?? 'From a workout');
  // Manual entries are stored at midday as a placeholder, so only their date means anything.
  const when = isManual
    ? formatDate(record.achieved_at)
    : `${formatDate(record.achieved_at)} · ${formatTime(record.achieved_at)}`;

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? 'Hide where this record is from' : 'Show where this record is from'}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Text style={[t.body, styles.flex]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.value}>{formatRecordValue(record.record_type, record.value)}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
      </Pressable>

      {expanded ? (
        <View style={styles.details}>
          <View style={styles.detailLine}>
            <Ionicons name={isManual ? 'create-outline' : 'barbell-outline'} size={16} color={c.textMuted} />
            <Text style={[t.body, styles.flex]}>{origin}</Text>
          </View>
          <View style={styles.detailLine}>
            <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
            <Text style={[t.muted, styles.flex]}>{when}</Text>
          </View>
          {route ? (
            <Button
              title={isManual ? 'Edit record' : 'Open workout'}
              variant="secondary"
              onPress={() => router.push(route)}
              style={styles.action}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 54, paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.6 },
  value: { ...type.bodyStrong, fontVariant: ['tabular-nums'], color: c.text },
  details: {
    gap: spacing.sm,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceMuted,
  },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  action: { marginTop: spacing.xs, backgroundColor: c.surface },
}));
