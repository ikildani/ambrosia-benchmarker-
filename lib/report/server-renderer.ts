import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Render an HTML string to a PDF buffer using headless Chromium.
 * Designed for Vercel serverless functions with @sparticuz/chromium.
 *
 * Fonts are embedded as base64 WOFF2 in the HTML, so no network requests
 * are needed — 'domcontentloaded' is sufficient and avoids the 500ms
 * networkidle2 wait.
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
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for embedded Inter font to decode (with timeout fallback)
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
