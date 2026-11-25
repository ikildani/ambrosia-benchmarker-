/**
 * Nov 23 2026: claude-sonnet-5 replies open with a thinking block when `thinking` is omitted.
 * Reading content[0] turned every such extraction into "not a deal" (4,606 paid calls, 2 rows).
 */
jest.mock('@anthropic-ai/sdk', () => jest.fn());

import { noThinking, replyText } from '@/lib/ai/response-text';
import { buildDealExtractionRequest, parseDealExtraction } from '@/lib/ingestion/sec-edgar';

describe('replyText', () => {
  it('reads the JSON after a leading thinking block', () => {
    const content = [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: '{"licensor":"Innogen","licensee":"Arcera","confidence_score":88}' },
    ];
    const deal = parseDealExtraction(replyText(content));
    expect(deal?.licensor).toBe('Innogen');
    expect(deal?.licensee).toBe('Arcera');
  });

  it('still returns null for a real "not a deal" verdict', () => {
    expect(parseDealExtraction(replyText([{ type: 'text', text: '{"is_deal": false, "reason": "share pledge"}' }]))).toBeNull();
  });

  it('is empty when the reply has no text block', () => {
    expect(replyText([{ type: 'thinking' }])).toBe('');
    expect(replyText(undefined)).toBe('');
  });
});

describe('noThinking', () => {
  it('turns thinking off only on models that think by default and accept disabled', () => {
    expect(noThinking('claude-sonnet-5')).toEqual({ thinking: { type: 'disabled' } });
    expect(noThinking('claude-opus-5')).toEqual({ thinking: { type: 'disabled' } });
    expect(noThinking('claude-opus-4-6')).toEqual({});
    expect(noThinking('claude-opus-5-5')).toEqual({});
    expect(noThinking('claude-sonnet-5-5')).toEqual({});
  });

  it('is part of the extraction request for the lean extractor', () => {
    const req = buildDealExtractionRequest('text');
    if (req.model === 'claude-sonnet-5') expect(req.thinking).toEqual({ type: 'disabled' });
    else expect(req.thinking).toBeUndefined();
  });
});
