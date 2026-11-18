'use strict';

const paramsDefault = require('../../config/parameters.json');
const schema = require('../../config/reading.schema.json');
const HAS = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const NUMERIC_FIELDS = ['pH', 'turbidity', 'TDS', 'temperature_c'];
const STATUS_FIELDS = ['ph', 'turbidity', 'tds', 'temperature', 'clock'];
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;

// Strict ISO-8601 date-time with explicit timezone; rejects impossible dates.
function parseIsoTime(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!m) return null;
  const [, yy, mo, dd, hh, mm, ss, fraction, zone, sign, tzHour, tzMin] = m;
  const y = +yy, month = +mo, day = +dd, hour = +hh, minute = +mm, second = +ss;
  const zoneH = zone === 'Z' ? 0 : +tzHour, zoneM = zone === 'Z' ? 0 : +tzMin;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59 || zoneH > 14 || zoneM > 59 || (zoneH === 14 && zoneM !== 0)) return null;
  const local = Date.UTC(y, month - 1, day, hour, minute, second, +(fraction || '0').padEnd(3, '0'));
  const check = new Date(local);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  const offset = zone === 'Z' ? 0 : (sign === '+' ? 1 : -1) * (zoneH * 60 + zoneM);
  const actual = new Date(local - offset * 60000);
  return Number.isNaN(actual.getTime()) ? null : actual;
}

function schemaErrors(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['RECORD_NOT_OBJECT'];
  for (const key of schema.required) {
    if (!HAS(record, key)) errors.push(`MISSING_${key}`);
  }
  for (const key of Object.keys(record)) if (!HAS(schema.properties, key)) errors.push(`UNKNOWN_FIELD_${key}`);
  if (HAS(record, 'device_id') && (typeof record.device_id !== 'string' || !ID_RE.test(record.device_id))) errors.push('BAD_DEVICE_ID');
  if (HAS(record, 'measured_at') && !parseIsoTime(record.measured_at)) errors.push('BAD_MEASURED_AT');
  for (const f of NUMERIC_FIELDS) if (HAS(record, f) && (typeof record[f] !== 'number' || !Number.isFinite(record[f]))) errors.push(`BAD_TYPE_${f}`);
  if (HAS(record, 'turbidity_unit') && record.turbidity_unit !== 'NTU') errors.push('BAD_TURBIDITY_UNIT');
  if (HAS(record, 'tds_unit') && record.tds_unit !== 'mg/L') errors.push('BAD_TDS_UNIT');
  if (HAS(record, 'boot_flag') && typeof record.boot_flag !== 'boolean') errors.push('BAD_BOOT_FLAG');
  if (HAS(record, 'purpose') && !['routine', 'repeat_confirmation'].includes(record.purpose)) errors.push('BAD_PURPOSE');
  if (HAS(record, 'sensor_status')) {
    const status = record.sensor_status;
    if (!status || typeof status !== 'object' || Array.isArray(status)) errors.push('BAD_SENSOR_STATUS');
    else {
      for (const f of STATUS_FIELDS) if (!HAS(status, f)) errors.push(`MISSING_STATUS_${f}`);
      for (const f of Object.keys(status)) if (!STATUS_FIELDS.includes(f)) errors.push(`UNKNOWN_STATUS_${f}`);
      for (const f of STATUS_FIELDS) {
        if (!HAS(status, f)) continue;
        const accepted = f === 'clock' ? ['synced', 'unsynced'] : ['ok', 'fault', 'stuck', 'missing'];
        if (!accepted.includes(status[f])) errors.push(`BAD_STATUS_${f}`);
      }
    }
  }
  return errors;
}

function validateReading(payload, authenticatedDeviceId, receivedAt = new Date(), params = paramsDefault) {
  const errors = schemaErrors(payload);
  const record = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  if (record.device_id !== authenticatedDeviceId) errors.push('DEVICE_ID_MISMATCH');
  for (const f of NUMERIC_FIELDS) {
    const v = record[f], range = params.sensor_plausible_ranges[f];
    if (typeof v === 'number' && Number.isFinite(v) && (v < range.min || v > range.max)) errors.push(`OUT_OF_RANGE_${f}`);
  }
  const status = record.sensor_status;
  if (status && typeof status === 'object' && !Array.isArray(status)) {
    for (const f of ['ph', 'turbidity', 'tds', 'temperature']) {
      if (HAS(status, f) && status[f] !== 'ok') errors.push(`SENSOR_FAULT_${f}`);
    }
    if (status.clock === 'unsynced') errors.push('CLOCK_UNSYNCED');
  }
  const measuredAt = parseIsoTime(record.measured_at);
  let isDelayed = false, withinTimestampTolerance = false;
  if (measuredAt) {
    const ageSeconds = (receivedAt.getTime() - measuredAt.getTime()) / 1000;
    const tolerance = params.timestamp_tolerance_seconds;
    withinTimestampTolerance = Math.abs(ageSeconds) <= tolerance;
    if (ageSeconds > tolerance) {
      if (ageSeconds <= params.max_delayed_record_age_seconds) isDelayed = true;
      else errors.push('TIMESTAMP_TOO_OLD');
    }
    if (ageSeconds < -tolerance) errors.push('TIMESTAMP_IN_FUTURE');
  }
  return {
    is_valid: errors.length === 0,
    codes: [...new Set(errors)],
    measured_at: measuredAt,
    is_delayed: isDelayed,
    within_timestamp_tolerance: withinTimestampTolerance,
    // Backfills outside tolerance can be stored but never trigger live decisions.
    eligible_for_live_decision: errors.length === 0 && withinTimestampTolerance
  };
}

module.exports = { parseIsoTime, schemaErrors, validateReading };
