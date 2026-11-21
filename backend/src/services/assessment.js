'use strict';
const { rateReading } = require('./rating');

/** Stage 2 starts AFTER Stage 1 has stored the record. No inference, counters or valve commands. */
async function assessStoredReading({ saved, readings, alerts, params }) {
  if (saved.validity?.is_valid) {
    const rating = rateReading(saved.payload, params);
    await readings.updateOne({ _id: saved._id }, { $set: {
      rule_rating: rating.overall,
      rule_details: {
        individual: rating.individual,
        temperature_operational_note: rating.temperature_operational_note
      },
      rule_parameter_set_version: rating.parameter_set_version,
      rated_at: new Date()
    } });
    saved.rule_rating = rating.overall;
    saved.rule_details = { individual: rating.individual, temperature_operational_note: rating.temperature_operational_note };
    saved.rule_parameter_set_version = rating.parameter_set_version;
    // Historical backfills are rated for research review but never generate a NEW live alert.
    if (saved.eligible_for_live_decision && rating.overall !== 'Normal') {
      const critical = rating.overall === 'Critical';
      await alerts.updateOne({ reading_id: saved._id }, { $setOnInsert: {
        reading_id: saved._id, device_id: saved.device_id,
        kind: critical ? 'critical' : 'early_warning', severity: rating.overall,
        title: critical ? 'Critical reference-range alert' : 'Early warning: outside Normal reference',
        message: 'Provisional study-defined rating; validate sensor calibration and consult laboratory testing. No valve action is taken by this alert; this rating alert alone does not authorize isolation; consult the separate control journal.',
        rating: rating.overall, parameter_set_version: params.parameter_set_version,
        occurred_at: new Date()
      } }, { upsert: true });
    }
    return { rated: true, rating };
  }
  const codes = saved.validity?.codes || [];
  if (codes.some(code => code !== 'DUPLICATE_READING')) {
    await alerts.updateOne({ reading_id: saved._id }, { $setOnInsert: {
      reading_id: saved._id, device_id: saved.device_id,
      kind: 'sensor_fault', severity: 'Fault', title: 'Sensor or record validation notice',
      message: 'Flagged invalid reading excluded from rating and automated decisions.',
      codes, parameter_set_version: params.parameter_set_version, occurred_at: new Date()
    } }, { upsert: true });
  }
  return { rated: false };
}
module.exports = { assessStoredReading };
