import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Render an HTML string to a PDF buffer using headless Chromium.
 * Designed for Vercel serverless functions with @sparticuz/chromium.
 *
 * Uses 'networkidle2' (≤2 active connections for 500ms) to balance speed
 * with reliable font loading from Google Fonts CDN.
 */
export async function renderPDFBuffer(html: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    // Wait for Inter font to finish loading (with timeout fallback)
    await page.evaluateHandle('document.fonts.ready')
      .then(h => h.dispose())
      .catch(() => {});

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
