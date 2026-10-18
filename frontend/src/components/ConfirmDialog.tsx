import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { setConfirmPresenter, type ConfirmRequest } from '@/lib/dialogs';
import { makeStyles, radius, spacing } from '@/lib/theme';

import { Button, useText } from './ui';

/**
 * The in-app "Are you sure?" dialog behind confirm() on web: Cancel, and a red button for destructive actions.
 * Mounted once at the root. Tapping outside or pressing Escape cancels.
 */
export function ConfirmDialogHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [visible, setVisible] = useState(false);
  const styles = useStyles();
  const t = useText();

  useEffect(
    () =>
      setConfirmPresenter((next) => {
        setRequest(next);
        setVisible(true);
      }),
    [],
  );

  // The request stays set while hidden, so the text doesn't blank out during the fade.
  const cancel = () => setVisible(false);
  const accept = () => {
    setVisible(false);
    request?.onConfirm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel="Cancel" />
        <View style={styles.card} accessibilityRole="alert" aria-modal>
          <Text style={t.heading}>{request?.title}</Text>
          <Text style={t.muted}>{request?.message}</Text>
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={cancel} style={styles.action} />
            <Button
              title={request?.confirmLabel ?? 'OK'}
              variant={request?.destructive ? 'destructive' : 'primary'}
              onPress={accept}
              style={styles.action}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1, minHeight: 48, paddingHorizontal: spacing.md },
}));
