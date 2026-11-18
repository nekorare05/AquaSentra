'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ingestReading } = require('../src/services/ingest');
const { makeCredentialHash, verifyCredential } = require('../src/services/credentials');
const params = require('../config/parameters.json');
const DEVICE = 'AS-ESP32-001';
const NOW = new Date('2026-11-15T09:00:00.000Z');
function valid() { return {
  device_id: DEVICE, measured_at: '2026-11-15T09:00:00.000Z', pH: 7.1, turbidity: 1,
  turbidity_unit: 'NTU', TDS: 200, tds_unit: 'mg/L', temperature_c: 28,
  sensor_status: { ph: 'ok', turbidity: 'ok', tds: 'ok', temperature: 'ok', clock: 'synced' },
  boot_flag: false
}; }
class MemoryRepository {
  constructor() { this.records = []; }
  async create(doc) {
    if (doc.is_canonical && this.records.some(d => d.is_canonical && d.device_id === doc.device_id && d.measured_at?.getTime() === doc.measured_at?.getTime())) {
      const error = new Error('Duplicate key'); error.code = 11000; throw error;
    }
    const saved = { ...doc, _id: String(this.records.length + 1) };
    this.records.push(saved);
    return saved;
  }
}
const ingest = (payload, repo) => ingestReading({ payload, deviceId: DEVICE, repository: repo, now: NOW, params });
test('ST1-15 valid reading persisted with no rating or inference', async () => {
  const repo = new MemoryRepository(); const one = await ingest(valid(), repo);
  assert.equal(one.saved.validity.is_valid, true);
  assert.equal(one.saved.rule_rating, null);
  assert.equal(repo.records.length, 1);
});
test('ST1-16 duplicate pair stored invalid, canonical survives', async () => {
  const repo = new MemoryRepository(); await ingest(valid(), repo);
  const second = await ingest(valid(), repo);
  assert.equal(repo.records.length, 2);
  assert.equal(repo.records[0].is_canonical, true);
  assert.equal(repo.records[1].is_canonical, false);
  assert.ok(second.saved.validity.codes.includes('DUPLICATE_READING'));
  assert.equal(second.saved.eligible_for_live_decision, false);
});
test('ST1-17 invalid reading stored but not eligible', async () => {
  const repo = new MemoryRepository(); const bad = valid(); bad.pH = -1;
  const result = await ingest(bad, repo);
  assert.equal(repo.records.length, 1);
  assert.equal(result.saved.validity.is_valid, false);
  assert.equal(result.saved.eligible_for_live_decision, false);
});
test('ST1-18 first invalid timestamp key still blocks later overwrite', async () => {
  const repo = new MemoryRepository(); const bad = valid(); bad.pH = -1;
  await ingest(bad, repo);
  const result = await ingest(valid(), repo);
  assert.ok(result.saved.validity.codes.includes('DUPLICATE_READING'));
});
test('ST1-19 invalid unparseable timestamp retained without canonical key', async () => {
  const repo = new MemoryRepository(); const bad = valid(); bad.measured_at = 'invalid';
  const one = await ingest(bad, repo);
  assert.equal(one.saved.is_canonical, false);
  assert.equal(one.saved.validity.is_valid, false);
  assert.equal(repo.records.length, 1);
});
test('ST1-20 device-specific scrypt secret validates without plaintext stored', () => {
  const hashed = makeCredentialHash('A_LONG_RANDOM_TEST_DEVICE_SECRET_123456');
  assert.equal(verifyCredential('A_LONG_RANDOM_TEST_DEVICE_SECRET_123456', hashed), true);
  assert.equal(verifyCredential('wrong', hashed), false);
  assert.ok(!JSON.stringify(hashed).includes('A_LONG_RANDOM_TEST_DEVICE_SECRET_123456'));
});
test('ST1-21 repeated submissions serialize canonical claim in repository', async () => {
  const repo = new MemoryRepository();
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => ingest(valid(), repo)));
  assert.equal(outcomes.filter(o => o.saved.validity.is_valid).length, 1);
  assert.equal(repo.records.length, 8);
});
