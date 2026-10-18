// Run with `node scripts/check-previous-sets.mjs` (Node 23.6+ strips the TypeScript types).
import assert from 'node:assert/strict';

import { previousSetHint } from '../src/lib/previousSets.ts';

const set = (set_type, weight_kg) => ({ set_type, weight_kg });

// Last time: a ticked warmup, then two working sets.
const last = [set('warmup', 20), set('normal', 60), set('normal', 65)];

// Today without a warmup: working sets line up with last time's working sets, not the warmup.
const today = [set('normal', null), set('normal', null), set('normal', null)];
assert.equal(previousSetHint(today, 0, last)?.weight_kg, 60);
assert.equal(previousSetHint(today, 1, last)?.weight_kg, 65);
assert.equal(previousSetHint(today, 2, last), undefined);

// Today with a warmup: it gets last time's warmup, and the working sets still line up.
const withWarmup = [set('warmup', null), set('normal', null)];
assert.equal(previousSetHint(withWarmup, 0, last)?.weight_kg, 20);
assert.equal(previousSetHint(withWarmup, 1, last)?.weight_kg, 60);

// No last session.
assert.equal(previousSetHint(today, 0, undefined), undefined);

console.log('previous set hints OK');
