/**
 * Launch note copy: founder voice, no template chrome, links to the feed,
 * the acquirer view and the methodology page; no "retained" or success-fee
 * language; the nudge is shorter and asks one thing.
 */

jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }));
jest.mock('@/lib/email/client', () => ({ sendEmail: jest.fn() }));

import { buildEmail } from '@/scripts/radar-launch-email';

describe('radar launch email', () => {
  it('day0 links the feed, acquirer view and methodology and reads as a note', () => {
    const { subject, html } = buildEmail('day0', 'Maria');
    expect(subject).toBe('Search & Evaluation is live in your Pro account');
    expect(html).toContain('Hi Maria,');
    expect(html).toContain('solidus.ambrosiaventures.co/radar"');
    expect(html).toContain('/radar/acquirers');
    expect(html).toContain('/radar/methodology');
    expect(html).toMatch(/Issa<\/p>/);
    expect(html).not.toMatch(/retained|success fee|unsubscribe|<img/i);
  });

  it('day7 is shorter and asks for one mandate', () => {
    const d0 = buildEmail('day0', 'Ken');
    const d7 = buildEmail('day7', 'Ken');
    expect(d7.html.length).toBeLessThan(d0.html.length);
    expect(d7.html).toContain('start a mandate from a template');
    expect(d7.subject).toMatch(/find you anything/);
  });

  it('escapes the name', () => {
    expect(buildEmail('day0', '<b>x</b>').html).toContain('Hi &lt;b&gt;x&lt;/b&gt;,');
  });
});
