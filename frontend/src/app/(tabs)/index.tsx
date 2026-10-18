import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { EmptyState, ErrorBanner, GroupedRow, Loading, ScreenTitle, useText } from '@/components/ui';
import { WorkoutRow } from '@/components/WorkoutRow';
import { api } from '@/lib/api';
import { offerResume } from '@/lib/dialogs';
import { useAuth } from '@/lib/auth';
import { formatTime } from '@/lib/format';
import { makeStyles, radius, spacing, type, useColors } from '@/lib/theme';
import type { Workout } from '@/lib/types';
import { errorMessage, useApi } from '@/lib/useApi';

export default function WorkoutsScreen() {
  const active = useApi(() => api.workouts({ in_progress: true }));
  const history = useApi(() => api.workouts({ completed: true }));
  const [extraPages, setExtraPages] = useState<Workout[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const styles = useStyles();
  const t = useText();
  const c = useColors();
  const { user } = useAuth();

  const refresh = async () => {
    setExtraPages([]);
    setPage(1);
    await Promise.all([active.refresh(), history.refresh()]);
  };

  const lastPage = history.data?.meta.last_page ?? 1;
  // Page 1 is refetched on every focus; drop any rows it now shares with pages loaded later.
  const firstPage = history.data?.data ?? [];
  const firstPageIds = new Set(firstPage.map((w) => w.id));
  const workouts = [...firstPage, ...extraPages.filter((w) => !firstPageIds.has(w.id))];

  const loadMore = async () => {
    if (loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    try {
      const next = await api.workouts({ completed: true, page: page + 1 });
      setExtraPages((current) => [...current, ...next.data]);
      setPage(page + 1);
      setMoreError(null);
    } catch (e) {
      setMoreError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  if (history.isLoading && !history.data) return <Loading />;

  const inProgress = active.data?.data ?? [];

  return (
    <FlatList
      data={workouts}
      keyExtractor={(w) => String(w.id)}
      style={styles.screen}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={history.isRefreshing} onRefresh={refresh} tintColor={c.textMuted} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle
            title="Workouts"
            right={
              <Pressable onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel="Profile">
                <Avatar user={user} size={40} />
              </Pressable>
            }
          />
          {history.error ? <ErrorBanner message={history.error} onRetry={refresh} /> : null}

          {inProgress.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => router.push(`/workout/${w.id}`)}
              style={({ pressed }) => [styles.resume, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Resume ${w.name}, started ${formatTime(w.started_at)}`}
            >
              <View style={styles.play}>
                <Ionicons name="play" size={20} color={c.onAccent} />
              </View>
              <View style={styles.resumeText}>
                <Text style={t.bodyStrong} numberOfLines={1}>
                  Resume {w.name}
                </Text>
                <Text style={styles.resumeMeta}>In progress · started {formatTime(w.started_at)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.accent} />
            </Pressable>
          ))}

          <View style={styles.tiles}>
            <StartTile
              icon="add"
              title="Empty workout"
              subtitle="Start from scratch"
              onPress={() => (inProgress[0] ? offerResume(inProgress[0]) : router.push('/workout/new'))}
            />
            <StartTile
              icon="list"
              title="From template"
              subtitle="Use a saved routine"
              onPress={() => (inProgress[0] ? offerResume(inProgress[0]) : router.navigate('/templates'))}
            />
          </View>

          <Text style={[styles.sectionTitle]} accessibilityRole="header">
            History
          </Text>
        </View>
      }
      ListEmptyComponent={
        history.error ? null : (
          <EmptyState title="No finished workouts yet" message="Finish a workout and it will show up here." />
        )
      }
      ListFooterComponent={
        moreError ? <ErrorBanner message={moreError} onRetry={loadMore} /> : loadingMore ? <Loading /> : null
      }
      renderItem={({ item, index }) => (
        <GroupedRow index={index} total={workouts.length}>
          <WorkoutRow workout={item} />
        </GroupedRow>
      )}
    />
  );
}

function StartTile({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const t = useText();
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={22} color={c.accent} />
      </View>
      <View style={styles.tileText}>
        <Text style={t.bodyStrong}>{title}</Text>
        <Text style={t.caption}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { backgroundColor: c.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.md, paddingBottom: spacing.md },
  pressed: { opacity: 0.75 },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.accent,
    backgroundColor: c.accentSoft,
  },
  play: {
    width: 48,
    height: 48,
    borderRadius: radius.round,
    backgroundColor: c.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeText: { flex: 1, gap: 2 },
  resumeMeta: { ...type.caption, fontSize: 14, color: c.accent },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card - 2,
    backgroundColor: c.surface,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.round,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { gap: 2 },
  sectionTitle: { ...type.title, fontSize: 22, lineHeight: 28, color: c.text, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
}));
