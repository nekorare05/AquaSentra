'use strict';
const { Device, User, SecurityEvent } = require('../models');
const { verifyCredential } = require('../services/credentials');

async function logDenial(event, id, req) {
  const details = { event, subject_id: (id || 'unknown').slice(0, 80), route: req.path };
  console.warn('[security]', JSON.stringify(details));
  try { await SecurityEvent.create(details); } catch (err) { console.warn('[security-log-unavailable]', err.message); }
}

async function deviceAuth(req, res, next) {
  try {
    const id = req.get('x-device-id'), token = req.get('x-device-token');
    const d = id && await Device.findOne({ device_id: id, is_active: true }).select('+token_hash');
    if (!d || !verifyCredential(token, d)) {
      await logDenial('DEVICE_UNAUTHORIZED', id, req);
      return res.status(401).json({ error: 'unauthorized_device' });
    }
    req.auth = { deviceId: d.device_id };
    next();
  } catch (err) { next(err); }
}

function userAuth(allowedRoles) {
  return async (req, res, next) => {
    try {
      const id = req.get('x-user-id'), token = req.get('x-user-token');
      const u = id && await User.findOne({ user_id: id, is_active: true }).select('+token_hash');
      if (!u || !verifyCredential(token, u)) {
        await logDenial('USER_UNAUTHORIZED', id, req);
        return res.status(401).json({ error: 'unauthorized_user' });
      }
      if (!allowedRoles.includes(u.role)) {
        await logDenial('USER_FORBIDDEN', id, req);
        return res.status(403).json({ error: 'forbidden' });
      }
      req.auth = { userId: u.user_id, role: u.role };
      next();
    } catch (err) { next(err); }
  };
}
module.exports = { deviceAuth, userAuth };
