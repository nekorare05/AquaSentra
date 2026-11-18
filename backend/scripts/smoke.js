'use strict';
// Actual HTTPS + MongoDB smoke test, requires locally running stack.
require('dotenv').config();
const assert = require('node:assert/strict');
const https = require('node:https');
const host = process.env.HOST || '127.0.0.1';
if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Smoke test only permits localhost: never disable TLS verification for a remote server');
const port = Number(process.env.PORT || 8443);
const device = { 'x-device-id': process.env.BOOTSTRAP_DEVICE_ID, 'x-device-token': process.env.BOOTSTRAP_DEVICE_TOKEN };
const user = { 'x-user-id': process.env.BOOTSTRAP_ADMIN_ID, 'x-user-token': process.env.BOOTSTRAP_ADMIN_TOKEN };
function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = https.request({ host, port, path, method, rejectUnauthorized: false,
      headers: { ...(data !== null && { 'content-type': 'application/json' }), ...headers }
    }, res => {
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', chunk => buffer += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buffer) }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    if (data !== null) req.write(data);
    req.end();
  });
}
async function main() {
  const stamp = new Date().toISOString();
  const payload = { device_id: device['x-device-id'], measured_at: stamp,
    pH: 7.1, turbidity: 1.5, turbidity_unit: 'NTU', TDS: 240, tds_unit: 'mg/L',
    temperature_c: 26.0,
    sensor_status: { ph:'ok', turbidity:'ok', tds:'ok', temperature:'ok', clock:'synced' },
    boot_flag: false };
  const cases = [
    { id: 'HTTP-01', precondition: 'HTTPS server running', input: 'GET health', expected: 200,
      execute: () => request('GET', '/api/v1/health') },
    { id: 'HTTP-02', precondition: 'No prior reading for timestamp', input: 'POST valid', expected: 201,
      execute: () => request('POST', '/api/v1/readings', payload, device) },
    { id: 'HTTP-03', precondition: 'Same timestamp was saved', input: 'POST duplicate', expected: 202,
      execute: () => request('POST', '/api/v1/readings', payload, device) },
    { id: 'HTTP-04', precondition: 'Authenticated user', input: 'GET recent readings', expected: 200,
      execute: () => request('GET', '/api/v1/readings?limit=5', undefined, user) },
    { id: 'HTTP-05', precondition: 'No device token header', input: 'POST unauthorized', expected: 401,
      execute: () => request('POST', '/api/v1/readings', payload) }
  ];
  for (const c of cases) {
    const result = await c.execute();
    const pass = result.status === c.expected;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${c.id} | precondition=${c.precondition} | input=${c.input} | expected=${c.expected} | observed=${result.status}`);
    assert.equal(result.status, c.expected, JSON.stringify(result.body));
    if (c.id === 'HTTP-03') assert.ok(result.body.validity.codes.includes('DUPLICATE_READING'));
  }
  console.log('All 5 HTTPS/MongoDB smoke cases passed.');
}
main().catch(err => { console.error(err.message); process.exit(1); });
