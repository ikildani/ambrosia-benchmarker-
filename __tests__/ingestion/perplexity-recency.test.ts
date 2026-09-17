import { withRecencyWindow } from '@/lib/ingestion/perplexity-deals';

describe('withRecencyWindow', () => {
  const since = '2026-08-03';

  it('removes fixed year ranges and appends the rolling window', () => {
    const q = 'Recent neurology drug acquisitions and M&A 2023-2025 with acquisition prices';
    const out = withRecencyWindow(q, since, 45);
    expect(out).not.toMatch(/20\d{2}\s*-\s*20\d{2}/);
    expect(out).toContain('Recent neurology drug acquisitions and M&A with acquisition prices');
    expect(out).toContain(`on or after ${since}`);
    expect(out).toContain('last 45 days');
  });

  it('removes runs of standalone years', () => {
    const q = 'Neurology drug deals announced at JP Morgan Healthcare Conference and ASCO 2024 2025 2026 with financial terms';
    const out = withRecencyWindow(q, since, 30);
    // Only the rewritten query body is year-free; the appended window sentence
    // carries the since date by design.
    const body = out.split(' Only include deals')[0];
    expect(body).not.toMatch(/\b20\d{2}\b/);
    expect(out).toContain('ASCO with financial terms');
  });

  it('leaves target and ratio names with digits intact', () => {
    const q = 'IL-17, TL1A, CDK4/6 and 50/50 cost-sharing deals 2022-2025 with GLP-1 assets';
    const out = withRecencyWindow(q, since, 45);
    for (const keep of ['IL-17', 'TL1A', 'CDK4/6', '50/50', 'GLP-1']) expect(out).toContain(keep);
  });

  it('does not leave a space before punctuation', () => {
    const out = withRecencyWindow('List deals 2024-2026 for AMD, glaucoma 2023.', since, 45);
    expect(out).not.toMatch(/\s[,.]/);
  });
});
