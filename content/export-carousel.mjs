import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'linkedin-carousel.html');
const outputDir = join(__dirname, 'carousel-export');

import { mkdirSync } from 'fs';
mkdirSync(outputDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

// Wait for fonts to load
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 2000));

const slides = await page.$$('.slide');

// Export individual PNGs
for (let i = 0; i < slides.length; i++) {
  await slides[i].screenshot({
    path: join(outputDir, `slide-${i + 1}.png`),
    type: 'png',
  });
  console.log(`Exported slide-${i + 1}.png`);
}

// Export as single PDF (for LinkedIn carousel upload)
await page.pdf({
  path: join(outputDir, 'linkedin-carousel.pdf'),
  width: '1080px',
  height: '1080px',
  printBackground: true,
  pageRanges: '1-5',
});
console.log('Exported linkedin-carousel.pdf');

await browser.close();
console.log(`\nDone! Files in: ${outputDir}`);
