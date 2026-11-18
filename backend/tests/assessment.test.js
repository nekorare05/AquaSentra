'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessStoredReading } = require('../src/services/assessment');
const params = require('../config/parameters.json');
function make(payload = {}, options = {}) {
  return { _id: 'sim-id-1', device_id: 'AS-ESP32-001',
    payload: { pH: 7.2, turbidity: 1.4, TDS: 200, temperature_c: 27, ...payload },
    validity: { is_valid: true, codes: [] }, eligible_for_live_decision: true, ...options };
}
async function assess(saved) {
  const result = { readingUpdates: [], alertUpdates: [] };
  const readings = { updateOne: async (...args) => result.readingUpdates.push(args) };
  const alerts = { updateOne: async (...args) => result.alertUpdates.push(args) };
  result.report = await assessStoredReading({ saved, readings, alerts, params });
  return result;
}
test('ST2-15 valid Normal persists rating and emits no warning', async () => {
  const result = await assess(make());
  assert.equal(result.readingUpdates.length, 1);
  assert.equal(result.readingUpdates[0][1].$set.rule_rating, 'Normal');
  assert.equal(result.alertUpdates.length, 0);
});
test('ST2-16 valid Risky saves rating and early-warning alert', async () => {
  const result = await assess(make({ pH: 8.7 }));
  assert.equal(result.readingUpdates[0][1].$set.rule_rating, 'Risky');
  assert.equal(result.alertUpdates[0][1].$setOnInsert.kind, 'early_warning');
  assert.equal(result.alertUpdates[0][2].upsert, true);
});
test('ST2-17 Critical on first valid sample produces immediate Critical alert', async () => {
  const result = await assess(make({ turbidity: 11 }));
  assert.equal(result.alertUpdates[0][1].$setOnInsert.kind, 'critical');
  assert.equal(result.readingUpdates[0][1].$set.rule_rating, 'Critical');
});
test('ST2-18 delayed valid Risky has rating but creates NO live alert', async () => {
  const result = await assess(make({ TDS: 800 }, { eligible_for_live_decision: false, is_delayed: true }));
  assert.equal(result.readingUpdates[0][1].$set.rule_rating, 'Risky');
  assert.equal(result.alertUpdates.length, 0);
});
test('ST2-19 flagged sensor fault is excluded and gets notice', async () => {
  const result = await assess(make({ pH: 18 }, { validity: { is_valid: false, codes: ['OUT_OF_RANGE_pH'] }, eligible_for_live_decision: false }));
  assert.equal(result.readingUpdates.length, 0);
  assert.equal(result.alertUpdates[0][1].$setOnInsert.kind, 'sensor_fault');
});
test('ST2-20 duplicate alone is invalid, unrated, and not a sensor alert', async () => {
  const result = await assess(make({}, { validity: { is_valid: false, codes: ['DUPLICATE_READING'] }, eligible_for_live_decision: false }));
  assert.equal(result.readingUpdates.length, 0);
  assert.equal(result.alertUpdates.length, 0);
});
test('ST2-21 alert issuance never emits valve command, classification only', async () => {
  const result = await assess(make({ pH: 12 }));
  assert.equal(result.report.rated, true);
  assert.equal(result.alertUpdates[0][1].$setOnInsert.message.includes('No valve action'), true);
  assert.equal(result.alertUpdates.flat().some(x => JSON.stringify(x).includes('valve_command')), false);
});
