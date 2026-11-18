'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { Device, User } = require('../src/models');
const { makeCredentialHash } = require('../src/services/credentials');
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI');
  const seeds = [
    { model: Device, idKey: 'device_id', id: process.env.BOOTSTRAP_DEVICE_ID, token: process.env.BOOTSTRAP_DEVICE_TOKEN },
    { model: User, idKey: 'user_id', id: process.env.BOOTSTRAP_ADMIN_ID, token: process.env.BOOTSTRAP_ADMIN_TOKEN, role: 'admin' },
    { model: User, idKey: 'user_id', id: process.env.BOOTSTRAP_VIEWER_ID, token: process.env.BOOTSTRAP_VIEWER_TOKEN, role: 'viewer' }
  ];
  for (const s of seeds) {
    if (!s.id || !s.token || s.token.startsWith('REPLACE_')) throw new Error(`Set a strong actual token and ID for ${s.idKey} in .env`);
    if (s.token.length < 20) throw new Error(`${s.idKey} token must be >= 20 characters`);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  for (const s of seeds) {
    await s.model.updateOne({ [s.idKey]: s.id }, {
      $set: { ...makeCredentialHash(s.token), is_active: true, ...(s.role && { role: s.role }) }
    }, { upsert: true });
    console.log(`Upserted ${s.role || 'device'}: ${s.id} (secret not displayed)`);
  }
  await mongoose.disconnect();
}
main().catch((error) => { console.error(error.message); process.exit(1); });
