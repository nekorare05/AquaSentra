'use strict';
/** One-time, idempotent migration: rate existing valid Stage 1 records. Never emit retrospective alerts. */
require('dotenv').config();
const mongoose = require('mongoose');
const { SensorReading } = require('../src/models');
const params = require('../config/parameters.json');
const { assertRatingParameters, rateReading } = require('../src/services/rating');
async function main() {
  assertRatingParameters(params);
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const cursor = SensorReading.find({ 'validity.is_valid': true, rule_rating: null }).cursor();
    let processed = 0;
    for await (const r of cursor) {
      const value = rateReading(r.payload, params);
      await SensorReading.updateOne({ _id: r._id, rule_rating: null }, { $set: {
        rule_rating: value.overall,
        rule_details: { individual: value.individual, temperature_operational_note: value.temperature_operational_note },
        rule_parameter_set_version: value.parameter_set_version, rated_at: new Date()
      }});
      processed++;
    }
    console.log(`Backfilled ${processed} previously valid readings; zero historical live alerts generated.`);
    console.log('Existing invalid records remain unrated. Existing record timestamps and IDs are preserved.');
  } finally { await mongoose.disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
