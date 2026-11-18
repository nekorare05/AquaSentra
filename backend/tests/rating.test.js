'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertRatingParameters, rateReading } = require('../src/services/rating');
const params = require('../config/parameters.json');
const base = () => ({ pH: 7.0, turbidity: 2.0, TDS: 200, temperature_c: 26 });
const classify = data => rateReading({ ...base(), ...data }, params);

test('ST2-01 provisional parameter register is internally consistent', () => assert.doesNotThrow(() => assertRatingParameters(params)));
test('ST2-02 Normal factors and overall Normal at inclusive boundary', () => {
  const result = classify({ pH: 6.5, turbidity: 5, TDS: 600 });
  assert.equal(result.overall, 'Normal');
  assert.deepEqual(result.individual, { pH:'Normal', turbidity:'Normal', TDS:'Normal' });
});
test('ST2-03 upper pH Normal boundary 8.5 inclusive', () => assert.equal(classify({ pH: 8.5 }).overall, 'Normal'));
test('ST2-04 just outside pH Normal enters Risky', () => assert.equal(classify({ pH: 8.5001 }).individual.pH, 'Risky'));
test('ST2-05 pH Risky outer boundaries inclusive', () => {
  assert.equal(classify({ pH: 6.0 }).overall, 'Risky');
  assert.equal(classify({ pH: 9.0 }).overall, 'Risky');
});
test('ST2-06 pH beyond outer range Critical', () => {
  assert.equal(classify({ pH: 5.99 }).overall, 'Critical');
  assert.equal(classify({ pH: 9.01 }).overall, 'Critical');
});
test('ST2-07 turbidity >5 to ≤10 Risky, >10 Critical', () => {
  assert.equal(classify({ turbidity: 5.01 }).overall, 'Risky');
  assert.equal(classify({ turbidity: 10 }).overall, 'Risky');
  assert.equal(classify({ turbidity: 10.01 }).overall, 'Critical');
});
test('ST2-08 TDS >600 to ≤900 Risky, >900 Critical', () => {
  assert.equal(classify({ TDS: 601 }).overall, 'Risky');
  assert.equal(classify({ TDS: 900 }).overall, 'Risky');
  assert.equal(classify({ TDS: 900.1 }).overall, 'Critical');
});
test('ST2-09 overall worst individual rating wins', () => {
  const out = classify({ pH: 6.2, turbidity: 13, TDS: 720 });
  assert.deepEqual(out.individual, { pH:'Risky', turbidity:'Critical', TDS:'Risky' });
  assert.equal(out.overall, 'Critical');
});
test('ST2-10 temperature out of operational reference does not influence rating', () => {
  const out = classify({ temperature_c: 43 });
  assert.equal(out.overall, 'Normal');
  assert.match(out.temperature_operational_note, /Outside provisional operational/);
});
test('ST2-11 rejects missing or nonfinite metrics, never rates invalid records', () => {
  assert.throws(() => rateReading({ ...base(), pH: NaN }, params), /Cannot rate/);
  assert.throws(() => rateReading({ ...base(), TDS: undefined }, params), /Cannot rate/);
});
test('ST2-12 changing editable thresholds changes rating deterministically', () => {
  const copy = JSON.parse(JSON.stringify(params));
  copy.rule_rating.turbidity.normal_max = 9;
  copy.rule_rating.turbidity.risky_max = 15;
  assert.equal(rateReading({ ...base(), turbidity: 8 }, params).overall, 'Risky');
  assert.equal(rateReading({ ...base(), turbidity: 8 }, copy).overall, 'Normal');
});
test('ST2-13 invalid or ambiguous threshold ordering fails closed at startup', () => {
  const copy = JSON.parse(JSON.stringify(params));
  copy.rule_rating.pH.risky_outer_min = 6.6;
  assert.throws(() => assertRatingParameters(copy), /nested/);
});
test('ST2-14 all classifications explicitly carry parameter-set version', () => {
  const out = classify({});
  assert.equal(out.parameter_set_version, params.parameter_set_version);
  assert.equal(out.provisional, true);
});
