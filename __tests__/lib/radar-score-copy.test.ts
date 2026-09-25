import {
  baseRateMultiple,
  peerGroupLabel,
  percentileLabel,
  probabilityLabel,
  rankPhrase,
  scoreToneKey,
  unrankedReason,
} from '@/lib/radar/client/score-copy';

describe('score-copy', () => {
  it('peer group label reads like a person wrote it', () => {
    expect(peerGroupLabel('phase_2|oncology')).toBe('Phase 2 oncology');
    expect(peerGroupLabel('phase_1_2|rare_disease')).toBe('Phase 1/2 rare disease');
    expect(peerGroupLabel('phase_2|unknown')).toBe('Phase 2');
    expect(peerGroupLabel('unknown|unknown')).toBeNull();
    expect(peerGroupLabel(null)).toBeNull();
  });

  it('rank phrase never says "Top 0%"', () => {
    expect(rankPhrase(100)).toBe('Top 1%');
    expect(rankPhrase(97)).toBe('Top 3%');
    expect(rankPhrase(75)).toBe('Top 25%');
    expect(rankPhrase(60)).toBe('Top half');
    expect(rankPhrase(20)).toBe('Bottom 21%');
    expect(rankPhrase(null)).toBeNull();
  });

  it('percentile label', () => {
    expect(percentileLabel({ score: 4, pct_peer: 97, peer_key: 'phase_2|oncology', peer_n: 412 }, { withN: true })).toBe('Top 3% of Phase 2 oncology (n=412)');
    expect(percentileLabel({ score: 4, pct_peer: 97, peer_key: null })).toBe('Top 3% of peers');
    expect(percentileLabel({ score: 4, pct_peer: null })).toBeNull();
    expect(unrankedReason({ score: null })).toBe('Not yet scored');
    expect(unrankedReason({ score: 12, pct_peer: null })).toMatch(/outside the core universe/);
  });

  it('probability label and base-rate multiple', () => {
    expect(probabilityLabel({ score: 4, probability: 0.032, base_rate: 0.008 })).toBe('3.2% chance of a licensing deal within 12 months (peers average 0.8%)');
    expect(probabilityLabel({ score: 4, probability: 0.0002 })).toBe('<0.1% chance of a licensing deal within 12 months');
    expect(probabilityLabel({ score: 4 })).toBeNull();
    expect(baseRateMultiple({ score: 4, probability: 0.032, base_rate: 0.008 })).toBe('4.0× peers');
    expect(baseRateMultiple({ score: 4, probability: 0.2, base_rate: 0.01 })).toBe('20× peers');
    expect(baseRateMultiple({ score: 4, probability: 0.2 })).toBeNull();
  });

  it('tone follows the percentile, not the raw number', () => {
    expect(scoreToneKey({ score: 4, pct_peer: 95 })).toBe('high');
    expect(scoreToneKey({ score: 4, pct_peer: 80 })).toBe('mid');
    expect(scoreToneKey({ score: 60, pct_peer: 40 })).toBe('neutral');
    expect(scoreToneKey({ score: 60, pct_peer: null })).toBe('mid');
    expect(scoreToneKey({ score: null })).toBe('none');
  });
});
