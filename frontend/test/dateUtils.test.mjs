import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDateString } from '../src/lib/dateUtils.ts';

test('Date normalization: 22-05-2007 -> 2007-05-22', () => {
  assert.strictEqual(normalizeDateString('22-05-2007'), '2007-05-22');
});

test('Date normalization: 22/05/2007 -> 2007-05-22', () => {
  assert.strictEqual(normalizeDateString('22/05/2007'), '2007-05-22');
});

test('Date normalization: 22.05.2007 -> 2007-05-22', () => {
  assert.strictEqual(normalizeDateString('22.05.2007'), '2007-05-22');
});

test('Date normalization: 2007-05-22 remains unchanged', () => {
  assert.strictEqual(normalizeDateString('2007-05-22'), '2007-05-22');
});

test('Date normalization: handles single digit day and month (2-5-2007 -> 2007-05-02)', () => {
  assert.strictEqual(normalizeDateString('2-5-2007'), '2007-05-02');
  assert.strictEqual(normalizeDateString('2/5/2007'), '2007-05-02');
});

test('Date normalization: handles ISO with slashes (2007/05/22 -> 2007-05-22)', () => {
  assert.strictEqual(normalizeDateString('2007/05/22'), '2007-05-22');
});

test('Date normalization: handles Date objects', () => {
  const d = new Date(Date.UTC(2007, 4, 22));
  assert.strictEqual(normalizeDateString(d), '2007-05-22');
});

test('Date normalization: invalid/ambiguous dates return null for human correction', () => {
  // Ambiguous 2-digit year
  assert.strictEqual(normalizeDateString('22/05/07'), null);
  assert.strictEqual(normalizeDateString('22-05-07'), null);

  // Invalid calendar dates
  assert.strictEqual(normalizeDateString('31-02-2007'), null); // Feb 31 does not exist
  assert.strictEqual(normalizeDateString('29-02-2007'), null); // 2007 is not a leap year
  assert.strictEqual(normalizeDateString('32-05-2007'), null); // Day 32
  assert.strictEqual(normalizeDateString('22-13-2007'), null); // Month 13

  // Leap year valid date
  assert.strictEqual(normalizeDateString('29-02-2008'), '2008-02-29'); // 2008 is a leap year

  // Malformed text
  assert.strictEqual(normalizeDateString('bad-date-format'), null);
  assert.strictEqual(normalizeDateString('yesterday'), null);
  assert.strictEqual(normalizeDateString(''), null);
  assert.strictEqual(normalizeDateString(null), null);
  assert.strictEqual(normalizeDateString(undefined), null);
});
