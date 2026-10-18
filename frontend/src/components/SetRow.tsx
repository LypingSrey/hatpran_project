import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, TextInput } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated from 'react-native-reanimated';

import type { SetInput } from '@/lib/api';
import { setFieldsFor, type SetField } from '@/lib/format';
import { easeOut, enter, exit, reflow, removeHaptic, tickHaptic, useReduceMotion } from '@/lib/motion';
import { makeStyles, radius, spacing, type, useColors } from '@/lib/theme';
import type { ExerciseSet, ExerciseType, SetType } from '@/lib/types';

const setTypeOrder: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
const setTypeLetter: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };

// Color changes ease instead of snapping: the row's green wash follows the tick, the blue "up next" ring
// fades off one set and onto the next, and the field outline follows focus from input to input.
const rowTransition = { transitionProperty: 'backgroundColor', transitionDuration: 200, transitionTimingFunction: easeOut } as const;
const markerTransition = {
  transitionProperty: ['borderColor', 'backgroundColor'],
  transitionDuration: 220,
  transitionTimingFunction: easeOut,
} as const;
const textTransition = { transitionProperty: 'color', transitionDuration: 220, transitionTimingFunction: easeOut } as const;

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);
const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);

type Drafts = Record<SetField, string>;

function toDrafts(set: ExerciseSet): Drafts {
  const str = (v: number | null) => (v == null ? '' : String(v));
  return {
    weight_kg: str(set.weight_kg),
    reps: str(set.reps),
    distance_meters: str(set.distance_meters),
    duration_seconds: str(set.duration_seconds),
  };
}

function parse(field: SetField, raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = field === 'weight_kg' ? Number.parseFloat(trimmed) : Number.parseInt(trimmed, 10);
  return Number.isFinite(value) ? value : null;
}

/**
 * One line of the log: set number in the left margin, the numbers written on the line, a tick in the right
 * margin. `isCurrent` circles the set number in ballpoint blue. Saves on blur and when ticked.
 * Swiping left reveals a Delete button; long-pressing the set number asks first.
 */
export function SetRow({
  set,
  exerciseType,
  isCurrent = false,
  hints = {},
  onSave,
  onDelete,
  onRemove,
}: {
  set: ExerciseSet;
  exerciseType: ExerciseType;
  isCurrent?: boolean;
  /** Last time's (or else the previous set's) values, shown in empty fields and saved as-is when an empty set is ticked. */
  hints?: Partial<Record<SetField, number | null>>;
  onSave: (changes: SetInput) => Promise<void>;
  /** Long press: delete after confirming. */
  onDelete: () => void;
  /** The Delete button a swipe reveals: delete at once, tapping it being the decision. */
  onRemove: () => void;
}) {
  const styles = useStyles();
  const c = useColors();
  const reduceMotion = useReduceMotion();
  const fields = setFieldsFor(exerciseType);
  const [drafts, setDrafts] = useState<Drafts>(() => toDrafts(set));
  const [syncedSet, setSyncedSet] = useState(set);
  const [focusedField, setFocusedField] = useState<SetField | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [tickScale] = useState(() => new Animated.Value(1));
  const [tickFill] = useState(() => new Animated.Value(set.is_completed ? 1 : 0));
  const wasCompleted = useRef(set.is_completed);
  // Take server values when the set changes underneath us (e.g. after a save),
  // but never overwrite the field the user is typing into.
  if (syncedSet !== set) {
    setSyncedSet(set);
    const server = toDrafts(set);
    setDrafts((current) => (focusedField ? { ...server, [focusedField]: current[focusedField] } : server));
  }

  // The signature moment: the tick fills green and settles into place as the set is marked done.
  // The fill is a color change, so it runs even with Reduce Motion; the settle does not.
  useEffect(() => {
    if (set.is_completed === wasCompleted.current) return;
    Animated.timing(tickFill, {
      toValue: set.is_completed ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    }).start();
    if (set.is_completed && !reduceMotion) {
      tickScale.setValue(0.8);
      Animated.timing(tickScale, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }).start();
    }
    wasCompleted.current = set.is_completed;
  }, [set.is_completed, reduceMotion, tickScale, tickFill]);

  // Run saves one at a time so an older response can't land after a newer one.
  const save = (changes: SetInput) => {
    saveQueue.current = saveQueue.current.then(() => onSave(changes));
  };

  const values = (): SetInput =>
    Object.fromEntries(fields.map(({ field }) => [field, parse(field, drafts[field])])) as SetInput;

  const isDirty = fields.some(({ field }) => parse(field, drafts[field]) !== set[field]);

  const saveIfDirty = () => {
    if (isDirty) save(values());
  };

  const cycleType = () => {
    const next = setTypeOrder[(setTypeOrder.indexOf(set.set_type) + 1) % setTypeOrder.length];
    save({ set_type: next });
  };

  const toggleDone = () => {
    if (set.is_completed) {
      save({ ...values(), is_completed: false });
      return;
    }
    tickHaptic();
    // An empty field takes the hinted value, so repeating last time's set is one tap.
    const withHints = Object.fromEntries(
      fields.map(({ field }) => [field, parse(field, drafts[field]) ?? hints[field] ?? null]),
    ) as SetInput;
    save({ ...withHints, is_completed: true });
  };

  const letter = setTypeLetter[set.set_type];
  const done = set.is_completed;

  return (
    <Reanimated.View entering={enter} exiting={exit} layout={reflow} style={styles.frame}>
      {/* Swiping only uncovers the button; nothing is deleted until it is tapped. A short swipe springs shut. */}
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        childrenContainerStyle={styles.slide}
        renderRightActions={() => (
          <Pressable
            onPress={() => {
              removeHaptic();
              onRemove();
            }}
            style={({ pressed }) => [styles.deleteAction, pressed && styles.deleteActionPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Delete set ${set.set_number}`}
          >
            <Ionicons name="trash" size={20} color={c.onAccent} />
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        )}
      >
        <Reanimated.View style={[styles.row, done && styles.rowDone, rowTransition]}>
          <AnimatedPressable
            onPress={cycleType}
            onLongPress={onDelete}
            style={[styles.setNumber, isCurrent && !done && styles.setNumberCurrent, markerTransition]}
            accessibilityRole="button"
            accessibilityLabel={`Set ${set.set_number}, ${set.set_type}${isCurrent ? ', up next' : ''}. Tap to change type, long press to delete.`}
          >
            <Reanimated.Text
              style={[
                styles.setNumberText,
                letter ? styles.setTypeLetter : null,
                set.set_type === 'failure' && styles.failureLetter,
                isCurrent && !done && styles.setNumberTextCurrent,
                done && styles.setNumberTextDone,
                textTransition,
              ]}
            >
              {letter || set.set_number}
            </Reanimated.Text>
          </AnimatedPressable>

          {fields.map(({ field, label }) => (
            <AnimatedTextInput
              key={field}
              value={drafts[field]}
              onChangeText={(v) => setDrafts((d) => ({ ...d, [field]: v }))}
              onFocus={() => setFocusedField(field)}
              onBlur={() => {
                setFocusedField(null);
                saveIfDirty();
              }}
              placeholder={hints[field] != null ? String(hints[field]) : '–'}
              placeholderTextColor={c.textMuted}
              selectionColor={c.accent}
              cursorColor={c.accent}
              keyboardType={field === 'weight_kg' ? 'decimal-pad' : 'number-pad'}
              selectTextOnFocus
              style={[
                styles.input,
                focusedField === field && styles.inputFocused,
                done && styles.inputDone,
                { transitionProperty: ['borderColor', 'backgroundColor'], transitionDuration: 150, transitionTimingFunction: easeOut },
              ]}
              accessibilityLabel={`Set ${set.set_number} ${label}`}
            />
          ))}

          <Pressable
            onPress={toggleDone}
            style={styles.tickTarget}
            hitSlop={4}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`Mark set ${set.set_number} ${done ? 'not done' : 'done'}`}
          >
            <Animated.View style={{ transform: [{ scale: tickScale }] }}>
              <Animated.View
                style={[
                  styles.tick,
                  {
                    backgroundColor: tickFill.interpolate({ inputRange: [0, 1], outputRange: [c.surface, c.success] }),
                    borderColor: tickFill.interpolate({ inputRange: [0, 1], outputRange: [c.ruleStrong, c.success] }),
                  },
                ]}
              >
                <Animated.View style={{ opacity: tickFill }}>
                  <Ionicons name="checkmark" size={20} color={c.onSuccess} />
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </Pressable>
        </Reanimated.View>
      </ReanimatedSwipeable>
    </Reanimated.View>
  );
}

const useStyles = makeStyles((c) => ({
  // The frame clips the row and its Delete button to one rounded shape.
  frame: { borderRadius: radius.lg, overflow: 'hidden' },
  // Opaque, so the button stays hidden until the row slides off it.
  slide: { backgroundColor: c.surface },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: c.danger,
  },
  deleteActionPressed: { opacity: 0.8 },
  deleteText: { ...type.caption, fontFamily: type.bodyStrong.fontFamily, color: c.onAccent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    padding: spacing.xs + 2,
    borderRadius: radius.lg,
  },
  rowDone: { backgroundColor: c.successSoft },
  setNumber: {
    width: 36,
    height: 36,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberCurrent: { borderColor: c.accent, backgroundColor: c.accentSoft },
  setNumberText: { ...type.numeral, fontSize: 16, lineHeight: 20, color: c.textMuted },
  setNumberTextCurrent: { color: c.accent, fontFamily: type.figure.fontFamily },
  setNumberTextDone: { color: c.successText },
  setTypeLetter: { color: c.record },
  failureLetter: { color: c.danger },
  input: {
    ...type.numeral,
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingVertical: 0,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: c.surfaceMuted,
    textAlign: 'center',
    color: c.text,
  },
  inputFocused: { borderColor: c.accent, backgroundColor: c.surface },
  inputDone: { backgroundColor: 'transparent' },
  tickTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tick: {
    width: 36,
    height: 36,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: c.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
