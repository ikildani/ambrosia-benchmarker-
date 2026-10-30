import { parseLiveTrial, trialChanges } from '@/lib/ingestion/ctgov-recheck';

const study = (status: string, lastUpdate: string, primary?: string, completion?: string) => ({
  protocolSection: {
    identificationModule: { nctId: 'NCT01234567' },
    statusModule: {
      overallStatus: status,
      lastUpdatePostDateStruct: { date: lastUpdate },
      ...(primary ? { primaryCompletionDateStruct: { date: primary } } : {}),
      ...(completion ? { completionDateStruct: { date: completion } } : {}),
    },
  },
});

const stored = {
  nct_id: 'NCT01234567',
  status: 'recruiting',
  last_update_posted: '2025-03-10',
  primary_completion_date: '2026-01-01',
  completion_date: '2026-06-01',
};

describe('parseLiveTrial', () => {
  it('maps CT.gov status and dates to the stored shape', () => {
    expect(parseLiveTrial(study('COMPLETED', '2026-05-15', '2026-02', '2026-04-30'))).toEqual({
      nctId: 'NCT01234567',
      live: { status: 'completed', last_update_posted: '2026-05-15', primary_completion_date: '2026-02-01', completion_date: '2026-04-30' },
    });
  });

  it('keeps UNKNOWN as unknown', () => {
    expect(parseLiveTrial(study('UNKNOWN', '2025-03-10'))?.live.status).toBe('unknown');
  });

  it('returns null for a malformed study', () => {
    expect(parseLiveTrial({})).toBeNull();
    expect(parseLiveTrial({ protocolSection: { identificationModule: { nctId: 'NCT1' } } })).toBeNull();
  });
});

describe('trialChanges', () => {
  it('returns null when CT.gov has nothing new', () => {
    const live = parseLiveTrial(study('RECRUITING', '2025-03-10', '2026-01-01', '2026-06-01'))!.live;
    expect(trialChanges(stored, live)).toBeNull();
  });

  it('catches a status flip that kept the old update date', () => {
    const live = parseLiveTrial(study('UNKNOWN', '2025-03-10', '2026-01-01', '2026-06-01'))!.live;
    expect(trialChanges(stored, live)).toEqual({ status: 'unknown' });
  });

  it('takes a newer update date and new completion dates', () => {
    const live = parseLiveTrial(study('COMPLETED', '2026-05-15', '2026-02-01', '2026-04-30'))!.live;
    expect(trialChanges(stored, live)).toEqual({
      status: 'completed',
      last_update_posted: '2026-05-15',
      primary_completion_date: '2026-02-01',
      completion_date: '2026-04-30',
    });
  });

  it('never moves the update date backwards', () => {
    const live = parseLiveTrial(study('RECRUITING', '2024-01-01', '2026-01-01', '2026-06-01'))!.live;
    expect(trialChanges(stored, live)).toBeNull();
  });
});
