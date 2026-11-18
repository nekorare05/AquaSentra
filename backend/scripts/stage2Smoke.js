'use strict';
/** Stage 2 live HTTP/MongoDB checks. Run while backend and Docker are running. */
require('dotenv').config();
const assert = require('node:assert/strict');
const https = require('node:https');
const host = process.env.HOST || '127.0.0.1';
if (!['localhost','127.0.0.1','::1'].includes(host)) throw new Error('Local smoke tests only');
const port = Number(process.env.PORT || 8443);
const device = { 'x-device-id': process.env.BOOTSTRAP_DEVICE_ID, 'x-device-token': process.env.BOOTSTRAP_DEVICE_TOKEN };
const viewer = { 'x-user-id': process.env.BOOTSTRAP_VIEWER_ID, 'x-user-token': process.env.BOOTSTRAP_VIEWER_TOKEN };
function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({ hostname: host, port, method, path, rejectUnauthorized: false,
      headers: { ...(data ? { 'content-type':'application/json' } : {}), ...headers } }, response => {
      let chunks = '';
      response.on('data', part => chunks += part);
      response.on('end', () => { try { resolve({ status: response.statusCode, body: JSON.parse(chunks) }); } catch(e) { reject(e); } });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
function sample(pH, extra = {}) {
  return { device_id: device['x-device-id'], measured_at: new Date().toISOString(), pH,
    turbidity: 2.0, turbidity_unit: 'NTU', TDS: 260, tds_unit: 'mg/L', temperature_c: 27,
    sensor_status: { ph:'ok', turbidity:'ok', tds:'ok', temperature:'ok', clock:'synced' }, boot_flag: false,
    ...extra };
}
async function main() {
  const test = async (id, input, expected, fn) => {
    const response = await fn();
    const passed = response.status === expected;
    console.log(`${passed ? 'PASS' : 'FAIL'} ${id} | input=${input} | expected=${expected} | observed=${response.status}`);
    assert.equal(response.status, expected, JSON.stringify(response.body));
    return response;
  };
  const health = await test('S2-HTTP-01','GET health',200,() => req('GET','/api/v1/health'));
  assert.equal(health.body.stage, 7);
  assert.equal(health.body.valve_automation_enabled, false);
  const risky = await test('S2-HTTP-02','POST Risky reading',201,() => req('POST','/api/v1/readings',sample(8.7),device));
  assert.equal(risky.body.rule_rating,'Risky');
  const critical = await test('S2-HTTP-03','POST Critical reading',201,() => req('POST','/api/v1/readings',sample(11),device));
  assert.equal(critical.body.rule_rating,'Critical');
  const invalid = await test('S2-HTTP-04','POST invalid sensor',202,() => req('POST','/api/v1/readings',sample(18),device));
  assert.equal(invalid.body.rule_rating,null);
  const dashboard = await test('S2-HTTP-05','GET dashboard',200,() => req('GET','/api/v1/dashboard',null,viewer));
  assert.equal(dashboard.body.valve.virtual,true);
  const alerts = await test('S2-HTTP-06','GET stored alerts',200,() => req('GET','/api/v1/alerts?limit=500',null,viewer));
  assert.ok(alerts.body.alerts.some(a => a.kind === 'early_warning' && String(a.reading_id) === risky.body.id));
  assert.ok(alerts.body.alerts.some(a => a.kind === 'critical' && String(a.reading_id) === critical.body.id));
  assert.ok(alerts.body.alerts.some(a => a.kind === 'sensor_fault' && String(a.reading_id) === invalid.body.id));
  await test('S2-HTTP-07','GET history and ratings',200,() => req('GET','/api/v1/readings?limit=10',null,viewer));
  await test('S2-HTTP-08','GET parameters',200,() => req('GET','/api/v1/parameters',null,viewer));
  await test('S2-HTTP-09','No anonymous dashboard',401,() => req('GET','/api/v1/dashboard'));
  await test('S2-HTTP-10','No valve route',404,() => req('POST','/api/v1/valve/close',{},viewer));
  console.log('All 10 Stage 2 HTTPS/MongoDB smoke cases passed.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
