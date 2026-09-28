/**
 * Vercel rejects a deployment with more than 100 cron jobs. A new entry past
 * the cap fails every deploy (Sep 28 2026), so new scheduled work must ride on
 * an existing cron instead (see CLAUDE.md).
 */
import fs from 'fs';
import path from 'path';

test('vercel.json stays within the 100-cron cap', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8'));
  expect((config.crons ?? []).length).toBeLessThanOrEqual(100);
});
