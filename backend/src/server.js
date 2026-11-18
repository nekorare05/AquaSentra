'use strict';
require('dotenv').config();
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { SensorReading, Alert } = require('./models');
const { createApp } = require('./app');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set in .env');
  const certPath = path.resolve(__dirname, '..', process.env.TLS_CERT_PATH || 'certs/dev-cert.pem');
  const keyPath = path.resolve(__dirname, '..', process.env.TLS_KEY_PATH || 'certs/dev-key.pem');
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) throw new Error('TLS certificate or key missing. Run npm run dev:cert for LOCAL development only.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  // Ensure unique partial index is ready before any ingest request is accepted.
  await SensorReading.init();
  await Alert.init();
  require('./services/pipeline').startTicker();
  const server = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, createApp());
  server.listen(Number(process.env.PORT || 8443), process.env.HOST || '127.0.0.1', () => {
    console.log(`AquaSentra Stage 7 HTTPS API on https://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 8443}`);
  });
  async function stop() { server.close(); await mongoose.disconnect(); process.exit(0); }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
main().catch((error) => { console.error(error); process.exit(1); });
