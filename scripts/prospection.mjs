#!/usr/bin/env node

/**
 * Prospection praticiens santé + artisans — Pipeline
 *
 * Sources:
 *   1. RPPS (data.gouv.fr) — health professionals
 *   2. Annuaire des Entreprises API — artisans (INSEE/SIRENE)
 *   3. SFDO directory — osteopath union
 *   4. DDG search + Playwright — visit websites, extract email + phone
 *
 * Storage: PostgreSQL god_prospects table (not Excel)
 *
 * Usage:
 *   node scripts/prospection.mjs                  # Full pipeline
 *   node scripts/prospection.mjs --skip-enrich    # Sources only (no web scraping)
 *   node scripts/prospection.mjs --enrich-only    # Just enrich (skip data sources)
 *   node scripts/prospection.mjs --artisans-only  # Skip RPPS, only artisans
 *   node scripts/prospection.mjs --import-excel   # One-time: import existing Excel to DB
 */

import { createReadStream, createWriteStream, existsSync, readFileSync, writeFileSync } from 'fs';
import { mkdir, stat } from 'fs/promises';
import { createInterface } from 'readline';
import pg from 'pg';
import path from 'path';

// Load .env manually (no dotenv dependency)
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

// ─── Config ───────────────────────────────────────────────────────────
const RPPS_URL = 'https://www.data.gouv.fr/fr/datasets/r/fffda7e9-0ea2-4c35-bba0-4496f3af935d';
const RPPS_FILE = path.resolve('data/rpps_activite.txt');
const DATA_DIR = path.resolve('data');
const SCRAPE_STATE_FILE = path.join(DATA_DIR, 'scrape-state.json');
const WEB_SCRAPE_DAILY_LIMIT = 10;

const TARGET_PROFESSIONS = {
  '71': 'Ostéopathe', '73': 'Chiropracteur', '95': 'Diététicien',
};

const TARGET_ARTISANS = {
  '43.99C': 'Maçon',
  '43.12A': 'Terrassier',
  '43.21A': 'Électricien',
  '43.22A': 'Plombier',
  '43.22B': 'Chauffagiste',
  '43.31Z': 'Plâtrier',
  '43.32A': 'Menuisier',
  '43.32B': 'Serrurier-Métallier',
  '43.33Z': 'Carreleur',
  '43.34Z': 'Peintre',
  '43.91A': 'Charpentier',
  '43.91B': 'Couvreur',
  '43.99A': 'Étanchéiste',
  '43.29A': "Travaux d'isolation",
  '81.30Z': 'Paysagiste',
  '43.11Z': 'Démolition',
  '43.39Z': 'Travaux de finition',
  '41.20B': 'Construction de bâtiments',
};
const ARTISAN_API_BASE = 'https://recherche-entreprises.api.gouv.fr/search';
const ARTISAN_PER_PROFESSION = 100;

const COL = {
  NOM: 7, PRENOM: 8, CODE_PROFESSION: 9, MODE_EXERCICE: 17,
  CODE_POSTAL: 35, VILLE: 37, TELEPHONE: 40, EMAIL: 43,
};

// ─── Database ─────────────────────────────────────────────────────────

let pool;

async function connectDb() {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('SELECT 1');
  console.log('✓ Database connected');
}

async function db(text, params = []) {
  return pool.query(text, params);
}

/**
 * Insert prospects into DB. Skips duplicates by email (ON CONFLICT DO NOTHING).
 * NEVER updates existing rows — existing data is sacred.
 */
async function insertProspects(prospects) {
  if (prospects.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
    const batch = prospects.slice(i, i + BATCH_SIZE);
    const values = [];
    const placeholders = [];

    for (let j = 0; j < batch.length; j++) {
      const p = batch[j];
      const offset = j * 11;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`
      );
      values.push(
        p.profession,
        p.firstName || '',
        p.fullName,
        p.email.toLowerCase().trim(),
        p.phone || null,
        p.source,
        p.scraped || false,
        p.icpScore || null,
        p.icpReason || null,
        p.website || null,
        p.pageText || null,
      );
    }

    const result = await db(
      `INSERT INTO god_prospects (profession, first_name, full_name, email, phone, source, scraped, icp_score, icp_reason, website, page_text)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (email) DO NOTHING`,
      values,
    );
    inserted += result.rowCount ?? 0;
  }

  const skipped = prospects.length - inserted;
  return { inserted, skipped };
}

/** Update scraped status + email/phone for prospects that were enriched */
async function updateEnrichedProspect(entry) {
  // Only update if the prospect doesn't already have an email in DB
  // or if we found a better one. Never override sent/error status.
  await db(
    `UPDATE god_prospects
     SET email = COALESCE(NULLIF($1, ''), email),
         phone = COALESCE($2, phone),
         scraped = true,
         updated_at = now()
     WHERE lower(full_name) = lower($3)
       AND status = 'new'`,
    [entry.email, entry.phone, entry.fullName],
  );
}

// ─── AI Agent (ICP qualification via Claude Code CLI — uses Max subscription) ──

import { spawn } from 'child_process';

function runClaude(prompt) {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['-p', '--model', 'haiku'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.on('close', () => resolve(stdout));
    proc.on('error', () => resolve(''));

    // Write prompt and close stdin
    proc.stdin.write(prompt);
    proc.stdin.end();

    // Safety timeout
    setTimeout(() => { try { proc.kill(); } catch {} resolve(''); }, 30000);
  });
}

async function evaluateProspect(input) {
  const { businessName, profession, pageText, pageUrl } = input;
  const truncated = (pageText || '').substring(0, 2000);

  const prompt = `Tu qualifies des prospects B2B pour Tuldio (SaaS devis/factures par message pour artisans et professions libérales).

Entreprise : ${businessName}
Profession : ${profession}
URL : ${pageUrl}
Contenu du site :
${truncated}

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks) :
{"score": <1-10>, "reason": "<1 phrase courte>"}

Guide : 9-10 petit artisan indépendant, 7-8 petite entreprise artisanale 2-10 pers, 4-6 moyen/flou, 1-3 grande entreprise/franchise/annuaire`;

  try {
    const stdout = await runClaude(prompt);
    const jsonMatch = stdout.match(/\{[^}]+\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { score: 5, reason: 'Could not parse AI response' };
  } catch {
    return { score: 5, reason: 'AI eval failed' };
  }
}

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

const JUNK_EMAIL_PATTERNS = [
  'wix', 'sentry', 'example', 'google', 'o2switch', 'monsite', 'wordpress',
  'ovh.net', 'gandi.net', 'noreply', 'no-reply', 'test@', 'admin@',
  'webmaster@', 'postmaster@', 'support@', 'info@wix', 'hostinger',
];

function isProEmail(email) {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  const domain = lower.split('@')[1];
  if (!domain) return false;
  if (PERSONAL_DOMAINS.has(domain)) return false;
  if (JUNK_EMAIL_PATTERNS.some(p => lower.includes(p))) return false;
  return true;
}

function isValidEmailFormat(email) {
  if (!email) return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return false;
  const [local, domain] = email.split('@');
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (domain.startsWith('.') || domain.includes('..')) return false;
  return true;
}

function isRelevantEmail(email, practitionerName, siteUrl) {
  const lower = email.toLowerCase();
  const nameParts = normalizeName(practitionerName).split(' ').filter(p => p.length > 2);
  const siteDomain = new URL(siteUrl).hostname.replace('www.', '');
  const emailDomain = lower.split('@')[1];

  if (emailDomain === siteDomain) return true;
  if (nameParts.some(p => lower.includes(p))) return true;
  if (/^(contact|cabinet|rdv|secretariat|info|accueil)@/.test(lower)) return true;
  return false;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Domains to ALWAYS skip — platforms, directories, scams, social media
// RULE: we only want the artisan's OWN website, not a listing on someone else's platform
const ALWAYS_BLOCKED_DOMAINS = new Set([
  // Social media & search
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'youtube.com',
  'wikipedia.org', 'google.com', 'google.fr', 'bing.com', 'duckduckgo.com',
  'blogspot.com', 'myheritage.no', 'myheritage.com', 'mappy.com', 'yelp.fr',
  'pagesjaunes.fr', 'tiktok.com',
  // Artisan platforms & directories (NOT their own site)
  'habitatpresto.com', 'allovoisins.com', 'houzz.fr', 'starofservice.com',
  'travaux.com', 'ootravaux.fr', 'keltravo.com', 'quotatis.fr', '123devis.com',
  'trouveartisan.fr', 'bonjour-artisan.net', 'depanneurs.com', 'batiweb.com',
  'batiactu.com', 'linternaute.com', 'commentcamarche.net',
  'manomano.fr', 'leroymerlin.fr', 'castorama.fr', 'engie.fr', 'edf.fr',
  'consuel.com', 'plombier.com', 'electricien.com',
  // Generalist scam/lead-gen sites
  'etienne-services.fr', 'contact-plombier.fr', 'plombier-paris.fr',
  'artisan-plombier.fr', 'artisan-electricien.fr',
  'previrisques.fr', 'pvfs.fr',
  // Business directories
  'societe.com', 'verif.com', 'infogreffe.fr', 'pappers.fr',
  'cylex-locale.fr', 'obteniruncontact.com', 'unilocal.fr',
  'entreprise-locale.com', 'entreprise.one', 'keskeces.com',
  'nosavis.com', 'cataloxy.org', '118000.fr',
]);

// Additional domains to skip for health professionals (medical directories with no useful email)
const HEALTH_DIRECTORY_DOMAINS = new Set([
  'doctolib.fr', 'resalib.fr', 'ameli.fr', 'crenolibre.fr', 'mondocteur.fr',
  'maiia.com', 'doctoome.com', 'osteopathe.do', 'bonosteopathe.fr',
  'medical-sante.fr', 'doctovac.com', 'choisirunmedecin.com', 'lemedecin.fr',
  'medicum.fr', 'obteniruncontact.com', 'unilocal.fr',
  'mablouseblanche.fr', 'entreprise-locale.com', 'entreprise.one',
  'medecinfrance.com', 'materneo.net', 'doqi.fr', 'meilleurautourdemoi.fr',
  'info-medecin.fr', 'trouver-ouvert.fr', 'afosteo.org', 'sante.fr',
  'annuaire-therapeutes.com', 'seops.fr', 'autour-de-moi.com', 'kelest.fr',
  'rdvmedicaux.com', 'therapenet.com', 'allo-medecin.fr', 'clickdoc.fr',
  '118000.fr', 'keskeces.com', 'nosavis.com', 'cataloxy.org', 'info-docteur.com',
  '36osteos.com', 'alternativi.fr', 'osteopathes.pro', 'ville-gif.fr',
  'osteopathie.org', 'osteopathe-syndicat.fr',
  'annuairesante.com', 'allo-osteopathes.fr', 'osteopatheinfo.com',
]);

const artisanProfessions = new Set(Object.values(TARGET_ARTISANS));

function isUsefulSite(url, profession) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    // Always block social media, search engines, PagesJaunes (Cloudflare)
    if (ALWAYS_BLOCKED_DOMAINS.has(host)) return false;
    if ([...ALWAYS_BLOCKED_DOMAINS].some(d => host.endsWith('.' + d))) return false;
    // For health professionals, also block medical directories
    if (!artisanProfessions.has(profession)) {
      if (HEALTH_DIRECTORY_DOMAINS.has(host)) return false;
      if ([...HEALTH_DIRECTORY_DOMAINS].some(d => host.endsWith('.' + d))) return false;
    }
    // For artisans, allow business directories (cylex, 118000, etc.) — they often have contact info
    return true;
  } catch { return false; }
}

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
  let downloaded = 0, lastPct = -1;
  const fileStream = createWriteStream(RPPS_FILE);
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(value);
    downloaded += value.length;
    if (totalBytes > 0) {
      const pct = Math.floor((downloaded / totalBytes) * 100);
      if (pct !== lastPct && pct % 10 === 0) { console.log(`  ${pct}%`); lastPct = pct; }
    }
  }
  fileStream.end();
  await new Promise(resolve => fileStream.on('finish', resolve));
  console.log(`✓ Downloaded ${(downloaded / 1024 / 1024).toFixed(0)} MB`);
}

// ─── Step 2a: Filter RPPS ───────────────────────────────────────────

async function filterRPPS() {
  console.log('\n⚙ Filtering RPPS...');
  const seen = new Map();
  let totalLines = 0, matchedLines = 0;

  const rl = createInterface({
    input: createReadStream(RPPS_FILE, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    totalLines++;
    const cols = line.split('|');
    const code = cols[COL.CODE_PROFESSION]?.trim();
    if (!TARGET_PROFESSIONS[code] || cols[COL.MODE_EXERCICE]?.trim() !== 'L') continue;
    matchedLines++;

    const nom = cols[COL.NOM]?.trim() || '';
    const prenom = cols[COL.PRENOM]?.trim() || '';
    const key = normalizeName(`${nom} ${prenom}`);
    if (!key) continue;

    const existing = seen.get(key);
    const email = cols[COL.EMAIL]?.trim() || '';
    const telephone = cols[COL.TELEPHONE]?.trim() || '';
    const ville = cols[COL.VILLE]?.trim() || '';

    if (existing) {
      if (!existing.email && email) existing.email = email;
      if (!existing.phone && telephone) existing.phone = telephone;
      if (!existing.ville && ville) existing.ville = ville;
      continue;
    }

    seen.set(key, {
      profession: TARGET_PROFESSIONS[code],
      firstName: prenom,
      fullName: `${nom} ${prenom}`.trim(),
      email: email || null,
      phone: telephone || null,
      ville,
      source: 'rpps',
      scraped: false,
    });
  }

  console.log(`  ${totalLines.toLocaleString()} lines → ${matchedLines.toLocaleString()} matched → ${seen.size.toLocaleString()} unique`);
  return { entries: [...seen.values()], byName: seen };
}

// ─── Step 2b: Fetch Artisans from Annuaire des Entreprises ──────────

async function fetchArtisans(existingByName) {
  console.log('\n🔧 Fetching artisans from Annuaire des Entreprises...');
  const entries = [];
  const seen = new Set([...existingByName.keys()]);

  for (const [naf, label] of Object.entries(TARGET_ARTISANS)) {
    let fetched = 0;
    let page = 1;

    while (fetched < ARTISAN_PER_PROFESSION) {
      try {
        const params = new URLSearchParams({
          activite_principale: naf,
          etat_administratif: 'A',
          per_page: '25',
          page: String(page),
        });
        const res = await fetch(`${ARTISAN_API_BASE}?${params}`);
        if (!res.ok) { console.log(`  ⚠ API error for ${label}: ${res.status}`); break; }
        const data = await res.json();
        const results = data.results || [];
        if (results.length === 0) break;

        for (const r of results) {
          if (fetched >= ARTISAN_PER_PROFESSION) break;

          // Up to 10 employees (NN=unknown, 00=0, 01=1-2, 02=3-5, 03=6-9)
          const tranche = r.tranche_effectif_salarie;
          if (tranche && !['NN', '00', '01', '02', '03'].includes(tranche)) continue;

          const nomComplet = r.nom_complet?.trim();
          if (!nomComplet) continue;

          // Skip obviously non-small companies
          const upper = nomComplet.toUpperCase();
          if (/\b(GROUPE|HOLDING|INTERNATIONAL|NATIONAL|FRANCE|EUROPE)\b/.test(upper)) continue;

          const key = normalizeName(nomComplet);
          if (!key || seen.has(key)) continue;
          seen.add(key);

          // Only use firstName from dirigeants API data — never guess from company name
          let prenom = '';
          const dirigeant = r.dirigeants?.[0];
          if (dirigeant?.prenom) {
            prenom = dirigeant.prenom
              .replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
          }

          entries.push({
            profession: label,
            firstName: prenom,
            fullName: nomComplet,
            email: null,
            phone: null,
            ville: r.geo_adresse?.split(/\d{5}/)?.[1]?.trim() || '',
            source: 'annuaire_entreprises',
            scraped: false,
          });
          fetched++;
        }

        page++;
        if (page > 40) break;
        await sleep(300);
      } catch (err) {
        console.log(`  ⚠ Error fetching ${label}: ${err.message}`);
        break;
      }
    }
    console.log(`  ${label}: ${fetched} prospects`);
  }

  console.log(`  Total artisans: ${entries.length}`);
  return entries;
}

// ─── Step 3a: SFDO Directory ─────────────────────────────────────────

async function scrapeSFDO(byName) {
  console.log('\n🔍 Scraping SFDO directory...');
  let totalEmails = 0, matched = 0;

  for (let page = 1; page <= 24; page++) {
    try {
      const res = await fetch(
        `https://www.osteopathe-syndicat.fr/annuaire-liste-des-osteopathes?page=${page}&nb=50`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (!res.ok) continue;
      const html = await res.text();
      const emails = [...new Set((html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))].filter(isProEmail);
      totalEmails += emails.length;

      for (const email of emails) {
        const idx = html.indexOf(email);
        const ctx = normalizeName(html.substring(Math.max(0, idx - 500), idx + 200).replace(/<[^>]+>/g, ' '));
        for (const [nameKey, entry] of byName) {
          if (entry.email || entry.profession !== 'Ostéopathe') continue;
          const parts = nameKey.split(' ').filter(p => p.length > 2);
          if (parts.length >= 2 && parts.every(p => ctx.includes(p))) {
            entry.email = email.toLowerCase();
            entry.source = 'sfdo';
            entry.scraped = true;
            matched++;
            break;
          }
        }
      }
      await sleep(800);
    } catch { /* continue */ }
  }
  console.log(`  SFDO: ${totalEmails} emails found, ${matched} matched`);
}

// ─── Step 3b: DDG + Playwright ───────────────────────────────────────

async function searchDDG(queryStr) {
  const url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(queryStr) + '&kl=fr-fr';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const regex = /href="\/\/duckduckgo\.com\/l\/\?uddg=(https?[^&]+)&/g;
  const urls = [];
  let m;
  while ((m = regex.exec(html)) !== null) urls.push(decodeURIComponent(m[1]));
  return urls;
}

async function scrapeContactPage(browser, siteUrl, practitionerName, isArtisan = false) {
  const page = await browser.newPage();
  try {
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(4000);

    const contactHref = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a')];
      const c = links.find(a =>
        /contact/i.test(a.innerText?.trim()) && a.href?.startsWith('http') && !a.href.includes('mailto:')
      );
      return c?.href || null;
    });

    if (contactHref) {
      try {
        await page.goto(contactHref, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(4000);
      } catch { /* stay on current page */ }
    }

    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);

    const rawEmails = new Set();
    for (const m of html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) rawEmails.add(m[1].toLowerCase());
    for (const m of (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])) rawEmails.add(m.toLowerCase());
    for (const m of (html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])) rawEmails.add(m.toLowerCase());

    let emails;
    if (isArtisan) {
      // For artisans on directory pages: accept any pro email found near the business name
      // First try relevant emails (name match), then fall back to any pro email on the page
      const relevant = [...rawEmails].filter(e => isProEmail(e) && isRelevantEmail(e, practitionerName, siteUrl));
      if (relevant.length > 0) {
        emails = relevant;
      } else {
        // On a personal site (not a directory), accept the first pro email
        const siteDomain = new URL(siteUrl).hostname.replace('www.', '');
        const isDirectory = ['cylex-locale.fr', '118000.fr', 'kompass.com', 'societe.com',
          'entreprise-locale.com', 'unilocal.fr', 'nosavis.com', 'cataloxy.org'].some(d => siteDomain.includes(d));
        if (!isDirectory) {
          emails = [...rawEmails].filter(e => isProEmail(e)).slice(0, 1);
        } else {
          // On a directory: look for emails near the practitioner's name in the text
          const nameParts = normalizeName(practitionerName).split(' ').filter(p => p.length > 2);
          const normalText = normalizeName(text);
          const nearbyEmails = [];
          for (const email of rawEmails) {
            if (!isProEmail(email)) continue;
            // Check if the email appears within ~500 chars of the name in the page text
            const emailIdx = normalText.indexOf(email.split('@')[0]);
            const nameIdx = nameParts.reduce((best, p) => {
              const idx = normalText.indexOf(p);
              return idx !== -1 && (best === -1 || Math.abs(idx - emailIdx) < Math.abs(best - emailIdx)) ? idx : best;
            }, -1);
            if (nameIdx !== -1 && Math.abs(emailIdx - nameIdx) < 500) {
              nearbyEmails.push(email);
            }
          }
          emails = nearbyEmails;
        }
      }
    } else {
      emails = [...rawEmails].filter(e => isProEmail(e) && isRelevantEmail(e, practitionerName, siteUrl));
    }

    const phones = new Set();
    for (const m of (text.match(/(?:(?:\+33|0033|0)\s?[1-9])(?:[\s.-]?\d{2}){4}/g) || [])) phones.add(m);
    for (const m of html.matchAll(/tel:(\+?[\d\s.-]{10,})/g)) phones.add(m[1].trim());

    return { emails, phones: [...phones], pageText: text.substring(0, 4000) };
  } catch {
    return { emails: [], phones: [], pageText: '' };
  } finally {
    await page.close();
  }
}

// ─── Scrape state persistence (resume across sessions) ──────────────

function loadScrapeState() {
  if (!existsSync(SCRAPE_STATE_FILE)) return { scraped: {}, found: {} };
  try {
    return JSON.parse(readFileSync(SCRAPE_STATE_FILE, 'utf-8'));
  } catch { return { scraped: {}, found: {} }; }
}

function saveScrapeState(state) {
  writeFileSync(SCRAPE_STATE_FILE, JSON.stringify(state, null, 2));
}

async function enrichWithWebScraping(entries, scrapeState) {
  const toEnrich = entries.filter(e => {
    const key = normalizeName(e.fullName);
    if (scrapeState.scraped[key]) {
      const prev = scrapeState.found[key];
      if (prev?.email && (!e.email || !isProEmail(e.email))) e.email = prev.email;
      if (prev?.phone && !e.phone) e.phone = prev.phone;
      e.scraped = true;
      return false;
    }
    return (!e.email || !isProEmail(e.email)) && !e.scraped;
  });

  const artisanProfs = new Set(Object.values(TARGET_ARTISANS));
  toEnrich.sort((a, b) => {
    const aArt = artisanProfs.has(a.profession) ? 0 : 1;
    const bArt = artisanProfs.has(b.profession) ? 0 : 1;
    if (aArt !== bArt) return aArt - bArt;
    if (a.profession === 'Ostéopathe' && b.profession !== 'Ostéopathe') return -1;
    if (b.profession === 'Ostéopathe' && a.profession !== 'Ostéopathe') return 1;
    return 0;
  });

  const limit = Math.min(WEB_SCRAPE_DAILY_LIMIT, toEnrich.length);
  console.log(`\n🌐 Web scraping (${limit} today, ${toEnrich.length} remaining)...`);
  if (limit === 0) return;

  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.log(`  ⚠ Playwright not available: ${err.message}`);
    return;
  }

  let emailFound = 0, phoneFound = 0, qualified = 0, disqualified = 0;

  for (let i = 0; i < limit; i++) {
    const entry = toEnrich[i];
    const key = normalizeName(entry.fullName);
    entry.scraped = true;
    scrapeState.scraped[key] = true;

    try {
      const isArtisan = artisanProfessions.has(entry.profession);
      const queryStr = isArtisan
        ? `${entry.fullName} ${entry.profession} ${entry.ville || ''} contact`
        : `${entry.fullName} ${entry.profession} ${entry.ville || ''}`;
      const urls = await searchDDG(queryStr);
      const maxUrls = isArtisan ? 4 : 2;
      const candidates = urls.filter(u => isUsefulSite(u, entry.profession)).slice(0, maxUrls);

      let pageText = '';
      let bestSiteUrl = '';

      for (const siteUrl of candidates) {
        const result = await scrapeContactPage(browser, siteUrl, entry.fullName, isArtisan);

        if (result.emails.length) {
          entry.email = result.emails[0];
          emailFound++;
        }
        if (result.phones.length && !entry.phone) {
          entry.phone = result.phones[0];
          phoneFound++;
        }
        if (result.pageText && !pageText) {
          pageText = result.pageText;
          bestSiteUrl = siteUrl;
        }

        if (result.emails.length || result.phones.length) break;
      }

      // AI qualification (via Claude Code CLI — free with Max subscription)
      if (pageText && (entry.email || entry.phone)) {
        const website = new URL(bestSiteUrl).hostname.replace('www.', '');
        const evaluation = await evaluateProspect({
          businessName: entry.fullName,
          profession: entry.profession,
          pageText,
          pageUrl: bestSiteUrl,
        });

        entry.icpScore = evaluation.score;
        entry.icpReason = evaluation.reason;
        entry.website = website;
        entry.pageText = pageText.substring(0, 3000);

        if (evaluation.score < 6) {
          entry.email = null;
          entry.phone = null;
          disqualified++;
        } else {
          qualified++;
        }
        console.log(`    ${evaluation.score >= 6 ? '✓' : '✗'} ${entry.fullName} → ${evaluation.score}/10 (${evaluation.reason})`);

        scrapeState.found[key] = {
          email: entry.email, phone: entry.phone,
          website, icpScore: evaluation.score, icpReason: evaluation.reason,
        };
      } else if (entry.email || entry.phone) {
        scrapeState.found[key] = { email: entry.email, phone: entry.phone };
      }
    } catch { /* continue */ }

    if ((i + 1) % 5 === 0) saveScrapeState(scrapeState);

    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${limit} — ${emailFound} emails, ${phoneFound} phones | ${qualified} qualified, ${disqualified} disqualified`);
    }

    await sleep(2000 + Math.random() * 2000);
  }

  saveScrapeState(scrapeState);
  await browser.close();
  console.log(`  Done: ${emailFound} emails, ${phoneFound} phones from ${limit} searches`);
}

// ─── Step 3: Enrichment Orchestrator ─────────────────────────────────

async function enrichEmails(entries, byName) {
  const withEmail = entries.filter(e => e.email && isProEmail(e.email)).length;
  console.log(`\n📧 Enrichment — ${withEmail} pro emails from sources`);

  const scrapeState = loadScrapeState();
  console.log(`  Scrape state: ${Object.keys(scrapeState.scraped).length} already scraped, ${Object.keys(scrapeState.found).length} with results`);

  for (const e of entries) {
    const key = normalizeName(e.fullName);
    if (scrapeState.scraped[key]) {
      e.scraped = true;
      const prev = scrapeState.found[key];
      if (prev?.email && (!e.email || !isProEmail(e.email))) e.email = prev.email;
      if (prev?.phone && !e.phone) e.phone = prev.phone;
    }
  }

  await scrapeSFDO(byName);
  await enrichWithWebScraping(entries, scrapeState);
}

// ─── Step 4: Save to Database ────────────────────────────────────────

async function saveToDatabase(entries) {
  console.log(`\n📊 Saving to database...`);

  // Filter to valid pro emails only
  const valid = entries.filter(e =>
    e.email && isProEmail(e.email) && isValidEmailFormat(e.email)
  );

  console.log(`  Valid entries with pro email: ${valid.length}`);

  const prospects = valid.map(e => ({
    profession: e.profession,
    firstName: e.firstName || '',
    fullName: e.fullName,
    email: e.email,
    phone: e.phone || null,
    source: e.source || 'rpps',
    scraped: e.scraped || false,
    icpScore: null,
    icpReason: null,
    website: e.website || null,
    pageText: e.pageText || null,
  }));

  const { inserted, skipped } = await insertProspects(prospects);

  // Stats from DB
  const stats = await db(`
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE status = 'new') AS unsent,
      count(*) FILTER (WHERE status = 'sent') AS sent,
      count(*) FILTER (WHERE status = 'error') AS errors
    FROM god_prospects
  `);
  const s = stats.rows[0];

  const byProf = await db(`
    SELECT profession, count(*)::int AS count
    FROM god_prospects
    GROUP BY profession
    ORDER BY count DESC
  `);

  console.log(`\n✓ Database updated`);
  console.log(`  Inserted: ${inserted} | Skipped (duplicates): ${skipped}`);
  console.log(`  Total: ${s.total} | Unsent: ${s.unsent} | Sent: ${s.sent} | Errors: ${s.errors}`);
  for (const r of byProf.rows) {
    console.log(`    ${r.profession}: ${r.count}`);
  }
}

// ─── Import Excel (one-time migration) ──────────────────────────────

async function importExcel() {
  const ExcelJS = (await import('exceljs')).default;
  const OUTPUT_FILE = path.resolve('prospection.xlsx');

  if (!existsSync(OUTPUT_FILE)) {
    console.log('No prospection.xlsx found — nothing to import');
    return;
  }

  console.log('\n📥 Importing existing Excel to database...');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(OUTPUT_FILE);
  const ws = wb.getWorksheet(1);
  if (!ws) { console.log('  No worksheet found'); return; }

  const prospects = [];
  const statusUpdates = [];

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const profession = row.getCell(1).value?.toString()?.trim() || '';
    const firstName = row.getCell(2).value?.toString()?.trim() || '';
    const fullName = row.getCell(3).value?.toString()?.trim() || '';
    const email = row.getCell(4).value?.toString()?.trim() || '';
    const phone = row.getCell(5).value?.toString()?.trim() || null;
    const envoye = row.getCell(6).value?.toString()?.trim() || 'non';

    if (!email) return;

    prospects.push({
      profession,
      firstName,
      fullName,
      email,
      phone,
      source: 'rpps',
      scraped: true,
    });

    // Track sent/error status for post-insert updates
    if (envoye === 'erreur') {
      statusUpdates.push({ email, status: 'error', sentAt: null });
    } else if (envoye !== 'non') {
      // It's a date string (YYYY-MM-DD) or some other non-"non" value
      statusUpdates.push({ email, status: 'sent', sentAt: envoye });
    }
  });

  console.log(`  Found ${prospects.length} rows in Excel`);

  const { inserted, skipped } = await insertProspects(prospects);
  console.log(`  Inserted: ${inserted} | Skipped: ${skipped}`);

  // Apply status updates
  for (const u of statusUpdates) {
    const sentAt = /^\d{4}-\d{2}-\d{2}/.test(u.sentAt) ? u.sentAt : null;
    await db(
      `UPDATE god_prospects
       SET status = $1,
           sent_at = $2::timestamptz,
           updated_at = now()
       WHERE lower(email) = lower($3)`,
      [u.status, sentAt, u.email],
    );
  }
  console.log(`  Status updates: ${statusUpdates.length} (sent/error)`);
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🏗 Prospection praticiens santé + artisans\n');

  const skipEnrich = process.argv.includes('--skip-enrich');
  const enrichOnly = process.argv.includes('--enrich-only');
  const artisansOnly = process.argv.includes('--artisans-only');
  const doImportExcel = process.argv.includes('--import-excel');

  await connectDb();

  if (doImportExcel) {
    await importExcel();
    await pool.end();
    return;
  }

  let entries, byName;

  if (artisansOnly) {
    entries = [];
    byName = new Map();
  } else {
    if (!enrichOnly) await downloadRPPS();
    ({ entries, byName } = await filterRPPS());
  }

  const artisanEntries = await fetchArtisans(byName);
  entries.push(...artisanEntries);
  for (const e of artisanEntries) byName.set(normalizeName(e.fullName), e);

  if (!skipEnrich) {
    await enrichEmails(entries, byName);
  } else {
    console.log('\n⏭ Skipping enrichment');
  }

  await saveToDatabase(entries);
  await pool.end();
}

main().catch(async err => {
  console.error('❌ Error:', err.message);
  if (pool) await pool.end().catch(() => {});
  process.exit(1);
});
