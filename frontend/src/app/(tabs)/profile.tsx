import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AppearanceMenu } from '@/components/AppearanceMenu';
import { Avatar } from '@/components/Avatar';
import { ExerciseRecordsRow } from '@/components/ExerciseRecordsRow';
import { Button, Card, ErrorBanner, Rule, ScreenTitle, Section, useText } from '@/components/ui';
import { WorkoutRow } from '@/components/WorkoutRow';
import { API_URL, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDuration, formatNumber, toDateInput } from '@/lib/format';
import { fetchAllPages } from '@/lib/paginate';
import { groupByExercise } from '@/lib/recordGroups';
import { makeStyles, radius, spacing, type, useColors } from '@/lib/theme';
import type { Workout } from '@/lib/types';
import { useApi } from '@/lib/useApi';

const RECENT_COUNT = 5;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const stats = useApi(() => api.stats());
  const recent = useApi(() => api.workouts({ completed: true, per_page: RECENT_COUNT }));
  // Every record, so each exercise's count is complete; the card shows the most recently improved few.
  const records = useApi(() => api.allPersonalRecords());
  // Local midnight on the 1st of the shown month; the API gets the month's bounds as UTC instants. It filters on
  // the start time, so start a day early to catch a workout that ran past midnight into the 1st.
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const monthWorkouts = useApi(
    () =>
      fetchAllPages((page) =>
        api.workouts({
          completed: true,
          from: new Date(month.getFullYear(), month.getMonth(), 0).toISOString(),
          to: new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
          page,
          per_page: 100,
        }),
      ),
    [month.getTime()],
  );
  const styles = useStyles();
  const t = useText();
  const c = useColors();

  const refresh = () => Promise.all([stats.refresh(), recent.refresh(), records.refresh(), monthWorkouts.refresh()]);
  const error = stats.error ?? recent.error ?? records.error ?? monthWorkouts.error;
  const totals = stats.data?.data;
  const workouts = recent.data?.data ?? [];
  const recordExercises = groupByExercise(records.data ?? []).slice(0, RECENT_COUNT);
  const memberSince = user ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';

  const totalRows: [string, string][] = [
    ['Workouts', totals ? formatNumber(totals.workouts_count, 0) : '—'],
    ['Time trained', totals ? formatDuration(totals.total_duration_seconds) : '—'],
    ['Sets', totals ? formatNumber(totals.total_sets, 0) : '—'],
    ['Volume', totals ? formatVolume(totals.total_volume) : '—'],
    ['Records', totals ? formatNumber(totals.records_count, 0) : '—'],
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={stats.isRefreshing || recent.isRefreshing || records.isRefreshing || monthWorkouts.isRefreshing}
          onRefresh={refresh}
          tintColor={c.textMuted}
        />
      }
    >
      <ScreenTitle title="Profile" right={<AppearanceMenu />} />

      <Card style={styles.identityCard}>
        <View style={styles.identity}>
          <Pressable
            onPress={() => router.push('/profile/edit')}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
          >
            <Avatar user={user} size={64} />
          </Pressable>
          <View style={styles.identityText}>
            <Text style={t.heading} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={t.muted} numberOfLines={1}>
              {user?.email}
            </Text>
            <Text style={t.caption}>Member since {memberSince}</Text>
          </View>
        </View>
        <Button title="Edit profile" variant="secondary" onPress={() => router.push('/profile/edit')} />
      </Card>

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      <Section title="Lifetime totals" style={styles.section}>
        <Card flush>
          {totalRows.map(([label, value], index) => (
            <Fragment key={label}>
              {index > 0 ? <Rule /> : null}
              <View style={styles.totalRow}>
                <Text style={t.body}>{label}</Text>
                <Text style={styles.totalValue}>{value}</Text>
              </View>
            </Fragment>
          ))}
        </Card>
      </Section>

      <Section title="Training calendar" style={styles.section}>
        <TrainingCalendar
          key={month.getTime()}
          month={month}
          onMonthChange={setMonth}
          workouts={monthWorkouts.data ?? []}
        />
      </Section>

      <Section
        title="Recent workouts"
        action={workouts.length > 0 ? <SeeAll onPress={() => router.navigate('/')} /> : null}
        style={styles.section}
      >
        <Card flush>
          {workouts.length === 0 && !recent.isLoading ? (
            <Text style={[t.muted, styles.emptyLine]}>Finished workouts will show up here. Tap one to edit it.</Text>
          ) : null}
          {workouts.map((w, index) => (
            <Fragment key={w.id}>
              {index > 0 ? <Rule inset={78} /> : null}
              <WorkoutRow workout={w} />
            </Fragment>
          ))}
        </Card>
      </Section>

      <Section
        title="Personal records"
        action={recordExercises.length > 0 ? <SeeAll onPress={() => router.navigate('/records')} /> : null}
        style={styles.section}
      >
        <Card flush>
          {recordExercises.length === 0 && !records.isLoading ? (
            <Text style={[t.muted, styles.emptyLine]}>
              No records yet. Finish a workout, or add a best you set before using HatPran.
            </Text>
          ) : null}
          {recordExercises.map((group, index) => (
            <Fragment key={group.exerciseId}>
              {index > 0 ? <Rule /> : null}
              <ExerciseRecordsRow group={group} />
            </Fragment>
          ))}
          <Rule inset={0} />
          <Button title="Add a past record" icon="add" variant="ghost" onPress={() => router.push('/record/manual')} />
        </Card>
      </Section>

      <Button
        title="Log out"
        variant="secondary"
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          await signOut();
        }}
        style={styles.logout}
      />

      <View style={styles.legal}>
        <Link href="/legal/privacy" style={t.link}>
          Privacy Policy
        </Link>
        <Link href="/legal/terms" style={t.link}>
          Terms of Service
        </Link>
      </View>

      <Text style={[t.caption, styles.server]}>Server: {API_URL}</Text>
    </ScrollView>
  );
}

/** Kilograms, switching to tonnes once the number gets long. */
function formatVolume(kg: number): string {
  return kg >= 10000 ? `${formatNumber(kg / 1000)} t` : `${formatNumber(kg, 0)} kg`;
}

/** A month of days, Monday first. Trained days are filled; tapping one lists its workouts underneath. */
function TrainingCalendar({
  month,
  onMonthChange,
  workouts,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  workouts: Workout[];
}) {
  const styles = useStyles();
  const t = useText();
  const c = useColors();
  const [selected, setSelected] = useState<string | null>(null);

  // A workout belongs to the local day it finished on, matching the date WorkoutRow shows for it.
  const monthKey = toDateInput(month).slice(0, 7);
  const byDay = new Map<string, Workout[]>();
  for (const w of workouts) {
    const day = toDateInput(new Date(w.completed_at ?? w.started_at));
    if (day.startsWith(monthKey)) byDay.set(day, [...(byDay.get(day) ?? []), w]);
  }
  const today = toDateInput(new Date());
  const isCurrentMonth = monthKey === today.slice(0, 7);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingBlanks = (month.getDay() + 6) % 7;
  const cells: (Date | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const shift = (by: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + by, 1));
  const selectedWorkouts = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <Card flush>
      <View style={styles.calendar}>
        <View style={styles.calendarHead}>
          <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={c.accent} />
          </Pressable>
          <Text style={t.bodyStrong}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Pressable
            onPress={() => shift(1)}
            disabled={isCurrentMonth}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: isCurrentMonth }}
            hitSlop={12}
          >
            <Ionicons name="chevron-forward" size={22} color={isCurrentMonth ? c.textFaint : c.accent} />
          </Pressable>
        </View>
        <View style={styles.week}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={[t.caption, styles.weekday]} importantForAccessibility="no">
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((date, i) => {
              if (!date) return <View key={i} style={styles.dayCell} />;
              const day = toDateInput(date);
              const count = byDay.get(day)?.length ?? 0;
              const isFuture = day > today;
              const label = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
              return (
                <Pressable
                  key={i}
                  onPress={() => setSelected(day === selected ? null : day)}
                  disabled={count === 0}
                  accessibilityRole="button"
                  accessibilityLabel={
                    count > 0
                      ? `${label}, trained, ${count} workout${count === 1 ? '' : 's'}`
                      : `${label}${isFuture ? '' : ', rest day'}`
                  }
                  accessibilityState={{ selected: day === selected, disabled: count === 0 }}
                  style={styles.dayCell}
                >
                  <View
                    style={[
                      styles.day,
                      count > 0 && styles.dayTrained,
                      day === today && styles.dayToday,
                      day === selected && styles.daySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        count > 0 && styles.dayNumberTrained,
                        isFuture && styles.dayNumberFuture,
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
        <Text style={[t.muted, styles.calendarCount]}>
          {byDay.size} day{byDay.size === 1 ? '' : 's'} trained
        </Text>
      </View>
      {selectedWorkouts.map((w) => (
        <Fragment key={w.id}>
          <Rule inset={0} />
          <WorkoutRow workout={w} />
        </Fragment>
      ))}
    </Card>
  );
}

function SeeAll({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const t = useText();
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={12} style={styles.seeAll}>
      <Text style={t.link}>See all</Text>
      <Ionicons name="chevron-forward" size={16} color={c.accent} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { backgroundColor: c.background },
  page: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md },
  identityCard: { gap: spacing.lg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identityText: { flex: 1, gap: 2 },
  section: { marginTop: spacing.lg },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  totalValue: { ...type.bodyStrong, fontVariant: ['tabular-nums'], color: c.text },
  emptyLine: { padding: spacing.lg },
  calendar: { padding: spacing.lg, gap: spacing.xs },
  calendarHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  day: {
    width: 40,
    height: 40,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayTrained: { backgroundColor: c.accentFill },
  dayToday: { borderColor: c.accent },
  daySelected: { borderColor: c.text },
  dayNumber: { ...type.label, fontVariant: ['tabular-nums'], color: c.text },
  dayNumberTrained: { color: c.onAccent },
  dayNumberFuture: { color: c.textFaint },
  calendarCount: { textAlign: 'center', marginTop: spacing.sm },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  logout: { marginTop: spacing.xl },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md },
  server: { textAlign: 'center' },
}));
