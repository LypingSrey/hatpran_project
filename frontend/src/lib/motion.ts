import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { cubicBezier, Easing, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

/** Whether the phone asks for less motion (iOS Reduce Motion, Android Remove animations). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => active && setReduce(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

/** A light tap under the thumb when a set is ticked. Phones only; the web has no haptics. */
export function tickHaptic() {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Strong ease-out for anything entering or changing state; `motionCurve` is the same curve for layout animations. */
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);
export const motionCurve = Easing.bezier(0.23, 1, 0.32, 1);

/** A new row or note rises 8pt into place; a removed one fades; the rows around it glide to their new places. */
export const enter = FadeInDown.duration(220).easing(motionCurve).withInitialValues({ transform: [{ translateY: 8 }] });
export const exit = FadeOut.duration(150);
export const reflow = LinearTransition.duration(220).easing(motionCurve);

/** Pressables sink to 97% under the finger. Reduce Motion keeps only the opacity/color press states. */
export function pressScale(pressed: boolean, reduced: boolean) {
  return {
    transform: [{ scale: pressed && !reduced ? 0.97 : 1 }],
    transitionProperty: 'transform',
    transitionDuration: 150,
    transitionTimingFunction: easeOut,
  } as const;
}

/** A firmer tap when something is deleted. Phones only. */
export function removeHaptic() {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** The success buzz when a workout is finished or a rest is over. Phones only. */
export function finishHaptic() {
  if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
