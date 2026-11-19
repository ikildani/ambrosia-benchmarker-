/**
 * Every server-rendered page under app/admin must call requireAdminPage()
 * before it reads data. AdminLayoutClient only hides content in the browser;
 * without the server check the rows ship in the RSC payload to anyone.
 */
import fs from 'fs';
import path from 'path';

const ADMIN_DIR = path.join(process.cwd(), 'app', 'admin');

function pages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name === 'page.tsx' ? [p] : [];
  });
}

const isClient = (src: string) => /^\s*['"]use client['"]/.test(src);

describe('admin pages are gated on the server', () => {
  const serverPages = pages(ADMIN_DIR).filter(p => !isClient(fs.readFileSync(p, 'utf8')));

  it('finds the server pages (briefs at least)', () => {
    expect(serverPages.some(p => p.includes(path.join('admin', 'briefs')))).toBe(true);
  });

  it.each(serverPages.map(p => [path.relative(process.cwd(), p)]))('%s calls requireAdminPage()', rel => {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    expect(src).toMatch(/await requireAdminPage\(\)/);
    // The check must come before the first service-client read inside the default export.
    const body = src.slice(src.indexOf('export default async function'));
    const gate = body.indexOf('await requireAdminPage()');
    const read = body.search(/createServiceClient\(|await (fetch|load)[A-Z]\w*\(|await Promise\.all/);
    expect(gate).toBeGreaterThan(-1);
    if (read > -1) expect(gate).toBeLessThan(read);
  });

  it('the admin layout gates too', () => {
    const src = fs.readFileSync(path.join(ADMIN_DIR, 'layout.tsx'), 'utf8');
    expect(src).toMatch(/await requireAdminPage\(\)/);
  });
});
