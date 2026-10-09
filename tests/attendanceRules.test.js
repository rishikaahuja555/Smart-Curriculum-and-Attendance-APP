import assert from 'node:assert/strict';
import { it } from 'node:test';
import { calculateSafeAbsences } from '../src/data/attendanceRules.js';

it('floors safe absences using the configured attendance fraction', () => {
  assert.equal(calculateSafeAbsences(14, 16, 4, 0.75), 3);
  assert.equal(calculateSafeAbsences(14, 16, 4, 0.9), 0);
  assert.equal(calculateSafeAbsences(8, 10, 4, 0.75), 1);
});

it('never reports a negative number of allowable absences', () => {
  assert.equal(calculateSafeAbsences(6, 10, 4, 0.75), 0);
  assert.equal(calculateSafeAbsences(9, 10, 0, 0.75), 1);
});

it('rejects invalid counts and attendance fractions', () => {
  assert.throws(() => calculateSafeAbsences(-1, 10, 2, 0.75), RangeError);
  assert.throws(() => calculateSafeAbsences(5, 10, 2, 1.1), RangeError);
});