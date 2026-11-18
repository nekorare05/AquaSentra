'use strict';
const mongoose = require('mongoose');
const { Schema } = mongoose;
const credential = {
  token_salt: { type: String, required: true },
  token_hash: { type: String, required: true, select: false }
};
const Device = mongoose.model('Device', new Schema({
  device_id: { type: String, required: true, unique: true },
  ...credential,
  is_active: { type: Boolean, default: true },
  last_seen_at: Date
}, { timestamps: true }));
const User = mongoose.model('User', new Schema({
  user_id: { type: String, required: true, unique: true },
  role: { type: String, enum: ['viewer', 'admin'], required: true },
  ...credential,
  is_active: { type: Boolean, default: true }
}, { timestamps: true }));
const SensorReadingSchema = new Schema({
  device_id: { type: String, required: true, index: true },
  measured_at: { type: Date, default: null },
  received_at: { type: Date, required: true },
  payload: { type: Schema.Types.Mixed, default: null },
  purpose: String,
  boot_flag: Boolean,
  validity: { is_valid: { type: Boolean, required: true }, codes: [String] },
  is_canonical: { type: Boolean, required: true },
  is_delayed: Boolean,
  eligible_for_live_decision: Boolean,
  rule_rating: { type: String, enum: ['Normal', 'Risky', 'Critical', null], default: null },
  rule_details: { type: Schema.Types.Mixed, default: null },
  rule_parameter_set_version: { type: String, default: null },
  model: { type: Schema.Types.Mixed, default: null },
  decision: { type: Schema.Types.Mixed, default: null },
  rated_at: { type: Date, default: null }
}, { timestamps: true });
SensorReadingSchema.index({ device_id: 1, measured_at: 1 }, {
  unique: true,
  partialFilterExpression: { is_canonical: true },
  name: 'unique_canonical_device_timestamp'
});
SensorReadingSchema.index({ device_id: 1, received_at: -1 });
const SensorReading = mongoose.model('SensorReading', SensorReadingSchema);
const AlertSchema = new Schema({
  reading_id: { type: Schema.Types.ObjectId, ref: 'SensorReading', unique: true, required: true },
  device_id: { type: String, required: true, index: true },
  kind: { type: String, enum: ['early_warning', 'critical', 'sensor_fault'], required: true },
  severity: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  rating: String,
  codes: [String],
  parameter_set_version: String,
  occurred_at: { type: Date, default: Date.now, index: true }
});
AlertSchema.index({ device_id: 1, occurred_at: -1 });
const Alert = mongoose.model('Alert', AlertSchema);
const SecurityEvent = mongoose.model('SecurityEvent', new Schema({
  event: { type: String, required: true },
  subject_id: String,
  route: String,
  occurred_at: { type: Date, default: Date.now }
}));
module.exports = { Device, User, SensorReading, Alert, SecurityEvent };
