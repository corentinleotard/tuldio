#!/usr/bin/env node

/**
 * Fill artisan contact forms with reCAPTCHA v3 bypass
 *
 * Strategy:
 *   1. Copy real Chrome profile (Google cookies = high reCAPTCHA v3 score)
 *   2. puppeteer-extra + stealth plugin (hides automation fingerprint)
 *   3. Human-like behavior (slow typing, mouse movements, scrolling)
 *
 * Usage:
 *   node scripts/fill-forms.mjs                    # Fill all pending sites
 *   node scripts/fill-forms.mjs --url <url>        # Fill specific site
 *   node scripts/fill-forms.mjs --headful          # Show browser (default: headless)
 *   node scripts/fill-forms.mjs --dry-run          # Fill but don't submit
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

// ─── Config ──────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'data', 'screenshots');
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_PROFILE_SRC = path.join(process.env.HOME, 'Library', 'Application Support', 'Google', 'Chrome');
const TEMP_PROFILE_DIR = '/tmp/puppeteer-chrome-profile';

const CONTACT_INFO = {
  prenom: 'Corentin',
  nom: 'Tuldio',
  societe: 'Tuldio',
  email: 'corentin@try-tuldio.fr',
  tel: '06 31 86 33 77',
  adresse: '1 rue de la Paix',
  cp: '75001',
  ville: 'Paris',
};

function getMessage(profession) {
  const map = {
    Plombier: 'plombiers', Électricien: 'electriciens', Menuisier: 'menuisiers',
    Maçon: 'macons', Carreleur: 'carreleurs', Charpentier: 'charpentiers',
    Peintre: 'peintres', Couvreur: 'couvreurs', Paysagiste: 'paysagistes',
    Terrassier: 'terrassiers',
  };
  const target = map[profession] || 'artisans';
  return [
    'Bonjour,',
    '',
    `Je me permets de vous contacter car j ai cree Tuldio, un outil simple pour les ${target}.`,
    '',
    'Vous envoyez un message, votre devis ou facture est pret en 30 secondes. C est tout. Pas de logiciel, pas de formation, pas de prise de tete.',
    '',
    'Jetez un oeil ici : https://tuldio.fr',
    '',
    'Bonne journee,',
    'Corentin',
  ].join('\n');
}

// ─── Chrome launch (headless with real profile) ─────────────────────
async function launchChrome() {
  // Use the copied profile with real Google cookies
  const profileDir = '/tmp/chrome-debug-profile';
  if (!existsSync(path.join(profileDir, 'Default', 'Cookies'))) {
    console.error('✗ No Chrome profile copy found. Run with --copy-profile first or ensure /tmp/chrome-debug-profile exists.');
    process.exit(1);
  }

  console.log('🚀 Launching headless Chrome with your profile...');
  const browser = await puppeteer.launch({
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
  console.log('  ✓ Headless Chrome running with your cookies');
  return browser;
}

// ─── Human behavior helpers ──────────────────────────────────────────
async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function randomDelay(min = 200, max = 600) {
  await sleep(min + Math.random() * (max - min));
}

async function humanScroll(page, pixels) {
  const steps = Math.ceil(Math.abs(pixels) / 80);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel({ deltaY: pixels > 0 ? 80 : -80 });
    await sleep(40 + Math.random() * 60);
  }
}

async function humanMouseMove(page, count = 5) {
  for (let i = 0; i < count; i++) {
    await page.mouse.move(
      150 + Math.random() * 1100,
      150 + Math.random() * 500,
      { steps: 6 + Math.floor(Math.random() * 8) }
    );
    await sleep(300 + Math.random() * 600);
  }
}

async function humanType(page, selector, text) {
  const el = await page.$(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);

  // Scroll into view
  await el.evaluate(e => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await randomDelay(300, 600);

  // Move mouse to element
  const box = await el.boundingBox();
  if (box) {
    await page.mouse.move(
      box.x + box.width * (0.2 + Math.random() * 0.6),
      box.y + box.height * (0.3 + Math.random() * 0.4),
      { steps: 6 }
    );
    await randomDelay(100, 250);
  }

  // Click
  await el.click();
  await randomDelay(100, 200);

  // Select all + delete
  await page.keyboard.down('Meta');
  await page.keyboard.press('a');
  await page.keyboard.up('Meta');
  await randomDelay(50, 100);
  await page.keyboard.press('Backspace');
  await randomDelay(80, 150);

  // Type character by character
  for (const char of text) {
    await page.keyboard.type(char, { delay: 20 + Math.random() * 50 });
  }

  await randomDelay(300, 600);
}

// ─── Cookie dismissal ────────────────────────────────────────────────
async function dismissCookies(page) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, a, div[role=button]')];
    const keywords = ['accepter les cookies', 'accepter', 'tout accepter', 'accept all', 'ok, accept all', 'j\'accepte'];
    for (const b of btns) {
      const t = b.textContent.trim().toLowerCase();
      if (keywords.some(k => t === k || t.includes(k))) {
        b.click();
        return true;
      }
    }
    return false;
  });
  await sleep(2000);
}

// ─── Form detection ──────────────────────────────────────────────────
async function detectFormType(page) {
  return page.evaluate(() => {
    const hasCF7 = !!document.querySelector('.wpcf7-form');
    const hasDivi = !!document.querySelector('.et_pb_contact_form_container');
    const hasWPForms = !!document.querySelector('.wpforms-form');
    const hasElementor = !!document.querySelector('.elementor-form');
    const hasRecaptchaV2 = !!document.querySelector('.g-recaptcha[data-sitekey]');
    const hasRecaptchaV3 = document.body.innerHTML.includes('recaptcha') && !hasRecaptchaV2;
    const hasDiviCaptcha = !!document.querySelector('.et_pb_contact_captcha_question');

    return { hasCF7, hasDivi, hasWPForms, hasElementor, hasRecaptchaV2, hasRecaptchaV3, hasDiviCaptcha };
  });
}

// ─── Smart form filler ───────────────────────────────────────────────
async function smartFillForm(page, profession) {
  const C = CONTACT_INFO;
  const msg = getMessage(profession);

  // Get all visible form fields
  const fields = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('form input:not([type=hidden]):not([type=submit]):not([type=button]), form textarea, form select')];
    return inputs.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        type: el.type || '',
        name: el.name || '',
        id: el.id || '',
        placeholder: (el.placeholder || '').toLowerCase(),
        label: (el.closest('label')?.textContent?.trim() ||
               (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim()) || '').toLowerCase(),
        visible: rect.width > 0 && rect.height > 0,
        isHoneypot: el.closest('[style*="display:none"], [style*="display: none"], [style*="position:absolute"][style*="left:-"]') !== null ||
                    el.name.includes('honeypot') || el.name.includes('test') || el.name.includes('email2') ||
                    (el.placeholder || '').toLowerCase().includes('ne pas remplir'),
      };
    }).filter(f => f.visible && !f.isHoneypot);
  });

  for (const field of fields) {
    const n = `${field.name} ${field.id} ${field.placeholder} ${field.label}`.toLowerCase();
    let value = null;

    // Match field to value
    if (field.tag === 'textarea') {
      if (n.includes('recaptcha')) continue; // Skip reCAPTCHA textarea
      value = msg;
    } else if (field.type === 'checkbox') {
      // Handle checkboxes (RGPD, CGU, consent)
      if (n.includes('rgpd') || n.includes('cgu') || n.includes('consent') || n.includes('accepte') || n.includes('condition') || n.includes('accord')) {
        const selector = field.id ? `#${field.id}` : `input[name="${field.name}"]`;
        await page.evaluate((sel) => {
          const cb = document.querySelector(sel);
          if (cb && !cb.checked) {
            // Try clicking label first (for custom styled checkboxes)
            const lbl = cb.closest('.wpcf7-list-item')?.querySelector('.wpcf7-list-item-label') ||
                       cb.closest('label') || cb.parentElement?.querySelector('span, label');
            if (lbl && lbl !== cb) lbl.click();
            if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
          }
        }, selector);
        await randomDelay(500, 1000);
      }
      continue;
    } else if (field.type === 'radio') {
      continue; // Skip radios for now
    } else if (n.includes('prenom') || n.includes('prénom') || n.includes('first')) {
      value = C.prenom;
    } else if (n.includes('nom') || n.includes('last') || n.includes('name')) {
      value = n.includes('full') || n.includes('complet') ? `${C.prenom} ${C.nom}` : C.nom;
    } else if (n.includes('email') || n.includes('mail') || n.includes('courriel')) {
      value = C.email;
    } else if (n.includes('tel') || n.includes('phone') || n.includes('mobile')) {
      value = C.tel;
    } else if (n.includes('adress') || n.includes('address') || n.includes('rue')) {
      value = C.adresse;
    } else if (n.includes('postal') || n.includes('zip') || n.includes(' cp')) {
      value = C.cp;
    } else if (n.includes('ville') || n.includes('city') || n.includes('commune')) {
      value = C.ville;
    } else if (n.includes('sujet') || n.includes('subject') || n.includes('objet')) {
      value = `Tuldio - outil pour ${profession.toLowerCase()}s`;
    } else if (n.includes('societe') || n.includes('société') || n.includes('entreprise') || n.includes('company')) {
      value = C.societe;
    }

    if (value) {
      const selector = field.id ? `#${field.id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')}` : `[name="${field.name.replace(/"/g, '\\"')}"]`;
      try {
        await humanType(page, selector, value);
        console.log(`    ✓ ${field.name || field.id}: "${value.substring(0, 30)}..."`);
      } catch (e) {
        console.log(`    ✗ ${field.name || field.id}: ${e.message.substring(0, 60)}`);
      }
    }
  }
}

// ─── Divi math captcha solver ────────────────────────────────────────
async function solveDiviCaptcha(page) {
  const captchaQ = await page.evaluate(() => {
    const el = document.querySelector('.et_pb_contact_captcha_question');
    return el ? el.textContent.trim() : null;
  });
  if (captchaQ) {
    const match = captchaQ.match(/(\d+)\s*\+\s*(\d+)/);
    if (match) {
      const answer = parseInt(match[1]) + parseInt(match[2]);
      await humanType(page, '.et_pb_contact_captcha', String(answer));
      console.log(`    ✓ Captcha: ${captchaQ} = ${answer}`);
    }
  }
}

// ─── Submit and capture result ───────────────────────────────────────
async function submitForm(page, formType, dryRun = false) {
  if (dryRun) {
    console.log('  🚫 Dry run — not submitting');
    return { status: 'dry_run' };
  }

  // Set up response listener for CF7
  let cf7Response = null;
  const responseHandler = async (response) => {
    if (response.url().includes('/feedback') && response.request().method() === 'POST') {
      try { cf7Response = await response.json(); } catch {}
    }
  };
  page.on('response', responseHandler);

  // Find and click submit button
  const submitted = await page.evaluate(() => {
    // For Divi forms
    const diviBtn = document.querySelector('.et_pb_contact_submit');
    if (diviBtn) { diviBtn.scrollIntoView({ block: 'center' }); diviBtn.click(); return 'divi'; }

    // For CF7/WPForms/generic — find visible submit with "Envoyer" text
    const submits = [...document.querySelectorAll('input[type=submit], button[type=submit]')];
    const envoyer = submits.find(s => {
      const r = s.getBoundingClientRect();
      const text = (s.value || s.textContent || '').toLowerCase();
      return r.width > 0 && r.height > 0 && r.top >= 0 && text.includes('envoyer');
    });
    // Fallback: any visible submit
    const visible = envoyer || submits.find(s => {
      const r = s.getBoundingClientRect();
      return r.width > 20 && r.height > 20 && r.top >= 0;
    });
    if (visible) { visible.scrollIntoView({ block: 'center' }); visible.click(); return 'submit'; }
    return null;
  });

  if (!submitted) {
    console.log('  ✗ No submit button found');
    return { status: 'no_submit' };
  }

  console.log('  ⏳ Submitted, waiting for response...');
  await sleep(10000);

  page.off('response', responseHandler);

  // Check result
  if (cf7Response) {
    return { status: cf7Response.status, message: cf7Response.message };
  }

  // Check Divi response
  const diviMsg = await page.evaluate(() => {
    const el = document.querySelector('.et-pb-contact-message p');
    return el ? el.textContent.trim() : null;
  });
  if (diviMsg) {
    const success = diviMsg.toLowerCase().includes('merci') || diviMsg.toLowerCase().includes('envoy');
    return { status: success ? 'mail_sent' : 'error', message: diviMsg };
  }

  // Check page content
  const body = await page.evaluate(() => document.body.innerText.substring(0, 500));
  const success = body.toLowerCase().includes('merci') || body.toLowerCase().includes('envoy') || body.toLowerCase().includes('message a bien');
  return { status: success ? 'mail_sent' : 'unknown', message: body.substring(0, 100) };
}

// ─── Main ────────────────────────────────────────────────────────────
async function fillSite({ browser, url, name, profession, dryRun = false }) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🏠 ${name} (${profession})`);
  console.log(`🔗 ${url}`);
  console.log('═'.repeat(60));

  const page = await browser.newPage();

  try {
    // Navigate
    console.log('  Loading page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    // Dismiss cookies
    await dismissCookies(page);

    // Find contact page if needed
    if (!url.includes('contact') && !url.includes('devis')) {
      const contactUrl = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href]')];
        const c = links.find(l => {
          const t = l.textContent.toLowerCase();
          const h = l.href.toLowerCase();
          return (t.includes('contact') || h.includes('contact')) && !h.includes('mailto:');
        });
        return c ? c.href : null;
      });
      if (contactUrl) {
        console.log('  Navigating to contact page...');
        await page.goto(contactUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await sleep(3000);
        await dismissCookies(page);
      }
    }

    // Detect form type
    const formType = await detectFormType(page);
    console.log('  Form type:', JSON.stringify(formType));

    // Human browsing behavior (builds reCAPTCHA v3 trust)
    console.log('  Building trust score...');
    await humanMouseMove(page, 6);
    await humanScroll(page, 300);
    await sleep(1500);
    await humanMouseMove(page, 3);
    await humanScroll(page, -100);
    await sleep(1000);
    await humanScroll(page, 200);
    await sleep(1200);

    // Fill form
    console.log('  Filling form...');
    await smartFillForm(page, profession);

    // Solve Divi captcha if present
    if (formType.hasDiviCaptcha) {
      await solveDiviCaptcha(page);
    }

    // More human behavior before submit
    await humanMouseMove(page, 3);
    await sleep(1500);

    // Screenshot before submit
    if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const hostname = new URL(url).hostname.replace('www.', '');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `form-${hostname}-before.png`) });

    // Submit
    const result = await submitForm(page, formType, dryRun);
    console.log(`  Result: ${result.status} — ${result.message?.substring(0, 80) || ''}`);

    // Screenshot after submit
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `form-${hostname}-after.png`) });

    return result;

  } catch (e) {
    console.log(`  ✗ Error: ${e.message.substring(0, 120)}`);
    return { status: 'error', message: e.message.substring(0, 120) };
  } finally {
    await page.close(); // Close tab, not browser
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const headful = args.includes('--headful');
const dryRun = args.includes('--dry-run');
const specificUrl = args.find((_, i, a) => a[i - 1] === '--url');

// Target list — update before each run
const SITES = [
  { url: 'https://abenergies-aveyron.fr/', name: 'AB Energies', profession: 'Plombier' },
  { url: 'https://macon-et-tradition.fr/', name: 'Maçon et Tradition', profession: 'Maçon' },
  { url: 'https://raka-peinture.fr/', name: 'RAKA Peinture', profession: 'Peintre' },
  { url: 'https://menuiseriebarthez.com/contact/', name: 'Menuiserie Barthez', profession: 'Menuisier' },
  { url: 'https://menuiserie-puech.fr/', name: 'Menuiserie Puech', profession: 'Menuisier' },
];

(async () => {
  // Step 1: Launch headless Chrome with real profile
  const browser = await launchChrome();

  const targets = specificUrl
    ? [{ url: specificUrl, name: 'Custom', profession: 'Artisan' }]
    : SITES;

  const results = [];

  for (const site of targets) {
    try {
      const result = await fillSite({ browser, ...site, dryRun });
      results.push({ ...site, ...result });
    } catch (e) {
      console.log(`  ✗ Fatal error on ${site.name}: ${e.message.substring(0, 100)}`);
      results.push({ ...site, status: 'error', message: e.message.substring(0, 100) });
    }
    await sleep(3000);
  }

  // Summary
  console.log('\n\n' + '═'.repeat(60));
  console.log('📊 RÉSULTATS');
  console.log('═'.repeat(60));
  for (const r of results) {
    const icon = r.status === 'mail_sent' ? '✅' : r.status === 'spam' ? '🚫' : '❌';
    console.log(`${icon} ${r.name} (${r.profession}) — ${r.status}`);
  }

  const success = results.filter(r => r.status === 'mail_sent');
  console.log(`\n${success.length}/${results.length} envoyés`);

  await browser.close();
})();
