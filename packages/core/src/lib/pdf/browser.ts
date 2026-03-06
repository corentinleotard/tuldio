import puppeteer, { type Browser } from 'puppeteer';
import { logger } from '../infra/logger.js';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  browser.on('disconnected', () => {
    logger.warn('Puppeteer browser disconnected');
    browser = null;
  });

  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
