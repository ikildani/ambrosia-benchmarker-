import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Render an HTML string to a PDF buffer using headless Chromium.
 * Designed for Vercel serverless functions with @sparticuz/chromium.
 *
 * Performance: Uses 'domcontentloaded' instead of 'networkidle0' to avoid
 * waiting on Google Fonts CDN requests. Font fallback to system fonts ensures
 * the PDF renders correctly even without the network font.
 */
export async function renderPDFBuffer(html: string): Promise<Uint8Array> {
  // Strip external font requests — use system font stack for server-side PDF.
  // This avoids a 5-10s wait for Google Fonts CDN in headless Chromium.
  const optimizedHtml = html
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/g, '')
    .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/g, '');

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Block external font/image requests to speed up rendering
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'font' || type === 'stylesheet') {
        const url = req.url();
        if (url.includes('fonts.googleapis') || url.includes('fonts.gstatic')) {
          req.abort();
          return;
        }
      }
      req.continue();
    });

    await page.setContent(optimizedHtml, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

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
