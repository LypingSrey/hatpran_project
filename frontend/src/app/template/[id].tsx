import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';

import { Button, Card, ErrorBanner, Loading, Rule, useText } from '@/components/ui';
import { api } from '@/lib/api';
import { offerResumeIfBusy } from '@/lib/dialogs';
import { formatDate } from '@/lib/format';
import { makeStyles, spacing, type } from '@/lib/theme';
import { errorMessage, useApi } from '@/lib/useApi';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') globalThis.alert?.(message);
  else Alert.alert(title, message);
}

export default function TemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = Number(id);
  const { data, error, isLoading, refresh } = useApi(() => api.template(templateId), [templateId]);
  const [starting, setStarting] = useState(false);
  const styles = useStyles();
  const t = useText();

  const template = data?.data;
  if (isLoading && !template) return <Loading />;
  if (!template) {
    return (
      <View style={styles.container}>
        <ErrorBanner message={error ?? 'Template not found.'} onRetry={refresh} />
      </View>
    );
  }

  const start = async () => {
    setStarting(true);
    try {
      const { data: workout } = await api.startTemplate(template.id);
      router.replace(`/workout/${workout.id}`);
    } catch (e) {
      if (!(await offerResumeIfBusy(e))) notify('Could not start workout', errorMessage(e));
      setStarting(false);
    }
  };

  const remove = () => {
    const doDelete = async () => {
      try {
        await api.deleteTemplate(template.id);
        router.back();
      } catch (e) {
        notify('Could not delete', errorMessage(e));
      }
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Delete “${template.name}”? Past workouts are kept.`)) void doDelete();
      return;
    }
    Alert.alert('Delete template?', 'Past workouts started from it are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: template.name }} />
      {template.notes ? <Text style={t.body}>{template.notes}</Text> : null}
      <Text style={t.muted}>
        {template.times_used > 0
          ? `Used ${template.times_used}× · last ${formatDate(template.last_used_at)}`
          : 'Not used yet'}
      </Text>

      <Card flush style={styles.list}>
        {(template.exercises ?? []).map((te, index) => (
          <Fragment key={te.id}>
            {index > 0 ? <Rule inset={56} /> : null}
            <View style={styles.row}>
              <Text style={styles.index}>{index + 1}</Text>
              <View style={styles.rowText}>
                <Text style={t.body}>{te.exercise?.name}</Text>
                <Text style={t.caption}>
                  {te.target_sets ?? 3} sets{te.target_reps ? ` × ${te.target_reps} reps` : ''}
                </Text>
              </View>
            </View>
          </Fragment>
        ))}
      </Card>

      <View style={styles.actions}>
        <Button title="Start workout" icon="play" onPress={start} loading={starting} />
        <Button title="Delete template" variant="danger" onPress={remove} />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { backgroundColor: c.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  list: { marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: 64, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  index: { ...type.numeral, fontSize: 17, width: 24, textAlign: 'center', color: c.textMuted },
  rowText: { flex: 1, gap: 2 },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
}));
