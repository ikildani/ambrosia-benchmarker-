import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Cron RPCs run as the PostgREST role under pg_safeupdate: an UPDATE or DELETE without WHERE fails
// ("UPDATE requires a WHERE clause"), even on a temp table. Manual runs as postgres do not catch it.
// Checks the latest definition of each function in migrations 187+.
describe('radar functions are safe-update clean', () => {
  const dir = join(process.cwd(), 'supabase/migrations');
  const latest = new Map<string, string>();
  for (const f of readdirSync(dir).filter(f => /^\d+/.test(f) && parseInt(f, 10) >= 187).sort()) {
    const sql = readFileSync(join(dir, f), 'utf8');
    const re = /CREATE OR REPLACE FUNCTION public\.(radar_\w+)\([\s\S]*?\n\$(\w*)\$;/g;
    for (const m of sql.matchAll(re)) latest.set(m[1], m[0]);
  }

  it('found function definitions', () => expect(latest.size).toBeGreaterThan(3));

  it.each([...latest.keys()])('%s has no bare UPDATE/DELETE', (name) => {
    const body = latest.get(name)!.replace(/--[^\n]*/g, '');
    const stmts = body.match(/\b(?:UPDATE\s+[\w.]+(?:\s+\w+)?\s+SET|DELETE\s+FROM\s+[\w.]+)[^;]*;/gi) ?? [];
    expect(stmts.filter(s => !/\bWHERE\b/i.test(s))).toEqual([]);
  });
});
