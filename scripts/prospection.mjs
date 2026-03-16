#!/usr/bin/env node

/**
 * Prospection praticiens santé — Pipeline
 *
 * Sources:
 *   1. RPPS (data.gouv.fr) — main source, ~2600 pro emails
 *   2. SFDO directory — osteopath union, ~50 extra emails
 *   3. DDG + Playwright — scrape practitioner websites, 100/day
 *
 * Usage:
 *   node scripts/prospection.mjs                  # Full pipeline (RPPS + SFDO + 100 web scrapes)
 *   node scripts/prospection.mjs --skip-enrich    # RPPS only, no enrichment
 *   node scripts/prospection.mjs --enrich-only    # Skip RPPS download, just enrich existing data
 */

import { createReadStream, createWriteStream, existsSync } from 'fs';
import { mkdir, stat } from 'fs/promises';
import { createInterface } from 'readline';
import ExcelJS from 'exceljs';
import path from 'path';

// ─── Config ───────────────────────────────────────────────────────────
const RPPS_URL = 'https://www.data.gouv.fr/fr/datasets/r/fffda7e9-0ea2-4c35-bba0-4496f3af935d';
const RPPS_FILE = path.resolve('data/rpps_activite.txt');
const OUTPUT_FILE = path.resolve('prospection.xlsx');
const DATA_DIR = path.resolve('data');

const WEB_SCRAPE_DAILY_LIMIT = 100;
const SFDO_BASE = 'https://www.osteopathe-syndicat.fr/annuaire-liste-des-osteopathes';
const SFDO_PAGES = 24;

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

const COL = {
  NOM: 7, PRENOM: 8, CODE_PROFESSION: 9, LIBELLE_PROFESSION: 10,
  MODE_EXERCICE: 17, SIRET: 19, CODE_POSTAL: 35, VILLE: 37,
  TELEPHONE: 40, EMAIL: 43,
};

// ─── Helpers ──────────────────────────────────────────────────────────

function normalizeName(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'hotmail.fr', 'outlook.com', 'outlook.fr',
  'yahoo.com', 'yahoo.fr', 'live.com', 'live.fr', 'orange.fr', 'wanadoo.fr',
  'free.fr', 'sfr.fr', 'laposte.net', 'icloud.com', 'me.com', 'aol.com',
  'msn.com', 'protonmail.com', 'proton.me', 'gmx.com', 'gmx.fr', 'bbox.fr',
  'numericable.fr', 'neuf.fr', 'noos.fr', 'club-internet.fr', 'cegetel.net',
  'aliceadsl.fr', 'voila.fr', 'mail.com',
]);

function isProEmail(email) {
  if (!email) return false;
  const domain = email.toLowerCase().trim().split('@')[1];
  return domain && !PERSONAL_DOMAINS.has(domain)
    && !domain.includes('example') && !domain.includes('sentry')
    && !domain.includes('wixsite') && !domain.includes('google');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Step 1: Download RPPS ───────────────────────────────────────────

async function downloadRPPS() {
  if (existsSync(RPPS_FILE)) {
    const s = await stat(RPPS_FILE);
    const ageHours = (Date.now() - s.mtimeMs) / (1000 * 60 * 60);
    if (ageHours < 24) {
      console.log(`✓ RPPS file exists (${ageHours.toFixed(1)}h old) — skipping download`);
      return;
    }
  }

  console.log('↓ Downloading RPPS data (~760 MB)...');
  await mkdir(DATA_DIR, { recursive: true });

  const response = await fetch(RPPS_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  let downloaded = 0;
  let lastPct = -1;

  const fileStream = createWriteStream(RPPS_FILE);
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(value);
    downloaded += value.length;
    if (totalBytes > 0) {
      const pct = Math.floor((downloaded / totalBytes) * 100);
      if (pct !== lastPct && pct % 10 === 0) {
        console.log(`  ${pct}% (${(downloaded / 1024 / 1024).toFixed(0)} MB)`);
        lastPct = pct;
      }
    }
  }

  fileStream.end();
  await new Promise(resolve => fileStream.on('finish', resolve));
  console.log(`✓ Downloaded ${(downloaded / 1024 / 1024).toFixed(0)} MB`);
}

// ─── Step 2: Filter & Extract from RPPS ──────────────────────────────

async function filterRPPS() {
  console.log('\n⚙ Filtering RPPS for liberal health professionals...');

  const seen = new Map();
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

    if (!TARGET_PROFESSIONS[codeProfession] || modeExercice !== 'L') continue;
    matchedLines++;

    const nom = cols[COL.NOM]?.trim() || '';
    const prenom = cols[COL.PRENOM]?.trim() || '';
    const email = cols[COL.EMAIL]?.trim() || '';
    const telephone = cols[COL.TELEPHONE]?.trim() || '';
    const ville = cols[COL.VILLE]?.trim() || '';
    const codePostal = cols[COL.CODE_POSTAL]?.trim() || '';
    const profession = TARGET_PROFESSIONS[codeProfession];

    const key = normalizeName(`${nom} ${prenom}`);
    if (!key) continue;

    const existing = seen.get(key);
    if (existing) {
      if (!existing.email && email) existing.email = email;
      if (!existing.telephone && telephone) existing.telephone = telephone;
      if (!existing.ville && ville) existing.ville = ville;
      continue;
    }

    seen.set(key, {
      profession, nom: `${nom} ${prenom}`.trim(),
      email: email || null, telephone: telephone || null,
      ville, codePostal, scraped: false,
    });
  }

  console.log(`  Scanned ${totalLines.toLocaleString()} lines`);
  console.log(`  Matched ${matchedLines.toLocaleString()} liberal practitioners`);
  console.log(`  Unique persons: ${seen.size.toLocaleString()}`);

  return { entries: [...seen.values()], byName: seen };
}

// ─── Step 3a: SFDO Directory ─────────────────────────────────────────

async function scrapeSFDO(byName) {
  console.log('\n🔍 Scraping SFDO directory...');

  let totalEmails = 0;
  let matched = 0;

  for (let page = 1; page <= SFDO_PAGES; page++) {
    try {
      const url = `${SFDO_BASE}?page=${page}&nb=50`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      });
      if (!res.ok) continue;
      const html = await res.text();

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = [...new Set(html.match(emailRegex) || [])].filter(isProEmail);
      totalEmails += emails.length;

      // Try to match each email to an RPPS entry by looking at nearby HTML
      for (const email of emails) {
        const idx = html.indexOf(email);
        const context = normalizeName(html.substring(Math.max(0, idx - 500), idx + 200)
          .replace(/<[^>]+>/g, ' '));

        for (const [nameKey, entry] of byName) {
          if (entry.email || entry.profession !== 'Ostéopathe') continue;
          const parts = nameKey.split(' ').filter(p => p.length > 2);
          if (parts.length >= 2 && parts.every(p => context.includes(p))) {
            entry.email = email.toLowerCase();
            entry.scraped = true;
            matched++;
            break;
          }
        }
      }

      if (page % 8 === 0) console.log(`  Page ${page}/${SFDO_PAGES}`);
      await sleep(800);
    } catch { /* continue */ }
  }

  console.log(`  SFDO: ${totalEmails} emails found, ${matched} matched to RPPS`);
}

// ─── Step 3b: DDG + Playwright ───────────────────────────────────────

const DIRECTORY_DOMAINS = new Set([
  'doctolib.fr', 'pagesjaunes.fr', 'resalib.fr', 'facebook.com', 'instagram.com',
  'linkedin.com', 'twitter.com', 'youtube.com', 'wikipedia.org', 'ameli.fr',
  'kelest.fr', 'crenolibre.fr', 'mondocteur.fr', 'cylex-locale.fr',
  'obteniruncontact.com', 'lemedecin.fr', 'sante.fr', 'autour-de-moi.com',
  'doctoome.com', 'blog.doctoome.com', 'medicum.fr', 'bonosteopathe.fr',
  'osteopathe.do', 'seops.fr', 'yelp.fr', 'mappy.com', 'unilocal.fr',
  'mablouseblanche.fr', 'entreprise-locale.com', 'entreprise.one',
  'medecinfrance.com', 'materneo.net', 'doqi.fr', 'meilleurautourdemoi.fr',
  'info-medecin.fr', 'google.com', 'google.fr',
]);

async function searchDDG(query) {
  const url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query) + '&kl=fr-fr';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  });
  const html = await res.text();
  const regex = /href="\/\/duckduckgo\.com\/l\/\?uddg=(https?[^&]+)&/g;
  const urls = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.push(decodeURIComponent(match[1]));
  }
  return urls;
}

function extractEmails(html) {
  const all = new Set();
  // mailto: links
  for (const m of html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
    all.add(m[1].toLowerCase());
  }
  // In text
  for (const m of html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
    all.add(m[0].toLowerCase());
  }
  return [...all].filter(isProEmail);
}

async function enrichWithWebScraping(entries, alreadyScraped) {
  const toEnrich = entries.filter(e =>
    (!e.email || !isProEmail(e.email)) && !e.scraped && !alreadyScraped.has(normalizeName(e.nom))
  );

  // Prioritize osteopaths
  toEnrich.sort((a, b) => {
    if (a.profession === 'Ostéopathe' && b.profession !== 'Ostéopathe') return -1;
    if (b.profession === 'Ostéopathe' && a.profession !== 'Ostéopathe') return 1;
    return 0;
  });

  const limit = Math.min(WEB_SCRAPE_DAILY_LIMIT, toEnrich.length);
  console.log(`\n🌐 Web scraping enrichment (${limit} today, ${toEnrich.length} remaining)...`);

  if (limit === 0) {
    console.log('  Nothing to scrape');
    return;
  }

  let found = 0;
  let browser;

  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.log(`  ⚠ Playwright not available: ${err.message}`);
    console.log('  Run: npx playwright install chromium');
    // Mark all as scraped so we don't retry
    for (let i = 0; i < limit; i++) toEnrich[i].scraped = true;
    return;
  }

  for (let i = 0; i < limit; i++) {
    const entry = toEnrich[i];
    entry.scraped = true;

    try {
      // Step 1: DDG search for their website
      const query = `"${entry.nom}" ${entry.profession} ${entry.ville}`;
      const urls = await searchDDG(query);

      // Keep only non-directory sites (potential personal websites)
      const candidates = urls
        .filter(u => ![...DIRECTORY_DOMAINS].some(d => u.includes(d)))
        .slice(0, 2);

      // Step 2: Visit candidates and look for email
      for (const siteUrl of candidates) {
        try {
          const page = await browser.newPage();
          await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
          await page.waitForTimeout(1500);
          const html = await page.content();
          const emails = extractEmails(html);
          await page.close();

          if (emails.length) {
            entry.email = emails[0];
            found++;
            break;
          }
        } catch { /* timeout/error — skip */ }
      }
    } catch { /* DDG error — skip */ }

    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${limit} — ${found} emails found`);
    }

    // Polite delay
    await sleep(2000 + Math.random() * 2000);
  }

  await browser.close();
  console.log(`  Web scraping done: ${found} emails out of ${limit}`);
}

// ─── Step 3: Orchestrator ────────────────────────────────────────────

async function enrichEmails(entries, byName) {
  const withEmail = entries.filter(e => e.email && isProEmail(e.email)).length;
  console.log(`\n📧 Enrichment — ${withEmail} pro emails from RPPS, ${entries.length - withEmail} to enrich`);

  // Load already-scraped from previous Excel
  const alreadyScraped = new Set();
  if (existsSync(OUTPUT_FILE)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(OUTPUT_FILE);
    const ws = wb.getWorksheet(1);
    if (ws) {
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        if (row.getCell(5).value?.toString()?.trim() === 'oui') {
          alreadyScraped.add(normalizeName(row.getCell(2).value?.toString() || ''));
        }
      });
    }
    console.log(`  Previously scraped: ${alreadyScraped.size}`);

    for (const e of entries) {
      if (alreadyScraped.has(normalizeName(e.nom))) e.scraped = true;
    }
  }

  await scrapeSFDO(byName);
  await enrichWithWebScraping(entries, alreadyScraped);
}

// ─── Step 4: Generate / Merge Excel ──────────────────────────────────

async function generateExcel(entries) {
  console.log(`\n📊 Generating Excel...`);

  // Load existing statuses
  const existingData = new Map();
  if (existsSync(OUTPUT_FILE)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(OUTPUT_FILE);
    const ws = wb.getWorksheet(1);
    if (ws) {
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const nom = row.getCell(2).value?.toString()?.trim() || '';
        const email = row.getCell(3).value?.toString()?.trim() || '';
        const envoye = row.getCell(4).value?.toString()?.trim() || 'non';
        existingData.set(normalizeName(nom), envoye);
        if (email) existingData.set(email.toLowerCase(), envoye);
      });
    }
  }

  // Keep only entries with pro email
  const withProEmail = entries.filter(e => e.email && isProEmail(e.email));

  // Dedup by email
  const emailSeen = new Set();
  const deduplicated = [];
  for (const entry of withProEmail) {
    const key = entry.email.toLowerCase();
    if (emailSeen.has(key)) continue;
    emailSeen.add(key);
    deduplicated.push(entry);
  }

  console.log(`  With pro email: ${withProEmail.length} → deduped: ${deduplicated.length}`);

  // Sort: osteopaths first, then profession, then name
  const order = ['Ostéopathe', 'Chiropracteur', 'Psychologue', 'Masseur-Kinésithérapeute',
    'Pédicure-Podologue', 'Orthophoniste', 'Ergothérapeute', 'Diététicien', 'Psychomotricien'];
  deduplicated.sort((a, b) => {
    const d = order.indexOf(a.profession) - order.indexOf(b.profession);
    return d !== 0 ? d : a.nom.localeCompare(b.nom, 'fr');
  });

  // Build workbook
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Prospection');

  ws.columns = [
    { header: 'Profession', key: 'profession', width: 28 },
    { header: 'Nom', key: 'nom', width: 30 },
    { header: 'Email', key: 'email', width: 40 },
    { header: 'Envoyé', key: 'envoye', width: 12 },
    { header: 'Scrappé', key: 'scrappe', width: 12 },
  ];

  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const entry of deduplicated) {
    const nameKey = normalizeName(entry.nom);
    const emailKey = entry.email.toLowerCase();
    const prevStatus = existingData.get(nameKey) || existingData.get(emailKey) || 'non';

    ws.addRow({
      profession: entry.profession,
      nom: entry.nom,
      email: entry.email,
      envoye: prevStatus,
      scrappe: entry.scraped ? 'oui' : 'non',
    });
  }

  ws.autoFilter = { from: 'A1', to: 'E1' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  await workbook.xlsx.writeFile(OUTPUT_FILE);

  // Stats
  const byProf = {};
  for (const e of deduplicated) byProf[e.profession] = (byProf[e.profession] || 0) + 1;
  const scrapedTotal = entries.filter(e => e.scraped).length;
  const scrapedNoEmail = entries.filter(e => e.scraped && (!e.email || !isProEmail(e.email))).length;

  console.log(`\n✓ ${OUTPUT_FILE}`);
  console.log(`  Rows: ${deduplicated.length}`);
  for (const [p, c] of Object.entries(byProf).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${p}: ${c}`);
  }
  console.log(`  Scrappé: ${scrapedTotal} (${scrapedNoEmail} sans résultat)`);
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🏥 Prospection praticiens santé\n');

  const skipEnrich = process.argv.includes('--skip-enrich');
  const enrichOnly = process.argv.includes('--enrich-only');

  if (!enrichOnly) await downloadRPPS();
  const { entries, byName } = await filterRPPS();

  if (!skipEnrich) {
    await enrichEmails(entries, byName);
  } else {
    console.log('\n⏭ Skipping enrichment');
  }

  await generateExcel(entries);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
