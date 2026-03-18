#!/usr/bin/env node

/**
 * Bidirectional sync of god_prospects between dev and prod databases.
 *
 * Dev = source of truth for prospect DATA (name, phone, website, ICP, profession)
 * Prod = source of truth for SENDING STATE (status, sent_at, sent_subject, sent_body_html)
 *
 * What it does:
 *   1. Dev → Prod: push new/updated prospects (never overwrite prod sending state)
 *   2. Prod → Dev: pull back sending status (sent, error) so dev UI is accurate
 *
 * Requires DATABASE_URL (dev) and DATABASE_URL_PROD in .env
 *
 * Usage:
 *   node scripts/sync-prospects.mjs
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import pg from 'pg';

// ─── Load .env ────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve('.env');
  if (!existsSync(envPath)) return;
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
loadEnv();

const DEV_URL = process.env.DATABASE_URL;
const PROD_URL = process.env.DATABASE_URL_PROD;

if (!DEV_URL) { console.error('Missing DATABASE_URL in .env'); process.exit(1); }
if (!PROD_URL) { console.error('Missing DATABASE_URL_PROD in .env'); process.exit(1); }

const devPool = new pg.Pool({ connectionString: DEV_URL });
const prodPool = new pg.Pool({ connectionString: PROD_URL });

// Columns owned by dev (prospect data)
const DATA_COLS = [
  'profession', 'first_name', 'full_name', 'email', 'phone',
  'source', 'scraped', 'icp_score', 'icp_reason', 'website', 'page_text',
];

// Columns owned by prod (sending state)
const SEND_COLS = [
  'status', 'sent_at', 'sent_subject', 'sent_body_html', 'contacted_via',
];

async function run() {
  console.log('Syncing prospects between dev and prod...\n');

  // ─── Step 1: Read all prospects from both DBs ─────────────────────
  const allCols = [...DATA_COLS, ...SEND_COLS, 'created_at'].join(', ');

  const { rows: devRows } = await devPool.query(`SELECT ${allCols} FROM god_prospects`);
  const { rows: prodRows } = await prodPool.query(`SELECT ${allCols} FROM god_prospects`);

  const devByEmail = new Map(devRows.map(r => [r.email.toLowerCase(), r]));
  const prodByEmail = new Map(prodRows.map(r => [r.email.toLowerCase(), r]));

  let pushCount = 0;
  let updateProdCount = 0;
  let pullCount = 0;

  // ─── Step 2: Dev → Prod (push new prospects + update data cols) ───
  for (const [email, dev] of devByEmail) {
    const prod = prodByEmail.get(email);

    if (!prod) {
      // New prospect — insert into prod with dev data + dev status
      await prodPool.query(
        `INSERT INTO god_prospects (${DATA_COLS.join(', ')}, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (email) DO NOTHING`,
        [
          dev.profession, dev.first_name, dev.full_name, dev.email, dev.phone,
          dev.source, dev.scraped, dev.icp_score, dev.icp_reason, dev.website, dev.page_text,
          'new', dev.created_at,
        ],
      );
      pushCount++;
    } else {
      // Exists in both — update prod's data columns with dev values (keep prod's sending state)
      const changed = DATA_COLS.some(col => String(dev[col] ?? '') !== String(prod[col] ?? ''));
      if (changed) {
        await prodPool.query(
          `UPDATE god_prospects SET
             profession = $1, first_name = $2, full_name = $3, phone = $4,
             source = $5, scraped = $6, icp_score = $7, icp_reason = $8,
             website = $9, page_text = $10, updated_at = now()
           WHERE lower(email) = lower($11)`,
          [
            dev.profession, dev.first_name, dev.full_name, dev.phone,
            dev.source, dev.scraped, dev.icp_score, dev.icp_reason,
            dev.website, dev.page_text, dev.email,
          ],
        );
        updateProdCount++;
      }
    }
  }

  // ─── Step 3: Prod → Dev (pull back sending state) ─────────────────
  for (const [email, prod] of prodByEmail) {
    const dev = devByEmail.get(email);
    if (!dev) continue; // Prospect only in prod (shouldn't happen, but skip)

    // Only pull if prod has a more advanced status
    const prodSent = prod.status === 'sent' || prod.status === 'error';
    const devStillNew = dev.status === 'new';

    if (prodSent && devStillNew) {
      await devPool.query(
        `UPDATE god_prospects SET
           status = $1, sent_at = $2, sent_subject = $3,
           sent_body_html = $4, contacted_via = $5, updated_at = now()
         WHERE lower(email) = lower($6)`,
        [prod.status, prod.sent_at, prod.sent_subject, prod.sent_body_html, prod.contacted_via, prod.email],
      );
      pullCount++;
    }
  }

  console.log(`Dev → Prod: ${pushCount} new prospects pushed`);
  console.log(`Dev → Prod: ${updateProdCount} prospects updated (data cols)`);
  console.log(`Prod → Dev: ${pullCount} sending statuses pulled back`);
  console.log(`\nTotal: dev=${devRows.length}, prod=${prodRows.length}`);

  await devPool.end();
  await prodPool.end();
}

run().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
