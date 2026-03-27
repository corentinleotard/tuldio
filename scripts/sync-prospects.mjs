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
  'linkedin_url',
];

// Columns owned by prod (sending state)
const SEND_COLS = [
  'status', 'sent_at', 'sent_subject', 'sent_body_html', 'contacted_via',
];

/** Build a unique key for a prospect: email if available, otherwise linkedin_url */
function prospectKey(row) {
  if (row.email) return `email:${row.email.toLowerCase()}`;
  if (row.linkedin_url) return `li:${row.linkedin_url}`;
  return null;
}

async function run() {
  console.log('Syncing prospects between dev and prod...\n');

  // ─── Step 1: Read all prospects from both DBs ─────────────────────
  const allCols = [...DATA_COLS, ...SEND_COLS, 'created_at'].join(', ');

  const { rows: devRows } = await devPool.query(`SELECT ${allCols} FROM god_prospects`);
  const { rows: prodRows } = await prodPool.query(`SELECT ${allCols} FROM god_prospects`);

  const devByKey = new Map();
  for (const r of devRows) { const k = prospectKey(r); if (k) devByKey.set(k, r); }
  const prodByKey = new Map();
  for (const r of prodRows) { const k = prospectKey(r); if (k) prodByKey.set(k, r); }

  let pushCount = 0;
  let updateProdCount = 0;
  let pullCount = 0;

  // ─── Step 2: Dev → Prod (push new prospects + update data cols) ───
  for (const [key, dev] of devByKey) {
    const prod = prodByKey.get(key);

    if (!prod) {
      // New prospect — insert into prod
      await prodPool.query(
        `INSERT INTO god_prospects (${DATA_COLS.join(', ')}, status, contacted_via, sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT DO NOTHING`,
        [
          dev.profession, dev.first_name, dev.full_name, dev.email, dev.phone,
          dev.source, dev.scraped, dev.icp_score, dev.icp_reason, dev.website, dev.page_text,
          dev.linkedin_url,
          dev.status, dev.contacted_via, dev.sent_at, dev.created_at,
        ],
      );
      pushCount++;
    } else {
      // Exists in both — update prod's data columns with dev values (keep prod's sending state)
      const changed = DATA_COLS.some(col => String(dev[col] ?? '') !== String(prod[col] ?? ''));
      if (changed) {
        // Build WHERE clause based on which key we matched on
        const isEmail = key.startsWith('email:');
        const whereClause = isEmail ? 'lower(email) = lower($13)' : 'linkedin_url = $13';
        const whereVal = isEmail ? dev.email : dev.linkedin_url;

        await prodPool.query(
          `UPDATE god_prospects SET
             profession = $1, first_name = $2, full_name = $3, phone = $4,
             source = $5, scraped = $6, icp_score = $7, icp_reason = $8,
             website = $9, page_text = $10, linkedin_url = $11, email = $12,
             updated_at = now()
           WHERE ${whereClause}`,
          [
            dev.profession, dev.first_name, dev.full_name, dev.phone,
            dev.source, dev.scraped, dev.icp_score, dev.icp_reason,
            dev.website, dev.page_text, dev.linkedin_url, dev.email,
            whereVal,
          ],
        );
        updateProdCount++;
      }
    }
  }

  // ─── Step 3: Prod → Dev (pull back sending state) ─────────────────
  for (const [key, prod] of prodByKey) {
    const dev = devByKey.get(key);
    if (!dev) continue;

    const prodSent = prod.status === 'sent' || prod.status === 'error';
    const devStillNew = dev.status === 'new';

    if (prodSent && devStillNew) {
      const isEmail = key.startsWith('email:');
      const whereClause = isEmail ? 'lower(email) = lower($6)' : 'linkedin_url = $6';
      const whereVal = isEmail ? prod.email : prod.linkedin_url;

      await devPool.query(
        `UPDATE god_prospects SET
           status = $1, sent_at = $2, sent_subject = $3,
           sent_body_html = $4, contacted_via = $5, updated_at = now()
         WHERE ${whereClause}`,
        [prod.status, prod.sent_at, prod.sent_subject, prod.sent_body_html, prod.contacted_via, whereVal],
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
