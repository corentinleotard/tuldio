#!/usr/bin/env node

/**
 * Generate a test invite token for local testing.
 *
 * Usage:
 *   node scripts/generate-invite-token.mjs
 *   node scripts/generate-invite-token.mjs --name "Plomberie Leblanc" --profession "Plombier" --firstName "Marc"
 *
 * Output: the full invite URL to open in a browser.
 */

import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Load .env
const envPath = path.resolve('.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const SECRET = process.env.INVITE_JWT_SECRET || 'dev-invite-secret-change-in-production';
const APP_URL = process.env.VITE_API_URL?.replace(':3003', ':5174') || 'http://localhost:5174';

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const payload = {
  name: getArg('name') || "Cabinet d'Ostéopathie Durand",
  address: getArg('address') || '12 rue du Dr Finlay, 75015 Paris',
  phone: getArg('phone') || '01 45 67 89 10',
  website: getArg('website') || 'osteo-paris15.fr',
  profession: getArg('profession') || 'Ostéopathe',
  firstName: getArg('firstName') || 'Claire',
};

const header = { alg: 'HS256', typ: 'JWT' };
const fullPayload = {
  ...payload,
  exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
};

const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
const signature = crypto
  .createHmac('sha256', SECRET)
  .update(`${headerB64}.${payloadB64}`)
  .digest('base64url');

const token = `${headerB64}.${payloadB64}.${signature}`;
const url = `${APP_URL}/invite/${token}`;

console.log('\n--- Invite Token Generated ---');
console.log(`Name:       ${payload.name}`);
console.log(`Profession: ${payload.profession}`);
console.log(`FirstName:  ${payload.firstName}`);
console.log(`Address:    ${payload.address}`);
console.log(`Phone:      ${payload.phone}`);
console.log(`Website:    ${payload.website}`);
console.log(`Expires:    30 days`);
console.log(`\nURL:\n${url}\n`);
