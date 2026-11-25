/**
 * EU Clinical Trials Register (EudraCT) adapter + the registry-sweep backlog schedule.
 * Fixture: trimmed from the real full-text download (page 1, Nov 2026), labels verbatim.
 */

import {
  euctrAdapter,
  impLabel,
  mapEuctrTrial,
  memberStateIso,
  mergedStatus,
  parseEuctrCursor,
  parseEuctrFullText,
  parseEuctrTotal,
  phaseFromFlags,
  type EuctrImp,
} from '@/lib/ingestion/registries/euctr';
import { planRegistryRun } from '@/lib/ingestion/registries/schedule';

const COMMERCIAL_DK = `Summary
EudraCT Number: 2008-000581-23
Sponsor's Protocol Code Number: CSPP100A2244
National Competent Authority: Denmark - DHMA
Clinical Trial Type: EEA CTA
Trial Status: Completed
Date on which this record was first entered in the EudraCT database: 2008-04-15
Link: https://www.clinicaltrialsregister.eu/ctr-search/trial/2008-000581-23/DK/

A. Protocol Information
A.1 Member State Concerned: Denmark - DHMA
A.2 EudraCT number: 2008-000581-23
A.3 Full title of the trial: A randomized, double-blind study of aliskiren in patients with hypertension
A.3 Full title of the trial (da): Et randomiseret dobbeltblindt studie af aliskiren
A.4.1 Sponsor's protocol code number: CSPP100A2244
A.5.2 US NCT (ClinicalTrials.gov registry) number: NCT00654875

B. Sponsor Information
B.Sponsor: 1
B.1.1 Name of Sponsor: Novartis Pharma AG
B.1.3.4	Country: Switzerland
B.3.1 and B.3.2	Status of the sponsor: Commercial

D. IMP Identification
D.IMP: 1
D.1.2 and D.1.3 IMP Role: Test
D.2.1 IMP to be used in the trial has a marketing authorisation: No
D.3.1 Product name: Rasilez
D.3.2 Product code: SPP100
D.3.8 to D.3.10 IMP Identification Details (Active Substances)
D.3.8 INN - Proposed INN: ALISKIREN
D.3.11.1 Active substance of chemical origin: Yes
D.3.11.2 Active substance of biological/ biotechnological origin (other than Advanced Therapy IMP (ATIMP): No
D.3.11.3 Advanced Therapy IMP (ATIMP): No
D.IMP: 2
D.1.2 and D.1.3 IMP Role: Comparator
D.2.1 IMP to be used in the trial has a marketing authorisation: Yes
D.3.1 Product name: Cozaar
D.3.8 INN - Proposed INN: LOSARTAN
D.8 Information on Placebo
D.8.1 Is a Placebo used in this Trial? Yes

E. General Information on the Trial
E.1.1 Medical condition(s) being investigated: Essential hypertension
E.1.1 Medical condition(s) being investigated (da): Essentiel hypertension
E.6.8 Bioequivalence: No
E.7.1 Human pharmacology (Phase I): No
E.7.1.2 Bioequivalence study: No
E.7.2 Therapeutic exploratory (Phase II): Yes
E.7.3 Therapeutic confirmatory (Phase III): No
E.7.4 Therapeutic use (Phase IV): No

P. End of Trial
P. End of Trial Status: Completed
P. Date of the global end of the trial: 2009-02-11
`;

const COMMERCIAL_DE = COMMERCIAL_DK
  .replace('National Competent Authority: Denmark - DHMA ', 'National Competent Authority: Germany - BfArM')
  .replace('A.1 Member State Concerned: Denmark - DHMA', 'A.1 Member State Concerned: Germany - BfArM')
  .replace('Trial Status: Completed', 'Trial Status: Ongoing')
  .replace('2008-04-15', '2008-03-02');

const NON_COMMERCIAL = `Summary
EudraCT Number: 2008-006649-18
National Competent Authority: UK - MHRA
Trial Status: Prematurely Ended
Date on which this record was first entered in the EudraCT database: 2011-11-22

A.1 Member State Concerned: UK - MHRA
A.2 EudraCT number: 2008-006649-18
A.3 Full title of the trial: CMV TCR Gene Therapy
B.1.1 Name of Sponsor: University College London
B.3.1 and B.3.2	Status of the sponsor: Non-Commercial
D.IMP: 1
D.1.2 and D.1.3 IMP Role: Test
D.2.1 IMP to be used in the trial has a marketing authorisation: No
D.3.1 Product name: CMV TCR-transduced donor T cells
D.3.11.3 Advanced Therapy IMP (ATIMP): Yes
D.3.11.3.2 Gene therapy medical product: Yes
E.7.1 Human pharmacology (Phase I): Yes
E.7.2 Therapeutic exploratory (Phase II): Yes
`;

const FILE = `This file contains full details on each clinical trial selected for download.\n\n${COMMERCIAL_DK}\n${COMMERCIAL_DE}\n${NON_COMMERCIAL}`;

describe('EU CTR full-text parsing', () => {
  const trials = parseEuctrFullText(FILE);

  it('merges member-state records into one trial each', () => {
    expect(trials.map(t => t.eudractNumber).sort()).toEqual(['2008-000581-23', '2008-006649-18']);
    const t = trials.find(x => x.eudractNumber === '2008-000581-23')!;
    expect(t.countries.sort()).toEqual(['DE', 'DK']);
    expect(t.firstEntered).toBe('2008-03-02');
    expect(t.sponsorName).toBe('Novartis Pharma AG');
    expect(t.sponsorCommercial).toBe(true);
    expect(t.sponsorCountry).toBe('Switzerland');
    expect(t.secondaryIds).toEqual(['NCT00654875']);
    expect(t.imps).toHaveLength(2);
    expect(t.conditions).toEqual(['Essential hypertension']); // English line only
    expect(t.title).toMatch(/^A randomized/);
  });

  it('maps a commercial trial to a RegistryRecord with a code (INN) test product first', () => {
    const r = mapEuctrTrial(trials.find(x => x.eudractNumber === '2008-000581-23')!)!;
    expect(r.registry).toBe('euctr');
    expect(r.sponsor_type).toBe('INDUSTRY');
    expect(r.phase).toBe('phase_2');
    expect(r.status).toBe('recruiting'); // "Ongoing" in DE outranks "Completed" in DK
    expect(r.interventions[0]).toEqual({ name: 'SPP100 (ALISKIREN)', type: 'drug', role: 'experimental' });
    expect(r.interventions[1]).toEqual({ name: 'LOSARTAN', type: 'drug', role: 'comparator' });
    expect(r.secondary_ids).toEqual(expect.arrayContaining(['NCT00654875', 'CSPP100A2244']));
    expect(r.source_url).toBe('https://www.clinicaltrialsregister.eu/ctr-search/trial/2008-000581-23/');
    expect(r.primary_completion_date).toBe('2009-02-11');
  });

  it('drops non-commercial trials', () => {
    expect(mapEuctrTrial(trials.find(x => x.eudractNumber === '2008-006649-18')!)).toBeNull();
  });
});

describe('EU CTR helpers', () => {
  const imp = (o: Partial<EuctrImp>): EuctrImp => ({ role: 'experimental', productName: null, productCode: null, sponsorCode: null, inn: null, authorised: false, type: 'drug', ...o });

  it('labels products by development code and INN', () => {
    expect(impLabel(imp({ productCode: 'BMN 673', inn: 'Talazoparib' }))).toBe('BMN 673 (Talazoparib)');
    expect(impLabel(imp({ productCode: 'N/A', inn: 'ruxolitinib', productName: 'Jakavi' }))).toBe('ruxolitinib');
    expect(impLabel(imp({ sponsorCode: 'HGT-1110' }))).toBe('HGT-1110');
    expect(impLabel(imp({ productCode: '[NA]', productName: 'NexoBrid' }))).toBe('NexoBrid');
    expect(impLabel(imp({ productCode: 'FP187', inn: 'FP187' }))).toBe('FP187');
    expect(impLabel(imp({}))).toBeNull();
  });

  it('reads phase flags and bioequivalence', () => {
    expect(phaseFromFlags(new Set([1, 2]), false)).toBe('phase_1_2');
    expect(phaseFromFlags(new Set([3]), false)).toBe('phase_3');
    expect(phaseFromFlags(new Set([4]), false)).toBe('phase_4');
    expect(phaseFromFlags(new Set([1]), true)).toBe('not_applicable');
    expect(phaseFromFlags(new Set(), false)).toBe('unknown');
  });

  it('merges statuses and member states', () => {
    expect(mergedStatus(['Completed', 'Prematurely Ended'])).toBe('completed');
    expect(mergedStatus(['GB - no longer in EU/EEA'])).toBe('unknown');
    expect(mergedStatus(['Temporarily Halted', 'Completed'])).toBe('suspended');
    expect(memberStateIso('UK - MHRA')).toBe('GB');
    expect(memberStateIso('Spain - AEMPS')).toBe('ES');
  });

  it('reads the result count and cursor', () => {
    expect(parseEuctrTotal('<div>44,416 result(s) found</div>')).toBe(44416);
    expect(parseEuctrTotal('nothing')).toBeNull();
    expect(parseEuctrCursor('{"page":3,"total":44416}')).toEqual({ page: 3, total: 44416 });
    expect(parseEuctrCursor('garbage')).toBeNull();
  });
});

describe('EU CTR fetchPage', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('reads the total once, then walks pages and stops at the last one', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('/ctr-search/search')) return new Response('<p>41 result(s) found</p>', { status: 200 });
      return new Response(FILE, { status: 200 });
    }) as unknown as typeof fetch;

    const p1 = await euctrAdapter.fetchPage(null, {});
    expect(p1.records.map(r => r.registry_id)).toEqual(['2008-000581-23']);
    expect(JSON.parse(p1.nextCursor!)).toEqual({ page: 2, total: 41 });
    expect(calls[1]).toContain('download/full?query=&page=1&mode=current_page');

    const p3 = await euctrAdapter.fetchPage(JSON.stringify({ page: 3, total: 41 }), {});
    expect(p3.done).toBe(true);
    expect(p3.nextCursor).toBeNull();

    const past = await euctrAdapter.fetchPage(JSON.stringify({ page: 4, total: 41 }), {});
    expect(past).toEqual({ records: [], nextCursor: null, done: true });
  });
});

describe('registry-sweep backlog plan', () => {
  const now = new Date('2026-12-01T02:00:00Z');

  it('dedicates backlog hours to EU CTR until its first walk completes', () => {
    expect(planRegistryRun(2, {}, now)).toEqual({ dedicated: 'euctr', exclude: ['euctr'] });
    expect(planRegistryRun(4, {}, now)).toEqual({ dedicated: null, exclude: ['euctr'] });
    expect(planRegistryRun(6, { euctr: { lastCompletedAt: null, cursor: '{"page":9,"total":44416}' } }, now).dedicated).toBe('euctr');
  });

  it('re-walks only every 90 days after completion', () => {
    expect(planRegistryRun(2, { euctr: { lastCompletedAt: '2026-11-20T00:00:00Z', cursor: null } }, now).dedicated).toBeNull();
    expect(planRegistryRun(2, { euctr: { lastCompletedAt: '2026-08-01T00:00:00Z', cursor: null } }, now).dedicated).toBe('euctr');
  });
});
