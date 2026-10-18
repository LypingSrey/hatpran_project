import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Field } from '@/components/ui';
import { formatClock } from '@/lib/format';
import { finishHaptic } from '@/lib/motion';
import { getItem, setItem } from '@/lib/storage';
import { makeStyles, radius, spacing, type, useColors } from '@/lib/theme';

const STORAGE_KEY = 'hatpran.restSeconds';
const DEFAULT_SECONDS = 120;
const PRESETS = [60, 120, 180];
const MIN_SECONDS = 5;
const MAX_SECONDS = 30 * 60;
const CHANNEL = 'rest-timer';
const TITLE = 'Rest is over';
const isNative = Platform.OS !== 'web';

// Kept outside the hook so leaving the workout screen and coming back resumes the countdown.
// ponytail: one shared rest, fine while only one workout can be in progress; key by workout id if that changes.
const reminder: { current: Promise<string | null> | null } = { current: null };
const kept = { endsAt: null as number | null, nextUp: 'Time for your next set.' };

// While the workout screen is open it shows the reminder itself; the banner is for when the lifter is elsewhere.
let screenOpen = false;
if (isNative) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: !screenOpen,
      shouldShowList: true,
      shouldPlaySound: !screenOpen,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask the phone to buzz when the rest ends, so the reminder arrives with the app in the background or the phone
 * locked. Returns the notification's id, or null when notifications are off; the in-app reminder still works.
 */
async function scheduleReminder(seconds: number, body: string): Promise<string | null> {
  if (!isNative) return null;
  try {
    // Android 13 won't show the permission prompt until a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
    if (!granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title: TITLE, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL },
    });
  } catch {
    return null;
  }
}

// The web build can't schedule ahead, so it shows a browser notification when the countdown ends in a hidden tab.
function askWebPermission() {
  if (isNative || typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  void Notification.requestPermission().catch(() => undefined);
}

function webNotify(body: string) {
  if (isNative || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  try {
    new Notification(TITLE, { body });
  } catch {
    // Some browsers only allow notifications from a service worker; the in-app reminder still shows.
  }
}

export type RestTimer = ReturnType<typeof useRestTimer>;

/**
 * The rest between sets. `start` runs a countdown of the chosen length (2 minutes unless changed; the choice is
 * remembered) and schedules a notification for its end; `stop` cancels both.
 */
export function useRestTimer() {
  const [seconds, setSeconds] = useState(DEFAULT_SECONDS);
  // A rest that ran out while away isn't brought back; its notification already went off.
  const [endsAt, setEndsAt] = useState(() => (kept.endsAt !== null && kept.endsAt > Date.now() ? kept.endsAt : null));
  const [now, setNow] = useState(() => Date.now());
  const [over, setOver] = useState(false);
  const [nextUp, setNextUp] = useState(kept.nextUp);

  useEffect(() => {
    kept.endsAt = endsAt;
    kept.nextUp = nextUp;
  }, [endsAt, nextUp]);

  useEffect(() => {
    void getItem(STORAGE_KEY).then((saved) => {
      const value = Number(saved);
      if (value >= MIN_SECONDS && value <= MAX_SECONDS) setSeconds(value);
    });
  }, []);

  useEffect(() => {
    screenOpen = true;
    return () => {
      screenOpen = false;
    };
  }, []);

  const cancelReminder = () => {
    const pending = reminder.current;
    reminder.current = null;
    void pending?.then((id) => {
      if (id) void Notifications.cancelScheduledNotificationAsync(id);
    });
  };

  const run = (length: number, body: string) => {
    cancelReminder();
    setNow(Date.now());
    setEndsAt(Date.now() + length * 1000);
    setOver(false);
    reminder.current = scheduleReminder(length, body);
    askWebPermission();
  };

  /** Start (or restart) the rest. `next` names what comes after it, e.g. "Bench Press, set 3". */
  const start = (next?: string) => {
    const body = next ? `Next up: ${next}` : 'Time for your next set.';
    setNextUp(body);
    run(seconds, body);
  };

  const stop = () => {
    cancelReminder();
    setEndsAt(null);
    setOver(false);
  };

  /** Change the rest length; a countdown already running starts again at the new length. */
  const choose = (length: number) => {
    setSeconds(length);
    void setItem(STORAGE_KEY, String(length));
    if (endsAt !== null) run(length, nextUp);
  };

  // The end is a timestamp, so time spent in the background or on a locked phone still counts.
  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) {
        reminder.current = null;
        setEndsAt(null);
        setOver(true);
        finishHaptic();
        webNotify(nextUp);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [endsAt, nextUp]);

  const remaining = endsAt === null ? seconds : Math.max(0, Math.ceil((endsAt - now) / 1000));
  return { seconds, remaining, running: endsAt !== null, over, nextUp, start, stop, choose };
}

function lengthLabel(seconds: number): string {
  return seconds % 60 === 0 ? `${seconds / 60} min` : formatClock(seconds);
}

/**
 * The rest timer in the workout's bottom bar: the chosen length while idle, a countdown while resting, and a
 * green reminder once the rest is over. Tapping the time opens the length options.
 */
export function RestTimerBar({ timer }: { timer: RestTimer }) {
  const styles = useStyles();
  const c = useColors();
  const [open, setOpen] = useState(false);

  if (timer.over) {
    return (
      <View style={[styles.bar, styles.barOver]} accessibilityLiveRegion="assertive">
        <Ionicons name="alarm" size={22} color={c.successText} />
        <View style={styles.text}>
          <Text style={[styles.title, styles.titleOver]}>{TITLE}</Text>
          <Text style={styles.caption} numberOfLines={1}>
            {timer.nextUp}
          </Text>
        </View>
        <Pressable onPress={timer.stop} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8} style={styles.iconButton}>
          <Ionicons name="close" size={22} color={c.textMuted} />
        </Pressable>
      </View>
    );
  }

  const progress = timer.running ? 1 - timer.remaining / timer.seconds : 0;
  return (
    <>
      <View style={styles.bar}>
        {timer.running ? <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} /> : null}
        <Pressable
          onPress={() => setOpen(true)}
          style={styles.main}
          accessibilityRole="button"
          accessibilityLabel={
            timer.running
              ? `Resting, ${formatClock(timer.remaining)} left. Change rest length.`
              : `Rest timer, ${lengthLabel(timer.seconds)}. Starts when you tick a set. Change rest length.`
          }
        >
          <Ionicons name="timer-outline" size={22} color={timer.running ? c.accent : c.textMuted} />
          <View style={styles.text}>
            <Text style={styles.title}>{timer.running ? 'Resting' : 'Rest timer'}</Text>
            {timer.running ? null : <Text style={styles.caption}>Starts when you tick a set</Text>}
          </View>
          <Text style={[styles.clock, timer.running && styles.clockRunning]}>{formatClock(timer.remaining)}</Text>
          {timer.running ? null : <Ionicons name="chevron-down" size={18} color={c.textMuted} />}
        </Pressable>
        {timer.running ? (
          <Pressable onPress={timer.stop} accessibilityRole="button" accessibilityLabel="Skip rest" hitSlop={8} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <RestOptions
        visible={open}
        seconds={timer.seconds}
        onChoose={(length) => {
          timer.choose(length);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function RestOptions({
  visible,
  seconds,
  onChoose,
  onClose,
}: {
  visible: boolean;
  seconds: number;
  onChoose: (seconds: number) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isPreset = PRESETS.includes(seconds);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setCustom(false);
    setError(undefined);
    onClose();
  };

  const saveCustom = () => {
    const value = Number.parseInt(draft.trim(), 10);
    if (!Number.isFinite(value) || value < MIN_SECONDS || value > MAX_SECONDS) {
      setError(`Enter between ${MIN_SECONDS} and ${MAX_SECONDS} seconds.`);
      return;
    }
    setCustom(false);
    setError(undefined);
    onChoose(value);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close rest options" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            Rest between sets
          </Text>
          <View style={styles.chips}>
            {PRESETS.map((preset) => (
              <Chip
                key={preset}
                label={lengthLabel(preset)}
                selected={!custom && seconds === preset}
                onPress={() => {
                  setCustom(false);
                  onChoose(preset);
                }}
              />
            ))}
            <Chip
              label={isPreset ? 'Custom' : `Custom · ${lengthLabel(seconds)}`}
              selected={custom || !isPreset}
              onPress={() => {
                setDraft(isPreset ? '' : String(seconds));
                setCustom(true);
              }}
            />
          </View>
          {custom ? (
            <View style={styles.custom}>
              <Field
                label="Rest in seconds"
                value={draft}
                onChangeText={setDraft}
                placeholder="90"
                keyboardType="number-pad"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveCustom}
                error={error}
              />
              <Button title="Set rest" onPress={saveCustom} />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceMuted,
    overflow: 'hidden',
  },
  barOver: { backgroundColor: c.successSoft, gap: spacing.md, paddingLeft: spacing.lg },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: c.accentSoft },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg },
  text: { flex: 1, gap: 1 },
  title: { ...type.bodyStrong, color: c.text },
  titleOver: { color: c.successText },
  caption: { ...type.caption, color: c.textMuted },
  clock: { ...type.stat, fontVariant: ['tabular-nums'], color: c.text },
  clockRunning: { color: c.accent },
  skip: { minHeight: 56, justifyContent: 'center', paddingRight: spacing.lg, paddingLeft: spacing.xs },
  skipText: { ...type.bodyStrong, color: c.accent },
  iconButton: { width: 48, height: 56, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sheet: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    backgroundColor: c.menu,
  },
  sheetTitle: { ...type.heading, color: c.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  custom: { gap: spacing.md },
}));
