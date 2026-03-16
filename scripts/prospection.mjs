#!/usr/bin/env node

/**
 * Prospection praticiens santé — Pipeline
 *
 * 1. Download RPPS data from data.gouv.fr
 * 2. Filter liberal health professionals (osteopaths first)
 * 3. Enrich with email from web search
 * 4. Deduplicate
 * 5. Generate/merge Excel file
 */

import { createReadStream, createWriteStream, existsSync, unlinkSync } from 'fs';
import { createInterface } from 'readline';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import path from 'path';

// ─── Config ───────────────────────────────────────────────────────────
const RPPS_URL = 'https://www.data.gouv.fr/fr/datasets/r/fffda7e9-0ea2-4c35-bba0-4496f3af935d';
const RPPS_FILE = path.resolve('data/rpps_activite.txt');
const OUTPUT_FILE = path.resolve('prospection.xlsx');
const DATA_DIR = path.resolve('data');

// Professions to target (code → label)
const TARGET_PROFESSIONS = {
  '71': 'Ostéopathe',
  '73': 'Chiropracteur',
  '93': 'Psychologue',
  '70': 'Masseur-Kinésithérapeute',
  '80': 'Pédicure-Podologue',
  '91': 'Orthophoniste',
  '94': 'Ergothérapeute',
  '95': 'Diététicien',
  '96': 'Psychomotricien',
};

// Column indices (0-based) from the pipe-delimited RPPS file
const COL = {
  NOM: 7,           // Nom d'exercice
  PRENOM: 8,        // Prenom d'exercice
  CODE_PROFESSION: 9,
  LIBELLE_PROFESSION: 10,
  MODE_EXERCICE: 17, // L = Libéral
  SIRET: 19,
  CODE_POSTAL: 35,
  VILLE: 37,
  TELEPHONE: 40,
  EMAIL: 43,
};

// ─── Helpers ──────────────────────────────────────────────────────────

function normalizeName(nom, prenom) {
  return `${nom} ${prenom}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

function isProEmail(email) {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  // Reject personal email domains
  const personalDomains = ['gmail.com', 'hotmail.com', 'hotmail.fr', 'outlook.com', 'outlook.fr',
    'yahoo.com', 'yahoo.fr', 'live.com', 'live.fr', 'orange.fr', 'wanadoo.fr',
    'free.fr', 'sfr.fr', 'laposte.net', 'icloud.com', 'me.com', 'aol.com',
    'msn.com', 'protonmail.com', 'proton.me', 'gmx.com', 'gmx.fr', 'bbox.fr',
    'numericable.fr', 'neuf.fr', 'noos.fr', 'club-internet.fr', 'cegetel.net',
    'aliceadsl.fr', 'voila.fr', 'mail.com'];
  const domain = lower.split('@')[1];
  if (!domain) return false;
  return !personalDomains.includes(domain);
}

// ─── Step 1: Download RPPS ───────────────────────────────────────────

async function downloadRPPS() {
  if (existsSync(RPPS_FILE)) {
    const stats = await import('fs').then(fs => fs.promises.stat(RPPS_FILE));
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours < 24) {
      console.log(`✓ RPPS file exists and is ${ageHours.toFixed(1)}h old — skipping download`);
      return;
    }
  }

  console.log('↓ Downloading RPPS data (~760 MB)...');
  await import('fs').then(fs => fs.promises.mkdir(DATA_DIR, { recursive: true }));

  const response = await fetch(RPPS_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  let downloadedBytes = 0;
  let lastPercent = -1;

  const fileStream = createWriteStream(RPPS_FILE);
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(value);
    downloadedBytes += value.length;
    if (totalBytes > 0) {
      const percent = Math.floor((downloadedBytes / totalBytes) * 100);
      if (percent !== lastPercent && percent % 10 === 0) {
        console.log(`  ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(0)} MB)`);
        lastPercent = percent;
      }
    }
  }

  fileStream.end();
  await new Promise(resolve => fileStream.on('finish', resolve));
  console.log(`✓ Downloaded ${(downloadedBytes / 1024 / 1024).toFixed(0)} MB`);
}

// ─── Step 2: Filter & Extract ────────────────────────────────────────

async function filterRPPS() {
  console.log('\n⚙ Filtering RPPS for liberal health professionals...');

  const seen = new Map(); // normalizedName → entry
  let totalLines = 0;
  let matchedLines = 0;

  const rl = createInterface({
    input: createReadStream(RPPS_FILE, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    totalLines++;

    const cols = line.split('|');
    const codeProfession = cols[COL.CODE_PROFESSION]?.trim();
    const modeExercice = cols[COL.MODE_EXERCICE]?.trim();

    // Filter: target profession + liberal practice
    if (!TARGET_PROFESSIONS[codeProfession]) continue;
    if (modeExercice !== 'L') continue;

    matchedLines++;

    const nom = cols[COL.NOM]?.trim() || '';
    const prenom = cols[COL.PRENOM]?.trim() || '';
    const email = cols[COL.EMAIL]?.trim() || '';
    const telephone = cols[COL.TELEPHONE]?.trim() || '';
    const ville = cols[COL.VILLE]?.trim() || '';
    const codePostal = cols[COL.CODE_POSTAL]?.trim() || '';
    const profession = TARGET_PROFESSIONS[codeProfession] || cols[COL.LIBELLE_PROFESSION]?.trim() || '';

    const key = normalizeName(nom, prenom);
    if (!key) continue;

    // Deduplicate: keep the entry with the most info
    const existing = seen.get(key);
    if (existing) {
      // Merge: prefer entry with email, then with phone
      if (!existing.email && email) existing.email = email;
      if (!existing.telephone && telephone) existing.telephone = telephone;
      if (!existing.ville && ville) existing.ville = ville;
      continue;
    }

    seen.set(key, {
      profession,
      nom: `${nom} ${prenom}`.trim(),
      email: email || null,
      telephone: telephone || null,
      ville,
      codePostal,
    });
  }

  console.log(`  Scanned ${totalLines.toLocaleString()} lines`);
  console.log(`  Matched ${matchedLines.toLocaleString()} liberal practitioners`);
  console.log(`  Unique persons: ${seen.size.toLocaleString()}`);

  return [...seen.values()];
}

// ─── Step 3: Enrich with web search ──────────────────────────────────

async function searchEmailForPractitioner(entry) {
  const searchQuery = `${entry.profession} ${entry.nom} ${entry.ville} cabinet email`;

  try {
    // Use Google Custom Search or a simple search
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=5`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) return null;
    const html = await response.text();

    // Extract emails from search results
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = html.match(emailRegex) || [];

    for (const email of foundEmails) {
      if (isProEmail(email)) {
        return email.toLowerCase();
      }
    }
  } catch {
    // Silent fail — enrichment is best-effort
  }

  return null;
}

async function enrichEmails(entries) {
  const withoutEmail = entries.filter(e => !e.email || !isProEmail(e.email));
  const withEmail = entries.filter(e => e.email && isProEmail(e.email));

  console.log(`\n📧 Email enrichment:`);
  console.log(`  Already have pro email: ${withEmail.length}`);
  console.log(`  Need enrichment: ${withoutEmail.length}`);

  // Enrich in batches to avoid rate limiting
  const BATCH_SIZE = 5;
  const DELAY_MS = 2000;
  let enriched = 0;
  let attempted = 0;

  // Limit enrichment to first 500 to avoid abuse — can be raised
  const toEnrich = withoutEmail.slice(0, 500);

  for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
    const batch = toEnrich.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(entry => searchEmailForPractitioner(entry)));

    for (let j = 0; j < batch.length; j++) {
      attempted++;
      if (results[j]) {
        batch[j].email = results[j];
        enriched++;
      }
    }

    if (attempted % 50 === 0) {
      console.log(`  Progress: ${attempted}/${toEnrich.length} — found ${enriched} emails`);
    }

    if (i + BATCH_SIZE < toEnrich.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`  Enrichment done: found ${enriched} new emails out of ${attempted} searched`);
  return entries;
}

// ─── Step 4: Generate / Merge Excel ──────────────────────────────────

async function generateExcel(entries) {
  console.log(`\n📊 Generating Excel...`);

  // Load existing file if present (to preserve "envoyé" status)
  const existingStatuses = new Map();
  if (existsSync(OUTPUT_FILE)) {
    console.log('  Found existing file — merging...');
    const existing = new ExcelJS.Workbook();
    await existing.xlsx.readFile(OUTPUT_FILE);
    const ws = existing.getWorksheet(1);
    if (ws) {
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // skip header
        const nom = row.getCell(2).value?.toString()?.trim() || '';
        const email = row.getCell(3).value?.toString()?.trim() || '';
        const status = row.getCell(4).value?.toString()?.trim() || 'non';
        // Key by normalized name
        const key = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
        existingStatuses.set(key, status);
        if (email) existingStatuses.set(email.toLowerCase(), status);
      });
    }
    console.log(`  Loaded ${existingStatuses.size} existing entries`);
  }

  // Filter: only keep entries with pro email
  const withProEmail = entries.filter(e => e.email && isProEmail(e.email));

  // Deduplicate by email
  const emailSeen = new Set();
  const deduplicated = [];
  for (const entry of withProEmail) {
    const emailKey = entry.email.toLowerCase();
    if (emailSeen.has(emailKey)) continue;
    emailSeen.add(emailKey);
    deduplicated.push(entry);
  }

  console.log(`  With pro email: ${withProEmail.length}`);
  console.log(`  After email dedup: ${deduplicated.length}`);

  // Sort: osteopaths first, then by profession, then by name
  const professionOrder = ['Ostéopathe', 'Chiropracteur', 'Psychologue', 'Masseur-Kinésithérapeute',
    'Pédicure-Podologue', 'Orthophoniste', 'Ergothérapeute', 'Diététicien', 'Psychomotricien'];

  deduplicated.sort((a, b) => {
    const orderA = professionOrder.indexOf(a.profession);
    const orderB = professionOrder.indexOf(b.profession);
    if (orderA !== orderB) return orderA - orderB;
    return a.nom.localeCompare(b.nom, 'fr');
  });

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Prospection');

  // Header
  ws.columns = [
    { header: 'Profession', key: 'profession', width: 28 },
    { header: 'Nom', key: 'nom', width: 30 },
    { header: 'Email', key: 'email', width: 40 },
    { header: 'Envoyé', key: 'envoye', width: 12 },
  ];

  // Style header
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Add rows
  for (const entry of deduplicated) {
    const nameKey = entry.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
    const emailKey = entry.email.toLowerCase();
    // Preserve existing "envoyé" status
    const status = existingStatuses.get(nameKey) || existingStatuses.get(emailKey) || 'non';

    ws.addRow({
      profession: entry.profession,
      nom: entry.nom,
      email: entry.email,
      envoye: status,
    });
  }

  // Auto-filter
  ws.autoFilter = { from: 'A1', to: 'D1' };

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  await workbook.xlsx.writeFile(OUTPUT_FILE);
  console.log(`\n✓ Excel generated: ${OUTPUT_FILE}`);
  console.log(`  Total rows: ${deduplicated.length}`);

  // Stats by profession
  const byProfession = {};
  for (const e of deduplicated) {
    byProfession[e.profession] = (byProfession[e.profession] || 0) + 1;
  }
  console.log('\n  Breakdown:');
  for (const [prof, count] of Object.entries(byProfession).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${prof}: ${count}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🏥 Prospection praticiens santé\n');

  // Step 1: Download
  await downloadRPPS();

  // Step 2: Filter
  const entries = await filterRPPS();

  // Step 3: Enrich emails (optional — can be slow)
  const skipEnrich = process.argv.includes('--skip-enrich');
  if (!skipEnrich) {
    await enrichEmails(entries);
  } else {
    console.log('\n⏭ Skipping email enrichment (--skip-enrich)');
  }

  // Step 4: Generate Excel
  await generateExcel(entries);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
