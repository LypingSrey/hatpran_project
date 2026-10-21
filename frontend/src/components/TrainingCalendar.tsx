import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { addMonths, elapsedDays, groupByDay, monthGrid, monthOf, sameMonth, type Month } from '@/lib/calendar';
import { toDateInput } from '@/lib/format';
import { makeStyles, radius, spacing, type, useColors } from '@/lib/theme';
import type { Workout, WorkoutDay } from '@/lib/types';

import { Card, ErrorBanner, Rule, useText } from './ui';
import { WorkoutRow } from './WorkoutRow';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A month of training at a glance: trained days filled, rest days plain, today ringed. Tapping a day lists the
 * workouts done that day. The parent loads the month's workouts, so pull-to-refresh can include them.
 */
export function MonthCalendar({
  month,
  onMonthChange,
  workouts,
  error,
  onRetry,
}: {
  month: Month;
  onMonthChange: (month: Month) => void;
  /** Finished workouts started in `month`; undefined while that month loads. */
  workouts: Workout[] | undefined;
  error: string | null;
  onRetry: () => void;
}) {
  const styles = useStyles();
  const t = useText();
  const c = useColors();
  const today = new Date();
  const todayKey = toDateInput(today);
  const isCurrentMonth = sameMonth(month, monthOf(today));
  // Today starts selected in the current month; another month (e.g. opened from the year view) starts with none.
  const [selected, setSelected] = useState<string | null>(isCurrentMonth ? todayKey : null);
  const days = groupByDay(workouts ?? []);
  const trainedCount = days.size;
  // Rest days only count once a day has passed or is today; the rest of the month hasn't happened yet.
  const elapsed = elapsedDays(month, today);
  const title = new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const changeMonth = (delta: number) => {
    const next = addMonths(month, delta);
    onMonthChange(next);
    // Keep today selected when coming back to this month; otherwise start with nothing picked.
    setSelected(sameMonth(next, monthOf(today)) ? todayKey : null);
  };

  const selectedWorkouts = selected ? (days.get(selected) ?? []) : [];
  const selectedDate = selected ? new Date(`${selected}T12:00:00`) : null;

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <MonthButton icon="chevron-back" label="Previous month" onPress={() => changeMonth(-1)} />
          <View style={styles.headerTitle}>
            <Text style={t.bodyStrong} accessibilityRole="header">
              {title}
            </Text>
            {!workouts && !error ? <ActivityIndicator size="small" color={c.textMuted} /> : null}
          </View>
          <MonthButton
            icon="chevron-forward"
            label="Next month"
            onPress={() => changeMonth(1)}
            disabled={isCurrentMonth}
          />
        </View>

        <View style={styles.week}>
          {WEEKDAYS.map((label, index) => (
            <Text key={index} style={[t.column, styles.weekday]} importantForAccessibility="no">
              {label}
            </Text>
          ))}
        </View>

        {monthGrid(month).map((week, row) => (
          <View key={row} style={styles.week}>
            {week.map((date, col) => {
              if (!date) return <View key={col} style={styles.cell} />;
              const key = toDateInput(date);
              const count = days.get(key)?.length ?? 0;
              const isFuture = key > todayKey;
              const status = isFuture ? 'upcoming' : count > 0 ? `${count} workout${count === 1 ? '' : 's'}` : 'rest day';
              return (
                <Pressable
                  key={col}
                  style={styles.cell}
                  onPress={() => setSelected(key)}
                  disabled={isFuture}
                  accessibilityRole="button"
                  accessibilityState={{ selected: key === selected, disabled: isFuture }}
                  accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${status}`}
                >
                  <View
                    style={[
                      styles.day,
                      count > 0 && styles.dayTrained,
                      key === todayKey && styles.dayToday,
                      key === selected && styles.daySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        count > 0 && styles.dayTextTrained,
                        isFuture && styles.dayTextFuture,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <Text style={[t.caption, styles.summary]}>
          {workouts
            ? `${trainedCount} of ${elapsed} day${elapsed === 1 ? '' : 's'} trained · ${elapsed - trainedCount} rest`
            : ' '}
        </Text>
      </Card>

      {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}

      {selectedDate ? (
        <Card flush>
          <Text style={[t.label, styles.dayHeading]}>
            {selectedDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Rule inset={0} />
          {selectedWorkouts.length === 0 ? (
            <Text style={[t.muted, styles.restLine]}>{workouts ? 'Rest day' : ' '}</Text>
          ) : (
            selectedWorkouts.map((w, index) => (
              <Fragment key={w.id}>
                {index > 0 ? <Rule inset={78} /> : null}
                <WorkoutRow workout={w} />
              </Fragment>
            ))
          )}
        </Card>
      ) : null}
    </View>
  );
}

/**
 * A whole year as twelve small months: trained days as filled dots, past rest days as faint ones. Days are too
 * small to tap one by one, so tapping a month opens it in the month view.
 */
export function YearCalendar({
  year,
  onYearChange,
  onPickMonth,
  workouts,
  error,
  onRetry,
}: {
  year: number;
  onYearChange: (year: number) => void;
  onPickMonth: (month: Month) => void;
  /** Finished workouts started in `year`; undefined while that year loads. */
  workouts: WorkoutDay[] | undefined;
  error: string | null;
  onRetry: () => void;
}) {
  const styles = useStyles();
  const t = useText();
  const c = useColors();
  const today = new Date();
  const todayKey = toDateInput(today);
  const days = groupByDay(workouts ?? []);
  const months: Month[] = Array.from({ length: 12 }, (_, month) => ({ year, month }));
  const elapsed = months.reduce((sum, m) => sum + elapsedDays(m, today), 0);

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <MonthButton icon="chevron-back" label="Previous year" onPress={() => onYearChange(year - 1)} />
          <View style={styles.headerTitle}>
            <Text style={t.bodyStrong} accessibilityRole="header">
              {year}
            </Text>
            {!workouts && !error ? <ActivityIndicator size="small" color={c.textMuted} /> : null}
          </View>
          <MonthButton
            icon="chevron-forward"
            label="Next year"
            onPress={() => onYearChange(year + 1)}
            disabled={year >= today.getFullYear()}
          />
        </View>

        <View style={styles.yearGrid}>
          {months.map((m) => {
            const first = new Date(m.year, m.month, 1);
            const isFuture = elapsedDays(m, today) === 0;
            // Always six rows, so months side by side line up whether they span four, five or six weeks.
            const weeks = monthGrid(m);
            while (weeks.length < 6) weeks.push(Array.from({ length: 7 }, () => null));
            const trained = weeks.flat().filter((date) => date && days.has(toDateInput(date))).length;
            const name = first.toLocaleDateString(undefined, { month: 'short' });
            return (
              <Pressable
                key={m.month}
                onPress={() => onPickMonth(m)}
                disabled={isFuture}
                accessibilityRole="button"
                accessibilityState={{ disabled: isFuture }}
                accessibilityLabel={`${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}, ${
                  isFuture ? 'upcoming' : `${trained} day${trained === 1 ? '' : 's'} trained`
                }`}
                style={({ pressed }) => [styles.miniMonth, pressed && styles.miniMonthPressed]}
              >
                <Text
                  style={[
                    styles.miniName,
                    sameMonth(m, monthOf(today)) && styles.miniNameCurrent,
                    isFuture && styles.dayTextFuture,
                  ]}
                >
                  {name}
                </Text>
                {weeks.map((week, row) => (
                  <View key={row} style={styles.week}>
                    {week.map((date, col) => {
                      const key = date ? toDateInput(date) : null;
                      const dot =
                        !key || key > todayKey ? null : days.has(key) ? styles.dotTrained : styles.dotRest;
                      return (
                        <View key={col} style={styles.miniCell}>
                          {dot ? <View style={[styles.dot, dot]} /> : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
                <Text style={[t.caption, styles.miniCount]}>
                  {isFuture || !workouts ? ' ' : `${trained} day${trained === 1 ? '' : 's'}`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[t.caption, styles.summary]}>
          {workouts ? `${days.size} of ${elapsed} day${elapsed === 1 ? '' : 's'} trained` : ' '}
        </Text>
      </Card>

      {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}
    </View>
  );
}

function MonthButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.monthButton, pressed && styles.monthButtonPressed]}
    >
      <Ionicons name={icon} size={20} color={disabled ? c.textFaint : c.accent} />
    </Pressable>
  );
}

const DAY_SIZE = 36;

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.md },
  card: { gap: spacing.xs, paddingTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonPressed: { backgroundColor: c.surfaceMuted },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingBottom: spacing.xs },
  cell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayTrained: { backgroundColor: c.accentFill },
  dayToday: { borderColor: c.accent },
  daySelected: { borderColor: c.text },
  dayText: { ...type.label, fontVariant: ['tabular-nums'], color: c.text },
  dayTextTrained: { fontFamily: type.bodyStrong.fontFamily, color: c.onAccent },
  dayTextFuture: { color: c.textFaint },
  summary: { textAlign: 'center', marginTop: spacing.xs },
  dayHeading: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  restLine: { padding: spacing.lg },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  miniMonth: { width: '33.333%', paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md },
  miniMonthPressed: { backgroundColor: c.surfaceMuted },
  miniName: { ...type.label, fontFamily: type.bodyStrong.fontFamily, color: c.text, marginBottom: spacing.xs },
  miniNameCurrent: { color: c.accent },
  miniCell: { flex: 1, height: 13, alignItems: 'center', justifyContent: 'center' },
  dot: { borderRadius: radius.round },
  dotTrained: { width: 8, height: 8, backgroundColor: c.accentFill },
  dotRest: { width: 4, height: 4, backgroundColor: c.ruleStrong },
  miniCount: { marginTop: spacing.xs },
}));
