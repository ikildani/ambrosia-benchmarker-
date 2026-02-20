import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Render an HTML string to a PDF buffer using headless Chromium.
 * Designed for Vercel serverless functions with @sparticuz/chromium.
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
      waitUntil: 'networkidle0',
      timeout: 20000,
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
