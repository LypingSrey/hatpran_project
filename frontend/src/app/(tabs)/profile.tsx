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
import { formatDuration, formatNumber } from '@/lib/format';
import { groupByExercise } from '@/lib/recordGroups';
import { makeStyles, spacing, type, useColors } from '@/lib/theme';
import { useApi } from '@/lib/useApi';

const RECENT_COUNT = 5;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const stats = useApi(() => api.stats());
  const recent = useApi(() => api.workouts({ completed: true, per_page: RECENT_COUNT }));
  // Every record, so each exercise's count is complete; the card shows the most recently improved few.
  const records = useApi(() => api.allPersonalRecords());
  const styles = useStyles();
  const t = useText();
  const c = useColors();

  const refresh = () => Promise.all([stats.refresh(), recent.refresh(), records.refresh()]);
  const error = stats.error ?? recent.error ?? records.error;
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
          refreshing={stats.isRefreshing || recent.isRefreshing || records.isRefreshing}
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
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  logout: { marginTop: spacing.xl },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md },
  server: { textAlign: 'center' },
}));
