'use strict';

const SEVERITY = Object.freeze({ Normal: 0, Risky: 1, Critical: 2 });
function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid provisional rating threshold: ${label}`);
}

/** Refuse ambiguous, inverted or overlapping bands on backend startup. */
function assertRatingParameters(params) {
  const r = params.rule_rating;
  if (!r || !r.provisional) throw new Error('Stage 2 requires the explicitly provisional rule_rating configuration');
  for (const [key, fields] of Object.entries({
    pH: ['normal_min', 'normal_max', 'risky_outer_min', 'risky_outer_max'],
    turbidity: ['normal_max', 'risky_max'],
    TDS: ['normal_max', 'risky_max'],
    temperature_operational_reference: ['min', 'max']
  })) for (const field of fields) finite(r[key]?.[field], `${key}.${field}`);
  const p = r.pH;
  if (!(p.risky_outer_min < p.normal_min && p.normal_min < p.normal_max && p.normal_max < p.risky_outer_max)) {
    throw new Error('pH thresholds must be strictly nested: Risky outer bounds around Normal');
  }
  for (const field of ['turbidity', 'TDS']) {
    const band = r[field];
    if (band.normal_max < 0 || band.risky_max <= band.normal_max) throw new Error(`Invalid ${field} threshold order`);
  }
  if (r.temperature_operational_reference.min >= r.temperature_operational_reference.max) throw new Error('Invalid operational temperature range');
}

/** Call ONLY for a previously validated reading. Temperature is operational, not a rating factor. */
function rateReading(payload, params) {
  assertRatingParameters(params);
  const p = params.rule_rating;
  for (const field of ['pH', 'turbidity', 'TDS', 'temperature_c']) {
    if (typeof payload?.[field] !== 'number' || !Number.isFinite(payload[field])) throw new TypeError(`Cannot rate invalid ${field}`);
  }
  let ph = 'Critical';
  if (payload.pH >= p.pH.normal_min && payload.pH <= p.pH.normal_max) ph = 'Normal';
  else if (payload.pH >= p.pH.risky_outer_min && payload.pH <= p.pH.risky_outer_max) ph = 'Risky';
  const upperBoundRating = (x, band) => x <= band.normal_max ? 'Normal' : x <= band.risky_max ? 'Risky' : 'Critical';
  const individual = {
    pH: ph,
    turbidity: upperBoundRating(payload.turbidity, p.turbidity),
    TDS: upperBoundRating(payload.TDS, p.TDS)
  };
  const overall = Object.values(individual).reduce((worst, item) => SEVERITY[item] > SEVERITY[worst] ? item : worst, 'Normal');
  const temp = p.temperature_operational_reference;
  const temperature_operational_note = payload.temperature_c < temp.min || payload.temperature_c > temp.max
    ? 'Outside provisional operational temperature reference (does not affect rule rating)'
    : 'Within provisional operational temperature reference (does not affect rule rating)';
  return {
    overall,
    individual,
    temperature_operational_note,
    parameter_set_version: params.parameter_set_version,
    provisional: true
  };
}
module.exports = { SEVERITY, assertRatingParameters, rateReading };
