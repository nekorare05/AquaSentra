'use strict';
const crypto = require('node:crypto');
function makeCredentialHash(token) {
  if (typeof token !== 'string' || token.length < 20) throw new Error('Token must be at least 20 characters');
  const salt = crypto.randomBytes(16).toString('hex');
  return { token_salt: salt, token_hash: crypto.scryptSync(token, salt, 64).toString('hex') };
}
function verifyCredential(token, stored) {
  if (!stored || typeof token !== 'string' || !token) return false;
  if (!stored.token_salt || !stored.token_hash) return false;
  try {
    const candidate = crypto.scryptSync(token, stored.token_salt, 64);
    const expected = Buffer.from(stored.token_hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch (_) { return false; }
}
module.exports = { makeCredentialHash, verifyCredential };
