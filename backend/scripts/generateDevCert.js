'use strict';
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'certs');
const key = path.join(out, 'dev-key.pem');
const cert = path.join(out, 'dev-cert.pem');
fs.mkdirSync(out, { recursive: true });
if (fs.existsSync(key) || fs.existsSync(cert)) {
  console.log('Certificate/key already exist; not overwriting.');
  process.exit(0);
}
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-keyout', key,
    '-out', cert, '-days', '30', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  fs.chmodSync(key, 0o600);
  console.log('Generated LOCAL development-only HTTPS certificate (30 days). Never deploy it.');
} catch (error) {
  throw new Error('OpenSSL is needed in PATH. Install OpenSSL (or use Docker) and rerun npm run dev:cert.');
}
