'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReading, parseIsoTime, schemaErrors } = require('../src/services/validation');
const params = require('../config/parameters.json');
const FIXED = new Date('2026-11-15T09:00:00.000Z');
const DEVICE = 'AS-ESP32-001';
const base = () => ({
  device_id: DEVICE, measured_at: '2026-11-15T09:00:00.000Z', pH: 7.1,
  turbidity: 2.5, turbidity_unit: 'NTU', TDS: 301, tds_unit: 'mg/L',
  temperature_c: 26.4,
  sensor_status: { ph: 'ok', turbidity: 'ok', tds: 'ok', temperature: 'ok', clock: 'synced' },
  boot_flag: false
});
function check(body) { return validateReading(body, DEVICE, FIXED, params); }

test('ST1-01 valid record meets schema, units, plausible ranges and time', () => {
  const result = check(base());
  assert.equal(result.is_valid, true);
  assert.equal(result.eligible_for_live_decision, true);
  assert.deepEqual(result.codes, []);
});
test('ST1-02 missing sensor field is invalid', () => {
  const r = base(); delete r.pH;
  assert.equal(check(r).is_valid, false);
  assert.ok(check(r).codes.includes('MISSING_pH'));
});
test('ST1-03 wrong units and unknown fields rejected', () => {
  const r = base(); r.tds_unit = 'ppm'; r.illegalExtra = 1;
  assert.ok(check(r).codes.includes('BAD_TDS_UNIT'));
  assert.ok(check(r).codes.includes('UNKNOWN_FIELD_illegalExtra'));
});
test('ST1-04 out-of-range sensor rejected, distinct from rule rating', () => {
  const r = base(); r.pH = 18;
  assert.ok(check(r).codes.includes('OUT_OF_RANGE_pH'));
});
test('ST1-05 sensor fault and stuck flag rejected', () => {
  const r = base(); r.sensor_status.ph = 'stuck';
  assert.ok(check(r).codes.includes('SENSOR_FAULT_ph'));
});
test('ST1-06 clock unsynced rejects live decision', () => {
  const r = base(); r.sensor_status.clock = 'unsynced';
  assert.ok(check(r).codes.includes('CLOCK_UNSYNCED'));
  assert.equal(check(r).eligible_for_live_decision, false);
});
test('ST1-07 delayed record within backfill window is valid but not live eligible', () => {
  const r = base(); r.measured_at = '2026-11-15T08:55:00.000Z';
  const result = check(r);
  assert.equal(result.is_valid, true);
  assert.equal(result.is_delayed, true);
  assert.equal(result.eligible_for_live_decision, false);
});
test('ST1-08 expired delayed record invalid', () => {
  const r = base(); r.measured_at = '2026-11-13T09:00:00.000Z';
  assert.ok(check(r).codes.includes('TIMESTAMP_TOO_OLD'));
});
test('ST1-09 future clock reading invalid', () => {
  const r = base(); r.measured_at = '2026-11-15T09:10:00.000Z';
  assert.ok(check(r).codes.includes('TIMESTAMP_IN_FUTURE'));
});
test('ST1-10 mismatched credential device ID rejected from eligibility', () => {
  const r = base(); r.device_id = 'DIFFERENT-DEVICE';
  assert.ok(check(r).codes.includes('DEVICE_ID_MISMATCH'));
});
test('ST1-11 timezone offset supported; impossible calendar dates rejected', () => {
  assert.equal(parseIsoTime('2026-11-15T17:00:00+08:00').toISOString(), FIXED.toISOString());
  assert.equal(parseIsoTime('2026-02-30T09:00:00Z'), null);
  assert.ok(schemaErrors({ ...base(), measured_at: '2026-02-30T09:00:00Z' }).includes('BAD_MEASURED_AT'));
});
test('ST1-12 missing record is invalid and cannot reach live decisions', () => {
  const outcome = check(null);
  assert.equal(outcome.is_valid, false);
  assert.equal(outcome.eligible_for_live_decision, false);
});
test('ST1-13 required status field invalidates record', () => {
  const r = base(); delete r.sensor_status.temperature;
  assert.ok(check(r).codes.includes('MISSING_STATUS_temperature'));
});
test('ST1-14 physical plausibility differs from safety/potability classification', () => {
  const r = base(); r.pH = 10.4;
  assert.equal(check(r).is_valid, true);
});
