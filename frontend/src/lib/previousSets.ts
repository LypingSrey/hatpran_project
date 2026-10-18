import type { ExerciseSet } from './types';

/**
 * Last session's set to show as the hint for sets[index]: the same-numbered ticked set of the same type, so
 * warmups line up with warmups and a warmup done one time but not the other doesn't shift every hint after it.
 * Checked by scripts/check-previous-sets.mjs.
 */
export function previousSetHint<T extends Pick<ExerciseSet, 'set_type'>>(
  sets: T[],
  index: number,
  previous: T[] | undefined,
): T | undefined {
  const type = sets[index].set_type;
  const nth = sets.slice(0, index).filter((s) => s.set_type === type).length;
  return previous?.filter((s) => s.set_type === type)[nth];
}
