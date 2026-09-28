/**
 * The competitor-deal-alert cron must never email subscribers about a deal
 * the verifier rejected or flagged, or about a non-canonical duplicate row.
 *
 * The deals query must read the deals_verified view (migration 147) and, when
 * that returns nothing, no alert email may go out.
 */

import { NextRequest } from 'next/server';

const mockSendEmail = jest.fn();

// A chainable query builder that records every call and resolves to the
// configured result when awaited.
function makeSupabase(result: { data: unknown[]; error: null } = { data: [], error: null }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  const chain = (method: string) =>
    jest.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  for (const m of ['from', 'select', 'insert', 'update', 'eq', 'neq', 'in', 'not', 'gte', 'lte', 'lt', 'gt', 'or', 'order', 'limit']) {
    builder[m] = chain(m);
  }
  builder.then = (resolve: (v: unknown) => void) => resolve(result);
  return { builder, calls };
}

let supa = makeSupabase();

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => supa.builder,
}));
jest.mock('@/lib/email/client', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));
jest.mock('@/lib/sentry-api', () => ({ captureApiError: jest.fn() }));
jest.mock('@/lib/cron-intelligence', () => ({ runCronIntelligence: jest.fn() }));

const SECRET = 'test-cron-secret';

function cronRequest() {
  return new NextRequest('http://localhost/api/cron/competitor-deal-alert', {
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

describe('competitor-deal-alert applies the deal quality filter', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    supa = makeSupabase({ data: [], error: null });
    mockSendEmail.mockReset();
  });

  it('excludes rejected, flagged and non-canonical deals and sends nothing when none remain', async () => {
    const { GET } = await import('@/app/api/cron/competitor-deal-alert/route');
    const res = await GET(cronRequest());
    expect(res.status).toBe(200);

    // New deals come from the quality-filtered view, never the raw deals table.
    const tables = supa.calls.filter((c) => c.method === 'from').map((c) => c.args[0]);
    expect(tables).toContain('deals_verified');
    expect(tables).not.toContain('deals');

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
