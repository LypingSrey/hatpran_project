import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';

import { Button, Card, EmptyState, ErrorBanner, Loading, ScreenTitle, useText } from '@/components/ui';
import { api } from '@/lib/api';
import { offerResumeIfBusy } from '@/lib/dialogs';
import { formatDate } from '@/lib/format';
import { makeStyles, radius, spacing, useColors } from '@/lib/theme';
import type { WorkoutTemplate } from '@/lib/types';
import { errorMessage, useApi } from '@/lib/useApi';

export default function TemplatesScreen() {
  const { data, error, isLoading, isRefreshing, refresh } = useApi(() => api.templates());
  const [startingId, setStartingId] = useState<number | null>(null);
  const styles = useStyles();
  const t = useText();
  const c = useColors();

  const start = async (template: WorkoutTemplate) => {
    setStartingId(template.id);
    try {
      const { data: workout } = await api.startTemplate(template.id);
      router.push(`/workout/${workout.id}`);
    } catch (e) {
      if (await offerResumeIfBusy(e)) return;
      const message = errorMessage(e);
      if (Platform.OS === 'web') globalThis.alert?.(message);
      else Alert.alert('Could not start workout', message);
    } finally {
      setStartingId(null);
    }
  };

  if (isLoading && !data) return <Loading />;

  return (
    <FlatList
      data={data?.data ?? []}
      keyExtractor={(template) => String(template.id)}
      style={styles.screen}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={c.textMuted} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle
            title="Templates"
            right={
              <Pressable
                onPress={() => router.push('/template/new')}
                accessibilityRole="button"
                accessibilityLabel="New template"
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
            title="No templates yet"
            message="Save a routine like “Push Day” once, then start it with one tap."
            action={<Button title="New template" onPress={() => router.push('/template/new')} style={styles.emptyAction} />}
          />
        )
      }
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <Pressable
            onPress={() => router.push(`/template/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name}`}
            style={({ pressed }) => [styles.cardText, pressed && styles.pressed]}
          >
            <Text style={t.heading}>{item.name}</Text>
            <Text style={t.muted} numberOfLines={2}>
              {(item.exercises ?? []).map((e) => e.exercise?.name).join(', ')}
            </Text>
            <Text style={t.caption}>
              {item.times_used > 0
                ? `Used ${item.times_used}× · last ${formatDate(item.last_used_at)}`
                : 'Not used yet'}
            </Text>
          </Pressable>
          <Button
            title="Start workout"
            icon="play"
            variant="secondary"
            onPress={() => start(item)}
            loading={startingId === item.id}
          />
        </Card>
      )}
    />
  );
}

const useStyles = makeStyles((c) => ({
  screen: { backgroundColor: c.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  header: { gap: spacing.md },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: c.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  card: { gap: spacing.lg },
  cardText: { gap: spacing.xs },
  emptyAction: { marginTop: spacing.md, alignSelf: 'stretch' },
}));
