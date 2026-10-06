const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBillingPeriod, parseBillingReadingStartBoundary, selectBillingReadings } = require('../dist/billing/billing.service');

const reading = (value, readingAt) => ({ reading: value, readingAt: new Date(readingAt) });

test('date-only billing periods include the whole selected end date', () => {
  const start = parseBillingPeriod('2026-10-02');
  const end = parseBillingPeriod('2026-10-04', true);

  assert.equal(start.toISOString(), '2026-10-02T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-04T23:59:59.999Z');
  assert.ok(new Date('2026-10-02T15:26:00.000Z') >= start);
  assert.ok(new Date('2026-10-04T15:32:00.000Z') <= end);
});

test('date-only start boundary includes readings later on the start date', () => {
  const start = parseBillingPeriod('2026-10-01');
  const boundary = parseBillingReadingStartBoundary('2026-10-01');
  assert.equal(start.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(boundary.toISOString(), '2026-10-01T23:59:59.999Z');
  const result = selectBillingReadings([reading(1000, '2026-10-01T06:53:00.000Z')], start, parseBillingPeriod('2026-10-31', true), boundary);
  assert.equal(result.starting.reading, 1000);
});

test('opening selection does not use a reading from the next calendar day', () => {
  const start = parseBillingPeriod('2026-10-01');
  const boundary = parseBillingReadingStartBoundary('2026-10-01');
  const result = selectBillingReadings([reading(1000, '2026-10-02T00:01:00.000Z')], start, parseBillingPeriod('2026-10-31', true), boundary);
  assert.equal(result.starting, undefined);
});

test('opening selection preserves the existing latest-reading-at-or-before rule', () => {
  const start = parseBillingPeriod('2026-10-01');
  const boundary = parseBillingReadingStartBoundary('2026-10-01');
  const result = selectBillingReadings([reading(900, '2026-09-30T12:00:00.000Z'), reading(1000, '2026-10-01T06:53:00.000Z')], start, parseBillingPeriod('2026-10-31', true), boundary);
  assert.equal(result.starting.reading, 1000);
});

test('closing selection includes the end date but excludes later readings', () => {
  const start = parseBillingPeriod('2026-10-01');
  const end = parseBillingPeriod('2026-10-31', true);
  const result = selectBillingReadings([reading(1125, '2026-10-31T23:59:59.999Z'), reading(1200, '2026-11-01T00:00:00.000Z')], start, end, parseBillingReadingStartBoundary('2026-10-01'));
  assert.equal(result.ending.reading, 1125);
});

test('John scenario calculates 125 kWh', () => {
  const start = parseBillingPeriod('2026-10-01');
  const end = parseBillingPeriod('2026-10-31', true);
  const result = selectBillingReadings([reading(1000, '2026-10-01T06:53:00.000Z'), reading(1125, '2026-10-04T12:32:00.000Z')], start, end, parseBillingReadingStartBoundary('2026-10-01'));
  assert.equal(result.ending.reading - result.starting.reading, 125);
});

test('timestamp billing periods preserve chronological boundaries', () => {
  const start = parseBillingPeriod('2026-10-02T15:26:00.000Z');
  const end = parseBillingPeriod('2026-10-04T15:32:00.000Z', true);
  assert.ok(start < end);
  assert.equal(start.toISOString(), '2026-10-02T15:26:00.000Z');
  assert.equal(end.toISOString(), '2026-10-04T15:32:00.000Z');
});

test('insufficient readings remain distinguishable from a valid chronological period', () => {
  const start = parseBillingPeriod('2026-10-02');
  const end = parseBillingPeriod('2026-10-04', true);
  const closing = new Date('2026-10-04T15:32:00.000Z');
  const readings = [closing];
  const opening = readings.filter((readingAt) => readingAt <= start);
  assert.equal(opening.length, 0);
  assert.ok(closing <= end);
});

test('reversed billing periods remain invalid', () => {
  assert.ok(parseBillingPeriod('2026-10-05') >= parseBillingPeriod('2026-10-04', true));
});
