/**
 * The `leads` table is shared with the advisory site (ambrosiaventures.co),
 * which stores contact-form and newsletter leads there. The Pro-gate drip must
 * only email leads Solidus captured itself (source allowlist). Advisory
 * prospects received all eight Solidus Pro emails before this guard.
 */

import { NextRequest } from 'next/server';
import { SOLIDUS_DRIP_SOURCES } from '@/lib/email/pro-gate-drip';

const mockSendEmail = jest.fn();

function makeSupabase() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  const chain = (method: string) =>
    jest.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  for (const m of ['from', 'select', 'update', 'eq', 'in', 'is', 'or', 'order', 'limit']) {
    builder[m] = chain(m);
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null, count: 0 });
  return { builder, calls };
}

let supa = makeSupabase();

jest.mock('@/lib/supabase/server', () => ({ createServiceClient: () => supa.builder }));
jest.mock('@/lib/email/client', () => ({ sendEmail: (...a: unknown[]) => mockSendEmail(...a) }));
jest.mock('@/lib/sentry-api', () => ({ captureApiError: jest.fn() }));
jest.mock('@/lib/cron-intelligence', () => ({ runCronIntelligence: jest.fn() }));

const SECRET = 'test-cron-secret';

describe('pro-gate-drip lead sources', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    supa = makeSupabase();
    mockSendEmail.mockReset();
  });

  it('allowlist holds only Solidus capture sources', () => {
    expect([...SOLIDUS_DRIP_SOURCES].sort()).toEqual(['pro_gate', 'share_view']);
    for (const advisory of ['website_contact_form', 'website_subscribe', 'exit_intent', 'deal_guide', 'insights', 'shape_diagnostic']) {
      expect(SOLIDUS_DRIP_SOURCES as readonly string[]).not.toContain(advisory);
    }
  });

  it('filters the leads query by the allowlist', async () => {
    const { GET } = await import('@/app/api/cron/pro-gate-drip/route');
    const res = await GET(new NextRequest('http://localhost/api/cron/pro-gate-drip', {
      headers: { authorization: `Bearer ${SECRET}` },
    }));
    expect(res.status).toBe(200);

    const fromLeads = supa.calls.findIndex(c => c.method === 'from' && c.args[0] === 'leads');
    expect(fromLeads).toBeGreaterThanOrEqual(0);
    const sourceFilter = supa.calls
      .slice(fromLeads)
      .find(c => c.method === 'in' && c.args[0] === 'source');
    expect(sourceFilter).toBeDefined();
    expect(sourceFilter!.args[1]).toEqual(['pro_gate', 'share_view']);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
