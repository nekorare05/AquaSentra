'use strict';
const { validateReading } = require('./validation');

/** Repository contract: create(reading) -> persisted record. Unique partial index
 * protects canonical (device_id, measured_at) pairs against simultaneous requests. */
async function ingestReading({ payload, deviceId, repository, now = new Date(), params }) {
  const outcome = validateReading(payload, deviceId, now, params);
  const document = {
    device_id: deviceId,
    measured_at: outcome.measured_at,
    received_at: now,
    payload,
    purpose: payload && typeof payload === 'object' ? (payload.purpose || 'routine') : null,
    boot_flag: payload && typeof payload === 'object' && typeof payload.boot_flag === 'boolean' ? payload.boot_flag : null,
    validity: { is_valid: outcome.is_valid, codes: outcome.codes },
    is_canonical: Boolean(outcome.measured_at),
    is_delayed: outcome.is_delayed,
    eligible_for_live_decision: outcome.eligible_for_live_decision,
    rule_rating: null
  };
  try {
    const saved = await repository.create(document);
    return { saved, duplicate: false };
  } catch (error) {
    if (error.code !== 11000 || !document.is_canonical) throw error;
    // Duplicate must be stored invalid, even if the original was itself invalid.
    const saved = await repository.create({
      ...document,
      is_canonical: false,
      validity: { is_valid: false, codes: [...new Set([...outcome.codes, 'DUPLICATE_READING'])] },
      eligible_for_live_decision: false
    });
    return { saved, duplicate: true };
  }
}
module.exports = { ingestReading };
