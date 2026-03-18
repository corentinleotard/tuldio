#!/usr/bin/env node

/**
 * Prospection événementiel (mariages.net) + coaches/formateurs — Pipeline
 *
 * Sources:
 *   1. Mariages.net — wedding providers (photographes, traiteurs, DJ, wedding planners)
 *   2. Annuaire des Entreprises API — coaches, formateurs, consultants
 *   3. DDG search + Playwright — visit websites, extract email + phone
 *
 * Storage: PostgreSQL god_prospects table (same as artisan pipeline)
 *
 * Usage:
 *   node scripts/prospection-events-coaches.mjs                    # Full pipeline
 *   node scripts/prospection-events-coaches.mjs --skip-enrich      # Sources only
 *   node scripts/prospection-events-coaches.mjs --enrich-only      # Just enrich existing
 *   node scripts/prospection-events-coaches.mjs --mariages-only    # Skip coaches
 *   node scripts/prospection-events-coaches.mjs --coaches-only     # Skip mariages.net
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import pg from 'pg';
import path from 'path';
import { spawn } from 'child_process';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteerExtra.use(StealthPlugin());

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

// ─── Config ───────────────────────────────────────────────────────────
const DATA_DIR = path.resolve('data');
const SCRAPE_STATE_FILE = path.join(DATA_DIR, 'scrape-state-events-coaches.json');
const WEB_SCRAPE_DAILY_LIMIT = 100; // Bump to 100-500 for production

// Mariages.net categories → URL slugs + profession labels
// Tier 1 first, then Tier 2-3 (uncomment to add)
const MARIAGES_CATEGORIES = {
  'photo-mariage': 'Photographe mariage',
  'organisation-mariage': 'Wedding planner',
  'traiteur-mariage': 'Traiteur mariage',
  // 'video-mariage': 'Vidéaste mariage',
  // 'musique-mariage': 'DJ / Musicien mariage',
  // 'decoration-mariage': 'Décorateur mariage',
  // 'fleurs-mariage': 'Fleuriste mariage',
  // 'wedding-cake': 'Pâtissier mariage',
};
const MARIAGES_PER_CATEGORY = 80; // Max providers to scrape per category
const MARIAGES_BASE = 'https://www.mariages.net';

// Coach / formateur NAF codes (Annuaire des Entreprises)
const TARGET_COACHES = {
  '70.22Z': 'Consultant',
  '85.59A': 'Formateur',
  '85.59B': 'Coach',
  '74.20Z': 'Photographe',       // Photographers outside wedding context too
  '82.30Z': 'Organisateur événementiel',
};
const COACHES_PER_PROFESSION = 100;
const ARTISAN_API_BASE = 'https://recherche-entreprises.api.gouv.fr/search';

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

  return { inserted, skipped: prospects.length - inserted };
}

// ─── AI Agent (ICP qualification via Claude Code CLI) ─────────────────

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
    proc.stdin.write(prompt);
    proc.stdin.end();
    setTimeout(() => { try { proc.kill(); } catch {} resolve(''); }, 30000);
  });
}

async function evaluateProspect(input) {
  const { businessName, profession, pageText, pageUrl } = input;
  const truncated = (pageText || '').substring(0, 2000);

  const prompt = `Tu qualifies des prospects B2B pour Tuldio (SaaS devis/factures par message pour prestataires événementiels, coaches et formateurs).

Entreprise : ${businessName}
Profession : ${profession}
URL : ${pageUrl}
Contenu du site :
${truncated}

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks) :
{"score": <1-10>, "reason": "<1 phrase courte>"}

Guide :
9-10 indépendant / micro-entreprise qui fait des devis/factures régulièrement
7-8 petite entreprise 2-10 pers, prestataire événementiel ou coach/formateur actif
4-6 moyen/flou, pas clair s'il fait des devis
1-3 grande entreprise/franchise/plateforme/annuaire/pas pertinent`;

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
  // Reject image filenames scraped as emails (logo@2x.png, icon@3x.png)
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(email)) return false;
  return true;
}

/** Reject emails from domains that don't match the prospect's website */
function emailMatchesWebsite(email, website) {
  if (!email || !website) return true; // Can't validate, allow
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const siteDomain = website.toLowerCase().replace('www.', '');
  if (emailDomain === siteDomain) return true;
  // Allow contact@subdomain.site or similar
  if (emailDomain?.endsWith('.' + siteDomain)) return true;
  if (siteDomain?.endsWith('.' + emailDomain)) return true;
  return false;
}

/** Reject names that are clearly promo text, not business names */
function isValidBusinessName(name) {
  if (!name || name.length < 2 || name.length > 80) return false;
  // Promo/promotional text patterns
  if (/\d+%\s*(de\s+)?remise/i.test(name)) return false;
  if (/dernières?\s+disponibilit/i.test(name)) return false;
  if (/promotion\s+pour/i.test(name)) return false;
  if (/offert|gratuit|promo/i.test(name)) return false;
  if (/jeux?\s+en\s+bois/i.test(name)) return false;
  // Too short single word (likely generic)
  if (name.length <= 3 && !name.includes(' ')) return false;
  return true;
}

function isRelevantEmail(email, practitionerName, siteUrl) {
  const lower = email.toLowerCase();
  const nameParts = normalizeName(practitionerName).split(' ').filter(p => p.length > 2);
  const siteDomain = new URL(siteUrl).hostname.replace('www.', '');
  const emailDomain = lower.split('@')[1];

  if (emailDomain === siteDomain) return true;
  if (nameParts.some(p => lower.includes(p))) return true;
  if (/^(contact|cabinet|rdv|info|accueil|hello|bonjour)@/.test(lower)) return true;
  return false;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const ALWAYS_BLOCKED_DOMAINS = new Set([
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'youtube.com',
  'wikipedia.org', 'google.com', 'google.fr', 'bing.com', 'duckduckgo.com',
  'blogspot.com', 'mappy.com', 'yelp.fr', 'pagesjaunes.fr', 'tiktok.com',
  'pinterest.com', 'pinterest.fr',
  // Wedding platforms (we want their OWN site, not their listing)
  'mariages.net', 'zankyou.fr', 'mariee.fr', 'lamarieeencolere.com',
  'theknot.com', 'weddingwire.com', 'fearlessphotographers.com',
  // Business directories
  'societe.com', 'verif.com', 'infogreffe.fr', 'pappers.fr',
  'cylex-locale.fr', 'obteniruncontact.com', 'unilocal.fr',
  'entreprise-locale.com', 'entreprise.one', 'keskeces.com',
  'nosavis.com', 'cataloxy.org', '118000.fr',
  // Coach/formateur platforms
  'malt.fr', 'superprof.fr', 'doctolib.fr',
  // Generic
  'habitatpresto.com', 'allovoisins.com', 'starofservice.com',
]);

function isUsefulSite(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    if (ALWAYS_BLOCKED_DOMAINS.has(host)) return false;
    if ([...ALWAYS_BLOCKED_DOMAINS].some(d => host.endsWith('.' + d))) return false;
    return true;
  } catch { return false; }
}

// ─── Chrome launch (puppeteer-extra + stealth + real Chrome profile) ──

const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function launchStealthChrome() {
  const profileDir = '/tmp/chrome-debug-profile';
  if (!existsSync(path.join(profileDir, 'Default', 'Cookies'))) {
    console.log('  ⚠ No Chrome profile copy found at /tmp/chrome-debug-profile.');
    console.log('    Run: pkill -9 -f "Google Chrome" && sleep 2 && rm -rf /tmp/chrome-debug-profile && cp -r "$HOME/Library/Application Support/Google/Chrome" /tmp/chrome-debug-profile && rm -f /tmp/chrome-debug-profile/Singleton* && open -a "Google Chrome"');
    return null;
  }

  const browser = await puppeteerExtra.launch({
    headless: 'new',
    executablePath: CHROME_BIN,
    userDataDir: profileDir,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-extensions',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });
  return browser;
}

// ─── Source 1: Mariages.net Scraping ──────────────────────────────────

async function scrapeMariagesNet() {
  console.log('\n💒 Scraping Mariages.net (puppeteer-extra + stealth)...');

  const browser = await launchStealthChrome();
  if (!browser) {
    console.log('  ⚠ Skipping mariages.net (no Chrome profile). Falling back to coaches only.');
    return [];
  }

  const entries = [];
  const seen = new Set();

  // Reuse a single page to avoid Chrome profile lock issues
  const page = await browser.newPage();

  for (const [slug, profession] of Object.entries(MARIAGES_CATEGORIES)) {
    let fetched = 0;
    let pageNum = 1;

    while (fetched < MARIAGES_PER_CATEGORY) {
      try {
        const url = pageNum === 1
          ? `${MARIAGES_BASE}/${slug}`
          : `${MARIAGES_BASE}/${slug}?page=${pageNum}`;

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 4000));

        const providers = await page.evaluate(() => {
          const cards = [];
          const links = document.querySelectorAll('a[href*="--e"]');
          const seenUrls = new Set();

          for (const link of links) {
            const href = link.getAttribute('href');
            if (!href || seenUrls.has(href)) continue;
            const match = href.match(/\/([^/]+)--e(\d+)/);
            if (!match) continue;
            seenUrls.add(href);

            let name = link.textContent?.trim() || '';
            if (name.length > 100 || name.includes('photo') || name.includes('Voir')) {
              const card = link.closest('[class*="card"], [class*="vendor"], [class*="listing"], li, article, div');
              if (card) {
                const heading = card.querySelector('h2, h3, [class*="name"], [class*="title"]');
                if (heading) name = heading.textContent?.trim() || name;
              }
            }
            if (!name || name.length < 2 || name.length > 80) continue;

            let location = '';
            const card = link.closest('[class*="card"], [class*="vendor"], [class*="listing"], li, article, div');
            if (card) {
              const locEl = card.querySelector('[class*="location"], [class*="address"], [class*="city"]');
              if (locEl) location = locEl.textContent?.trim() || '';
            }

            cards.push({
              name,
              profileId: match[2],
              profileSlug: match[1],
              location,
              profileUrl: href.startsWith('http') ? href : `https://www.mariages.net${href}`,
            });
          }
          return cards;
        });

        if (providers.length === 0) {
          if (pageNum === 1) {
            console.log(`  ⚠ ${profession}: page 1 returned 0 providers (selectors may need update)`);
          }
          break;
        }

        for (const p of providers) {
          if (fetched >= MARIAGES_PER_CATEGORY) break;
          if (!isValidBusinessName(p.name)) continue;
          const key = normalizeName(p.name);
          if (!key || seen.has(key)) continue;
          seen.add(key);

          entries.push({
            profession,
            firstName: '',
            fullName: p.name,
            email: null,
            phone: null,
            ville: p.location.split(',')[0]?.trim() || '',
            source: 'mariages_net',
            scraped: false,
          });
          fetched++;
        }

        pageNum++;
        if (pageNum > 20) break;
        await sleep(2000 + Math.random() * 2000);
      } catch (err) {
        console.log(`  ⚠ Error scraping ${slug} page ${pageNum}: ${err.message}`);
        break;
      }
    }
    console.log(`  ${profession}: ${fetched} prospects`);
  }

  await page.close();
  await browser.close();
  console.log(`  Total mariages.net: ${entries.length}`);
  return entries;
}

// ─── Source 2: Coaches/Formateurs from Annuaire des Entreprises ───────

async function fetchCoaches(existingNames) {
  console.log('\n🎯 Fetching coaches/formateurs from Annuaire des Entreprises...');
  const entries = [];
  const seen = new Set([...existingNames]);

  for (const [naf, label] of Object.entries(TARGET_COACHES)) {
    let fetched = 0;
    let page = 1;

    while (fetched < COACHES_PER_PROFESSION) {
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
          if (fetched >= COACHES_PER_PROFESSION) break;

          // Up to 10 employees
          const tranche = r.tranche_effectif_salarie;
          if (tranche && !['NN', '00', '01', '02', '03'].includes(tranche)) continue;

          const nomComplet = r.nom_complet?.trim();
          if (!nomComplet) continue;

          const upper = nomComplet.toUpperCase();
          if (/\b(GROUPE|HOLDING|INTERNATIONAL|NATIONAL|FRANCE|EUROPE|SARL|SAS\b.{0,3}$)\b/.test(upper)) continue;

          const key = normalizeName(nomComplet);
          if (!key || seen.has(key)) continue;
          seen.add(key);

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

  console.log(`  Total coaches/formateurs: ${entries.length}`);
  return entries;
}

// ─── DDG Search + Playwright Enrichment ───────────────────────────────

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

async function scrapeContactPage(browser, siteUrl, practitionerName) {
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

    // For event providers & coaches: accept any pro email, prefer relevant ones
    const relevant = [...rawEmails].filter(e => isProEmail(e) && isRelevantEmail(e, practitionerName, siteUrl));
    let emails;
    if (relevant.length > 0) {
      emails = relevant;
    } else {
      // On a personal site, accept the first pro email
      const siteDomain = new URL(siteUrl).hostname.replace('www.', '');
      const isDirectory = ['cylex-locale.fr', '118000.fr', 'kompass.com', 'societe.com',
        'entreprise-locale.com', 'unilocal.fr', 'nosavis.com', 'cataloxy.org'].some(d => siteDomain.includes(d));
      if (!isDirectory) {
        emails = [...rawEmails].filter(e => isProEmail(e)).slice(0, 1);
      } else {
        emails = [];
      }
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

// ─── Scrape state persistence ─────────────────────────────────────────

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

  // Prioritize mariages.net providers (higher value, more likely to have a website)
  toEnrich.sort((a, b) => {
    const aEvent = a.source === 'mariages_net' ? 0 : 1;
    const bEvent = b.source === 'mariages_net' ? 0 : 1;
    return aEvent - bEvent;
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
      // Build a search query adapted to the profession
      const queryStr = `${entry.fullName} ${entry.profession} ${entry.ville || ''} contact site`;
      const urls = await searchDDG(queryStr);
      const candidates = urls.filter(u => isUsefulSite(u)).slice(0, 4);

      let pageText = '';
      let bestSiteUrl = '';

      for (const siteUrl of candidates) {
        const result = await scrapeContactPage(browser, siteUrl, entry.fullName);

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

      // AI qualification
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

// ─── Save to Database ─────────────────────────────────────────────────

async function saveToDatabase(entries) {
  console.log(`\n📊 Saving to database...`);

  const valid = entries.filter(e =>
    e.email && isProEmail(e.email) && isValidEmailFormat(e.email)
    && emailMatchesWebsite(e.email, e.website)
  );

  console.log(`  Valid entries with pro email: ${valid.length}`);

  const prospects = valid.map(e => ({
    profession: e.profession,
    firstName: e.firstName || '',
    fullName: e.fullName,
    email: e.email,
    phone: e.phone || null,
    source: e.source || 'mariages_net',
    scraped: e.scraped || false,
    icpScore: e.icpScore || null,
    icpReason: e.icpReason || null,
    website: e.website || null,
    pageText: e.pageText || null,
  }));

  const { inserted, skipped } = await insertProspects(prospects);

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

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🎉 Prospection événementiel + coaches/formateurs\n');

  const skipEnrich = process.argv.includes('--skip-enrich');
  const enrichOnly = process.argv.includes('--enrich-only');
  const mariagesOnly = process.argv.includes('--mariages-only');
  const coachesOnly = process.argv.includes('--coaches-only');

  await connectDb();
  await mkdir(DATA_DIR, { recursive: true });

  const allEntries = [];
  const seenNames = new Set();

  // Source 1: Mariages.net
  if (!coachesOnly && !enrichOnly) {
    const mariagesEntries = await scrapeMariagesNet();
    allEntries.push(...mariagesEntries);
    for (const e of mariagesEntries) seenNames.add(normalizeName(e.fullName));
  }

  // Source 2: Coaches/Formateurs from Annuaire
  if (!mariagesOnly && !enrichOnly) {
    const coachEntries = await fetchCoaches(seenNames);
    allEntries.push(...coachEntries);
  }

  console.log(`\n📋 Total prospects collected: ${allEntries.length}`);

  // Enrichment
  if (!skipEnrich) {
    const scrapeState = loadScrapeState();
    console.log(`  Scrape state: ${Object.keys(scrapeState.scraped).length} already scraped`);
    await enrichWithWebScraping(allEntries, scrapeState);
  } else {
    console.log('\n⏭ Skipping enrichment');
  }

  await saveToDatabase(allEntries);
  await pool.end();
}

main().catch(async err => {
  console.error('❌ Error:', err.message);
  if (pool) await pool.end().catch(() => {});
  process.exit(1);
});
