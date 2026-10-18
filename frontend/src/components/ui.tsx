import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enter, exit, pressScale, useReduceMotion } from '@/lib/motion';
import { makeStyles, radius, spacing, type, useColors } from '@/lib/theme';

/** Themed text styles: `const t = useText();` then `<Text style={t.body}>`. */
export const useText = makeStyles((c) => ({
  largeTitle: { ...type.largeTitle, color: c.text },
  title: { ...type.title, color: c.text },
  heading: { ...type.heading, color: c.text },
  body: { ...type.body, color: c.text },
  bodyStrong: { ...type.bodyStrong, color: c.text },
  label: { ...type.label, color: c.text },
  muted: { ...type.label, color: c.textMuted },
  caption: { ...type.caption, color: c.textMuted },
  column: { ...type.column, color: c.textMuted },
  numeral: { ...type.numeral, color: c.text },
  stat: { ...type.stat, color: c.text },
  figure: { ...type.figure, color: c.text },
  link: { ...type.label, fontFamily: type.bodyStrong.fontFamily, color: c.accent },
}));

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive';

/**
 * Pill buttons: primary is solid blue, destructive solid red, secondary a soft tonal fill, ghost and danger are
 * text only.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const c = useColors();
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;
  const textColor = { primary: c.onAccent, secondary: c.accent, ghost: c.accent, danger: c.danger, destructive: c.onAccent }[variant];
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isDisabled}
      style={[
        styles.button,
        styles[variant],
        pressed && !isDisabled && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        isDisabled && styles.disabled,
        pressScale(pressed && !isDisabled, reduceMotion),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
          <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

/** A labeled, filled input; its outline turns blue while typing. */
export function Field({ label, error, style, onFocus, onBlur, ...props }: TextInputProps & { label: string; error?: string }) {
  const styles = useStyles();
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textFaint}
        selectionColor={c.accent}
        cursorColor={c.accent}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null, style]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/** A rounded surface that groups related content. `flush` drops the padding for edge-to-edge list rows. */
export function Card({ children, style, flush = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; flush?: boolean }) {
  const styles = useStyles();
  return <View style={[styles.card, flush && styles.cardFlush, style]}>{children}</View>;
}

/** A titled block: heading with an optional action on the right, then its content. */
export function Section({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {title}
          </Text>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** A large title for the top of a tab, clear of the status bar, with an optional control on the right. */
export function ScreenTitle({ title, right }: { title: string; right?: ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screenTitle, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.screenTitleText} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/** A divider between rows inside a card, inset from the left edge like iOS grouped lists. */
export function Rule({ inset = spacing.lg, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.rule, { marginLeft: inset }, style]} />;
}

/**
 * One row of a grouped list that scrolls as a FlatList: rows join into a single rounded card,
 * the first and last rounding its corners, an inset divider above every row but the first.
 */
export function GroupedRow({ index, total, children }: { index: number; total: number; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={[styles.groupedRow, index === 0 && styles.groupedFirst, index === total - 1 && styles.groupedLast]}>
      {index > 0 ? <Rule /> : null}
      {children}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useStyles();
  const c = useColors();
  return (
    <Animated.View entering={enter} exiting={exit} style={styles.errorBanner} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={20} color={c.danger} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.errorRetry}>Retry</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

export function Loading() {
  const styles = useStyles();
  const c = useColors();
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={c.accent} />
    </View>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {action}
    </View>
  );
}

/** A filter or choice pill. Selected shows a check as well as color, so state never rests on color alone. */
export function Chip({
  label,
  selected,
  onPress,
  count,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Shown after the label, e.g. how many items the filter matches. */
  count?: number;
}) {
  const styles = useStyles();
  const c = useColors();
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
        pressScale(pressed, reduceMotion),
        // The fill eases between off and on; the check swaps at once, so state never waits on the motion.
        { transitionProperty: ['transform', 'backgroundColor'], transitionDuration: [150, 180] },
      ]}
    >
      {selected ? <Ionicons name="checkmark" size={16} color={c.onAccent} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      {count !== undefined ? (
        <Text style={[styles.chipCount, selected && styles.chipTextSelected]}>{count}</Text>
      ) : null}
    </AnimatedPressable>
  );
}

const useStyles = makeStyles((c) => ({
  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: c.accentFill },
  primaryPressed: { backgroundColor: c.accentPressed },
  secondary: { backgroundColor: c.surfaceMuted, minHeight: 48 },
  ghost: { backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: spacing.md },
  danger: { backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: spacing.md },
  destructive: { backgroundColor: c.dangerFill },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  buttonText: { ...type.bodyStrong },
  field: { gap: spacing.sm },
  fieldLabel: { ...type.label, color: c.textMuted },
  input: {
    ...type.body,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: c.surfaceMuted,
    color: c.text,
  },
  inputFocused: { borderColor: c.accent, backgroundColor: c.surface },
  inputError: { borderColor: c.danger },
  fieldError: { ...type.caption, color: c.danger },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    shadowColor: '#0F1115',
    shadowOpacity: c.shadow === 'transparent' ? 0 : 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: c.shadow === 'transparent' ? 0 : 1,
  },
  cardFlush: { padding: 0, overflow: 'hidden' },
  section: { gap: spacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 32,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: { ...type.title, fontSize: 22, lineHeight: 28, color: c.text, flexShrink: 1 },
  screenTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    // Screens pad 16pt for cards; titles sit at 20pt like section headings.
    paddingHorizontal: spacing.xs,
  },
  screenTitleText: { ...type.largeTitle, color: c.text, flexShrink: 1 },
  rule: { height: 1, backgroundColor: c.rule },
  groupedRow: { backgroundColor: c.surface, overflow: 'hidden' },
  groupedFirst: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  groupedLast: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.dangerSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  errorText: { ...type.label, color: c.danger, flex: 1 },
  errorRetry: { ...type.label, fontFamily: type.bodyStrong.fontFamily, color: c.danger },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: c.background },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...type.heading, color: c.text, textAlign: 'center' },
  emptyMessage: { ...type.label, color: c.textMuted, textAlign: 'center', maxWidth: 320 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.round,
    backgroundColor: c.surfaceMuted,
  },
  chipSelected: { backgroundColor: c.accentFill },
  chipText: { ...type.label, color: c.text },
  chipTextSelected: { color: c.onAccent, fontFamily: type.bodyStrong.fontFamily },
  chipCount: { ...type.caption, color: c.textMuted, fontVariant: ['tabular-nums'] },
}));
