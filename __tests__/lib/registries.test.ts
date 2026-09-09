/**
 * Ex-CT.gov registry adapters + shared mapper (Asset Radar Phase 2 item 5).
 * No network: every adapter's mapRecord runs on a hand-written fixture and
 * the mapper runs against an in-memory Supabase stand-in.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  activeStatusByDate,
  classifySponsorClass,
  extractSecondaryIds,
  htmlToTokens,
  isDrugTrial,
  mapRegistryPhase,
  mapRegistryStatus,
  normalizeRegistryDate,
  toIso2,
  tokenAfter,
  xmlAll,
  xmlAttr,
  xmlBlocks,
  xmlFirst,
} from '@/lib/ingestion/registries/shared';
import {
  REGISTRY_ADAPTERS,
  companyTrialKey,
  cursorSource,
  getRegistryAdapter,
  ingestRegistryRecords,
  normalizeSponsorName,
  runRegistrySweep,
  sponsorLookupKeys,
  sweepableAdapters,
  type AnyRegistryAdapter,
} from '@/lib/ingestion/registries';
import { NotImplementedError, type RegistryRecord, type ScrapedPage } from '@/lib/ingestion/registries/types';
import { mapIsrctnFullTrial } from '@/lib/ingestion/registries/isrctn';
import { mapCtisRecord } from '@/lib/ingestion/registries/ctis';
import { mapHealthCanadaRecord, phaseFromTitle } from '@/lib/ingestion/registries/health-canada';
import { mapIrctXml } from '@/lib/ingestion/registries/irct';
import { extractRebecCodes, extractRebecInternalId, mapRebecXml } from '@/lib/ingestion/registries/rebec';
import { drksId, mapDrksHtml } from '@/lib/ingestion/registries/drks';
import { mapJrctHtml } from '@/lib/ingestion/registries/jrct';
import { mapCrisHtml } from '@/lib/ingestion/registries/cris';
import { mapMfdsItem } from '@/lib/ingestion/registries/mfds';
import { mapAnzctrXml } from '@/lib/ingestion/registries/anzctr';
import { mapPactrPage } from '@/lib/ingestion/registries/pactr';
import { mapMyTrialPage } from '@/lib/ingestion/registries/mytrial';
import { mapCdePage, translateCdeStatus } from '@/lib/ingestion/registries/cde';
import { mapChictrPage } from '@/lib/ingestion/registries/chictr';
import { mapCtriPage } from '@/lib/ingestion/registries/ctri';

const NOW = new Date('2026-09-08T12:00:00Z');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ISRCTN_XML = `<allTrials totalCount="1" xmlns="http://www.67bricks.com/isrctn"><fullTrial>
  <trial lastUpdated="2026-09-08T10:00:22.861Z" version="3" isPublished="true" publicIdentifierType="isrctn" publicIdentifierCanonical="ISRCTN15819396">
    <isrctn dateAssigned="2026-02-01T12:00:00.000Z">15819396</isrctn>
    <trialDescription>
      <title>KJ-103 in TROP2-positive solid tumours</title>
      <scientificTitle>A Phase I/II study of KJ-103 alone and with pembrolizumab</scientificTitle>
    </trialDescription>
    <externalRefs>
      <doi>10.1186/ISRCTN15819396</doi><eudraCTNumber/><irasNumber>1012337</irasNumber>
      <clinicalTrialsGovNumber>NCT06000001</clinicalTrialsGovNumber>
      <secondaryNumbers><secondaryNumber id="x" numberType="iras" canonicalSecondaryNumber="IRAS1012337">1012337</secondaryNumber></secondaryNumbers>
    </externalRefs>
    <trialDesign><primaryStudyDesign>Interventional</primaryStudyDesign><overallEndDate>2029-09-01T00:00:00.000Z</overallEndDate></trialDesign>
    <participants>
      <recruitmentCountries><country>United Kingdom</country><country>England</country></recruitmentCountries>
      <recruitmentStart>2026-03-01T00:00:00.000Z</recruitmentStart><recruitmentEnd>2028-03-01T00:00:00.000Z</recruitmentEnd>
    </participants>
    <conditions><condition><description>Advanced solid tumours &amp; HNSCC</description><diseaseClass1>Cancer</diseaseClass1></condition></conditions>
    <interventions><intervention>
      <description>KJ-103 IV weekly in 21-day cycles alongside SoC pembrolizumab</description>
      <interventionType>Drug</interventionType><phase>Phase I/II</phase><drugNames>KJ-103, pembrolizumab</drugNames>
    </intervention></interventions>
    <parties><funderId>f1</funderId><funderId>f2</funderId><sponsorId>s1</sponsorId></parties>
  </trial>
  <sponsor id="s1"><organisation>Cancer Research UK</organisation><sponsorType/><commercialStatus>Non-commercial</commercialStatus></sponsor>
  <funder id="f1"><name>Cancer Research UK</name></funder>
  <funder id="f2"><name>Kisoji Biotechnology Inc.</name></funder>
</fullTrial></allTrials>`;

const CTIS_RAW = {
  hit: {
    ctNumber: '2026-525215-13-00', ctStatus: 2, ctTitle: 'Study of RO7654321 in Advanced Solid Tumors',
    trialCountries: ['France:2', 'Italy:1'], decisionDateOverall: '07/09/2026', sponsor: 'F. Hoffmann-La Roche AG',
    sponsorType: 'Pharmaceutical company', trialPhase: 'Human Pharmacology (Phase I)- First administration to humans',
    product: 'RO7654321', lastUpdated: '08/09/2026',
  },
  detail: {
    ctNumber: '2026-525215-13-00', ctStatus: 'Authorised', ctPublicStatusCode: 2,
    decisionDate: '2026-09-07T09:43:18.016', publishDate: '2026-09-09T03:30:57.751',
    authorizedApplication: {
      applicationInfo: [{ submissionDate: '2026-05-21', status: 'Authorised' }],
      memberStatesConcerned: [{ mscName: 'France' }, { mscName: 'Italy' }],
      authorizedPartsII: [{ mscInfo: { countryName: 'France', trialStatus: 'Authorised' } }],
      authorizedPartI: {
        sponsors: [{
          primary: true, isCommercial: true,
          organisation: { name: 'F. Hoffmann-La Roche AG', type: 'Pharmaceutical company', typeCode: '10', commercial: true },
          addresses: [{ address: { country: 756 } }],
        }],
        products: [
          { productName: 'RO7654321', mpRoleInTrial: '1', jsonActiveSubstanceNames: 'ro7654321' },
          { productName: 'PEMBROLIZUMAB', mpRoleInTrial: '2' },
        ],
        medicalConditions: [{ medicalCondition: 'Advanced Solid Tumors' }],
        therapeuticAreas: [{ name: 'Diseases [C] - Neoplasms [C04]' }],
        trialDetails: {
          clinicalTrialIdentifiers: {
            fullTitle: 'A Phase I, first-in-human study of RO7654321',
            secondaryIdentifyingNumbers: { additionalRegistries: [{ registry: 'ClinicalTrials.gov', number: 'NCT07000002' }] },
          },
          trialInformation: {
            trialCategory: { trialPhase: '1' },
            trialDuration: { estimatedRecruitmentStartDate: '2026-09-10', estimatedEndDate: '2031-08-31' },
          },
        },
      },
    },
  },
};

const HC_RAW = {
  protocol: {
    protocol_id: 29510, protocol_no: 'CAIN457 A2317', submission_no: '172035', status_id: 1,
    start_date: '2015-04-14', end_date: '2016-06-28', nol_date: '2014-03-07',
    protocol_title: 'A 52-WEEK, MULTICENTER, RANDOMIZED, DOUBLE-BLIND, PHASE III STUDY OF SECUKINUMAB IN PLAQUE PSORIASIS',
    medConditionList: [{ med_condition_id: 12, med_condition: 'PLAQUE PSORIASIS' }],
  },
  products: [
    { protocol_id: 29510, brand_id: 1, manufacturer_id: 7, manufacturer_name: 'NOVARTIS PHARMACEUTICALS CANADA INC', brand_name: 'SECUKINUMAB (AIN457)' },
    { protocol_id: 29510, brand_id: 2, manufacturer_id: 7, manufacturer_name: 'NOVARTIS PHARMACEUTICALS CANADA INC', brand_name: 'PLACEBO' },
  ],
  statusLabel: 'ONGOING',
};

const IRCT_XML = `<?xml version="1.0" encoding="utf-8"?>
<trials><trial>
  <main>
    <trial_id>IRCT20230122057183N1</trial_id><utrn></utrn><reg_name>IRCT</reg_name>
    <date_registration>2023-08-12</date_registration>
    <primary_sponsor>CinnaGen Co.</primary_sponsor>
    <public_title>CinnoRA versus Humira in rheumatoid arthritis</public_title>
    <scientific_title>A randomized, double-blind study comparing CinnoRA (adalimumab biosimilar) with Humira</scientific_title>
    <date_enrolment>2023-05-12</date_enrolment><target_size>120</target_size>
    <recruitment_status>Recruiting</recruitment_status>
    <url>https://irct.ir/trial/70000</url>
    <study_type>interventional</study_type><phase>2</phase>
    <hc_freetext>Rheumatoid arthritis</hc_freetext>
    <i_freetext>CinnoRA 40 mg every other week versus Humira 40 mg</i_freetext>
  </main>
  <countries><country2>Iran</country2></countries>
  <intervention_code><i_code>Drug</i_code></intervention_code>
  <intervention_keyword><i_keyword>CinnoRA (adalimumab biosimilar)</i_keyword></intervention_keyword>
  <health_condition_keyword><hc_keyword>Rheumatoid arthritis</hc_keyword></health_condition_keyword>
  <secondary_ids><secondary_id><sec_id>NCT05000003</sec_id><issuing_authority>ClinicalTrials.gov</issuing_authority></secondary_id></secondary_ids>
  <source_support><source_name>CinnaGen Co.</source_name></source_support>
</trial></trials>`;

const REBEC_XML = `<?xml version="1.0"?><root><trials><trial>
  <main>
    <trial_id>RBR-74547s2</trial_id><utrn>U1111-1342-6778</utrn><reg_name>REBEC</reg_name>
    <date_registration>08/09/2026</date_registration>
    <primary_sponsor>Universidade Federal de São Paulo - UNIFESP</primary_sponsor>
    <public_title>Laser therapy in chronic skin wounds</public_title>
    <scientific_title>Comparison between two Photobiomodulation techniques in chronic lesions</scientific_title>
    <date_enrolment>30/10/2026</date_enrolment><target_size>78</target_size>
    <recruitment_status>Not yet recruiting</recruitment_status>
    <url>https://ensaiosclinicos.gov.br/rg/RBR-74547s2</url>
    <study_type>Intervention</study_type><phase>N/A</phase>
    <hc_freetext>Diabetic Foot; Skin Ulcer</hc_freetext>
    <i_freetext>Photobiomodulation twice a week for five weeks.</i_freetext>
    <results_date_completed>30/05/2029</results_date_completed>
  </main>
  <countries><country2>Brazil</country2></countries>
  <intervention_code><i_code>Other</i_code></intervention_code>
</trial></trials></root>`;

const DRKS_HTML = `<html><head><title>German Clinical Trials Register</title><script>var x = "<div>ignored</div>";</script></head><body>
<h1>Evaluation of ABC-123 in patients with rectal cancer</h1>
<div>DRKS-ID:</div><div>DRKS00033000</div>
<div>Recruitment Status:</div><div>Recruiting ongoing</div>
<div>Date of registration in DRKS:</div><div>2023-11-07</div>
<div>Last update in DRKS:</div><div>2026-01-05</div>
<div>Health condition or problem studied</div><div>ICD-10-GM (translation):</div><div>C20 - Malignant neoplasm of rectum</div>
<div>Interventions, Observational Groups</div>
<div>Arm 1:</div><div>ABC-123 200 mg tablet once daily for 12 weeks</div>
<div>Arm 2:</div><div>Placebo tablet once daily for 12 weeks</div>
<div>Endpoints</div><div>Primary outcome:</div><div>complete remission rate</div>
<div>Study type:</div><div>Interventional</div>
<div>Phase:</div><div>II</div>
<div>Recruitment countries:</div><div>Germany, Austria</div>
<div>Planned study start date:</div><div>2024-01-01</div>
<div>Actual study start date:</div><div>2024-02-01</div>
<div>Planned study completion date:</div><div>2025-12-31</div>
<div>Primary Sponsor</div><div>Address:</div><div>Acme Pharma GmbH</div><div>Musterstr. 1</div><div>10115 Berlin</div><div>Germany</div>
<div>Investigator Sponsored/Initiated Trial (IST/IIT):</div><div>No</div>
<div>Other WHO Primary Registry or Data Provider ID:</div><div>NCT06123456</div>
<div>EudraCT Number:</div><div>2022-501234-11-00</div>
<div>UTN (Universal Trial Number):</div><div>No Entry</div>
</body></html>`;

const JRCT_HTML = `<html><body><table>
<tr><th>Date of registration</th><td>Aug. 06, 2019</td></tr>
<tr><th>Last modified on</th><td>April. 27, 2024</td></tr>
<tr><th>Trial ID</th><td>jRCT2080224823</td></tr>
<tr><th>Scientific Title</th><td>An Open-Label Study to Evaluate the Long-Term Safety and Efficacy of Evinacumab in Patients With HoFH</td></tr>
<tr><th>Public Title</th><td>Evaluate Evinacumab in HoFH</td></tr>
<tr><th>Recruitment Status</th><td>completed</td></tr>
<tr><th>Date of First Enrolment</th><td>Oct. 01, 2019</td></tr>
<tr><th>Study Type</th><td>Interventional</td></tr>
<tr><th>Phase</th><td>3</td></tr>
<tr><th>Health Condition or Problem Studied</th><td>Homozygous Familial Hypercholesterolemia</td></tr>
<tr><th>Intervention(s)</th><td>investigational material(s)</td></tr>
<tr><td>Generic name etc : Evinacumab</td></tr>
<tr><td>INN of investigational material : Evinacumab</td></tr>
<tr><td>control material(s)</td></tr>
<tr><td>Generic name etc : -</td></tr>
<tr><th>Primary Sponsor</th><td>Regeneron Pharmaceuticals, Inc.</td></tr>
<tr><th>Secondary Sponsor</th><td>-</td></tr>
<tr><th>Name of Funding Organization</th><td>Regeneron Pharmaceuticals, Inc.</td></tr>
<tr><th>Secondary ID No.</th><td>NCT03409744</td></tr>
<tr><th>Name of Other Registries</th><td>ClinicalTrials.gov</td></tr>
<tr><th>Secondary ID No.</th><td>JapicCTI-194906</td></tr>
<tr><th>Countries / Regions of Recruitment</th><td>Japan/North America/Europe</td></tr>
<tr><th>Completion Date or Terminated date</th><td>April. 13, 2023</td></tr>
</table></body></html>`;

const CRIS_HTML = `<html><body>
<div>CRIS등록번호</div><div>KCT0008639</div>
<div>연구제목</div><div>국문</div><div>비소세포폐암 환자에서 HL-001의 2상 연구</div><div>영문</div><div>A Phase 2 study of HL-001 in NSCLC</div>
<div>최초제출일</div><div>2023/06/12</div>
<div>검토/등록일</div><div>2023/07/24</div>
<div>최종갱신일</div><div>2024/03/20</div>
<div>전체연구모집현황</div><div>모집 중(Recruiting)</div>
<div>첫 연구대상자 등록일</div><div>2023-06-16 실제등록(Actual)</div>
<div>연구종료일</div><div>2025-06-16 , 예정(Anticipated)</div>
<div>5. 연구비지원기관</div><div>1. 연구비지원기관</div><div>기관명</div><div>국문</div><div>(주)한올바이오파마</div><div>영문</div><div>HanAll Biopharma</div><div>기관종류</div><div>제약회사 (Pharmaceutical Company)</div>
<div>6. 연구책임기관</div><div>1. 연구책임기관</div><div>기관명</div><div>국문</div><div>연세대학교의료원</div><div>영문</div><div>Yonsei University Health System</div><div>기관종류</div><div>의료기관 (Medical Institute)</div>
<div>식약처규제연구</div><div>예(Yes)</div>
<div>연구종류</div><div>중재연구(Interventional Study)</div>
<div>임상시험단계</div><div>Phase2</div>
<div>중재종류</div><div>의약품(Drug)</div>
<div>중재 상세설명</div><div>HL-001 100mg orally twice daily for 12 weeks</div>
<div>타등록시스템 등록여부</div><div>예(Yes)</div><div>NCT05555555</div>
</body></html>`;

const MFDS_ITEM = {
  CLINIC_EXAM_TITLE: 'A Phase 1 study of HM12345 in healthy volunteers',
  APPLY_ENTP_NAME: 'Hanmi Pharm. Co., Ltd.',
  GOODS_NAME: 'HM12345',
  APPROVAL_TIME: '2026-08-20',
  CLINIC_STEP_NAME: '1상',
  APPROVAL_NO: '31234',
  LAB_NAME: 'Seoul National University Hospital',
};

const ANZCTR_XML = `<ANZCTR_Trial><actrn>ACTRN12624000123456</actrn><stage>Registered</stage>
<submitdate>12/01/2024</submitdate><approvaldate>15/01/2024</approvaldate><dateLastUpdated>03/03/2026</dateLastUpdated>
<utrn>U1111-1300-0001</utrn><publictitle>XYZ-9 in melanoma</publictitle><scientifictitle>A Phase 2 study of XYZ-9 in advanced melanoma</scientifictitle>
<secondaryid>NCT06222222</secondaryid>
<conditions><condition><conditionname>Melanoma</conditionname></condition></conditions>
<interventions><intervention><interventioncode>Treatment: Drugs</interventioncode><interventiondescription>XYZ-9 300 mg oral daily</interventiondescription></intervention></interventions>
<phase>Phase 2</phase><studytype>Interventional</studytype><recruitmentstatus>Recruiting</recruitmentstatus>
<anticipatedstartdate>01/03/2024</anticipatedstartdate><actualstartdate>05/03/2024</actualstartdate><anticipatedenddate>30/06/2027</anticipatedenddate>
<recruitmentcountry>Australia</recruitmentcountry><recruitmentcountry>New Zealand</recruitmentcountry>
<sponsorship><primarysponsortype>Commercial sector/Industry</primarysponsortype><primarysponsorname>Kinetic Oncology Pty Ltd</primarysponsorname><fundingsourcename>Kinetic Oncology Pty Ltd</fundingsourcename></sponsorship>
</ANZCTR_Trial>`;

// ─── Supabase stand-in ───────────────────────────────────────────────────────

interface Call {
  table: string;
  op: string;
  payload?: unknown;
  options?: unknown;
  filters: Array<[string, string, unknown]>;
  select?: string;
  single?: 'single' | 'maybe';
}
type Handler = (call: Call) => { data?: unknown; error?: { message: string } | null } | undefined;

function mockSupabase(handler: Handler): { client: SupabaseClient; calls: Call[] } {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select(s?: string) { call.select = s; return b; },
      upsert(p: unknown, o?: unknown) { call.op = 'upsert'; call.payload = p; call.options = o; return b; },
      insert(p: unknown) { call.op = 'insert'; call.payload = p; return b; },
      update(p: unknown) { call.op = 'update'; call.payload = p; return b; },
      delete() { call.op = 'delete'; return b; },
      eq(c: string, v: unknown) { call.filters.push(['eq', c, v]); return b; },
      in(c: string, v: unknown) { call.filters.push(['in', c, v]); return b; },
      ilike(c: string, v: unknown) { call.filters.push(['ilike', c, v]); return b; },
      contains(c: string, v: unknown) { call.filters.push(['contains', c, v]); return b; },
      limit(n: number) { call.filters.push(['limit', '', n]); return b; },
      maybeSingle() { call.single = 'maybe'; return b; },
      single() { call.single = 'single'; return b; },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
        calls.push(call);
        let r: ReturnType<Handler>;
        try {
          r = handler(call) ?? {};
        } catch (e) {
          return Promise.reject(e).then(resolve, reject);
        }
        let data = r.data ?? (call.op === 'select' || call.select ? [] : null);
        if (call.single) data = Array.isArray(data) ? data[0] ?? null : data;
        return Promise.resolve({ data, error: r.error ?? null }).then(resolve, reject);
      },
    };
    return b;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

describe('shared: xml helpers', () => {
  it('extracts blocks, text, attributes and decodes entities', () => {
    const xml = '<r><a x="1">one &amp; two</a><a>three</a><b/><c><d>nested</d></c></r>';
    expect(xmlBlocks(xml, 'a')).toHaveLength(2);
    expect(xmlFirst(xml, 'a')).toBe('one & two');
    expect(xmlAll(xml, 'a')).toEqual(['one & two', 'three']);
    expect(xmlFirst(xml, 'b')).toBeNull();
    expect(xmlFirst(xml, 'c')).toBe('nested');
    expect(xmlAttr(xml, 'a', 'x')).toBe('1');
  });

  it('tokenizes html label/value pairs', () => {
    const tokens = htmlToTokens('<div>Phase:</div><div>II</div><script>bad()</script><p>Sponsor</p><p>Acme &amp; Co</p>');
    expect(tokens).toEqual(['Phase:', 'II', 'Sponsor', 'Acme & Co']);
    expect(tokenAfter(tokens, 'Phase')).toBe('II');
    expect(tokenAfter(tokens, 'Sponsor')).toBe('Acme & Co');
    expect(tokenAfter(tokens, 'Missing')).toBeNull();
  });
});

describe('shared: phase mapping table', () => {
  const cases: Array<[string | number | null, string]> = [
    ['Phase 1', 'phase_1'], ['Phase I', 'phase_1'], ['1상', 'phase_1'], ['제1상', 'phase_1'], [1, 'phase_1'],
    ['Human Pharmacology (Phase I)- Bioequivalence Study', 'phase_1'],
    ['Phase I/II', 'phase_1_2'], ['Phase 1/2a', 'phase_1_2'], ['Phase I and Phase II (Integrated)- Other', 'phase_1_2'], ['1/2상', 'phase_1_2'],
    ['Therapeutic exploratory (Phase II)', 'phase_2'], ['Phase 2b', 'phase_2'], ['II', 'phase_2'], ['Phase2', 'phase_2'],
    ['Phase 2/ Phase 3', 'phase_2_3'], ['Phase II/III', 'phase_2_3'],
    ['Therapeutic confirmatory  (Phase III)', 'phase_3'], ['3', 'phase_3'], ['Phase III', 'phase_3'],
    ['Therapeutic use (Phase IV)', 'phase_4'], ['Phase 4', 'phase_4'],
    ['Early Phase 1', 'early_phase_1'], ['Phase 0', 'early_phase_1'],
    ['N/A', 'not_applicable'], ['Not applicable', 'not_applicable'], ['Not Applicable', 'not_applicable'],
    [null, 'unknown'], ['', 'unknown'], ['연구자임상', 'unknown'],
  ];
  it.each(cases)('maps %p → %s', (raw, expected) => {
    expect(mapRegistryPhase(raw)).toBe(expected);
  });
});

describe('shared: status mapping table', () => {
  const cases: Array<[string | null, string]> = [
    ['Recruiting', 'recruiting'], ['Recrutando', 'recruiting'], ['모집 중(Recruiting)', 'recruiting'], ['Recruiting ongoing', 'recruiting'], ['Ongoing', 'recruiting'],
    ['Not yet recruiting', 'not_yet_recruiting'], ['Pending', 'not_yet_recruiting'], ['Under evaluation', 'not_yet_recruiting'], ['Ainda não recrutando', 'not_yet_recruiting'],
    ['Active, not recruiting', 'active_not_recruiting'], ['Closed to recruitment of participants', 'active_not_recruiting'], ['Recruiting complete, follow-up continuing', 'active_not_recruiting'],
    ['Enrolling by invitation', 'enrolling_by_invitation'],
    ['Completed', 'completed'], ['Complete', 'completed'], ['Recruiting complete, study complete', 'completed'], ['CLOSED', 'completed'], ['Ended', 'completed'],
    ['Terminated', 'terminated'], ['Recruiting stopped after recruiting started', 'terminated'], ['Stopped', 'terminated'],
    ['Suspended', 'suspended'], ['Temporarily halted', 'suspended'],
    ['Withdrawn', 'withdrawn'], ['Not authorised', 'withdrawn'], ['Revoked', 'withdrawn'],
    ['Authorised', 'recruiting'],
    [null, 'unknown'], ['???', 'unknown'],
  ];
  it.each(cases)('maps %p → %s', (raw, expected) => {
    expect(mapRegistryStatus(raw)).toBe(expected);
  });

  it('derives recruiting vs not_yet_recruiting from the start date', () => {
    expect(activeStatusByDate('2026-01-01', NOW)).toBe('recruiting');
    expect(activeStatusByDate('2026-12-01', NOW)).toBe('not_yet_recruiting');
    expect(activeStatusByDate(null, NOW)).toBe('recruiting');
  });
});

describe('shared: dates, countries, ids, sponsor class', () => {
  it('normalizes registry date formats', () => {
    expect(normalizeRegistryDate('2026-09-08T10:00:22.861Z')).toBe('2026-09-08');
    expect(normalizeRegistryDate('08/09/2026')).toBe('2026-09-08');
    expect(normalizeRegistryDate('08/09/2026', { monthFirst: true })).toBe('2026-08-09');
    expect(normalizeRegistryDate('2023/07/24')).toBe('2023-07-24');
    expect(normalizeRegistryDate('16.03.2024')).toBe('2024-03-16');
    expect(normalizeRegistryDate('Aug. 06, 2019')).toBe('2019-08-06');
    expect(normalizeRegistryDate('April. 27, 2024')).toBe('2024-04-27');
    expect(normalizeRegistryDate('Sept. 29, 2023')).toBe('2023-09-29');
    expect(normalizeRegistryDate('2023-06-16 실제등록(Actual)')).toBe('2023-06-16');
    expect(normalizeRegistryDate('2024-05')).toBe('2024-05-01');
    expect(normalizeRegistryDate('2024')).toBe('2024-01-01');
    expect(normalizeRegistryDate('No Entry')).toBeNull();
    expect(normalizeRegistryDate(null)).toBeNull();
  });

  it('maps country names and ISO numeric codes', () => {
    expect(toIso2('United Kingdom')).toBe('GB');
    expect(toIso2('England')).toBe('GB');
    expect(toIso2('France:2')).toBe('FR');
    expect(toIso2(756)).toBe('CH');
    expect(toIso2('Korea, Republic of')).toBe('KR');
    expect(toIso2('Atlantis')).toBeNull();
  });

  it('extracts cross-registry identifiers', () => {
    const ids = extractSecondaryIds('see NCT01234567, EudraCT 2022-501234-11-00, ISRCTN12345678, ACTRN12624000123456, jRCT2080224823, CTRI/2023/01/048888, KCT0008639, U1111-1342-6778, ChiCTR2300070000');
    expect(ids).toEqual(expect.arrayContaining(['NCT01234567', '2022-501234-11-00', 'ISRCTN12345678', 'ACTRN12624000123456', 'jRCT2080224823', 'CTRI/2023/01/048888', 'KCT0008639', 'U1111-1342-6778', 'ChiCTR2300070000']));
  });

  it('classifies sponsors into CT.gov-style classes', () => {
    expect(classifySponsorClass('F. Hoffmann-La Roche AG', 'Pharmaceutical company')).toBe('INDUSTRY');
    expect(classifySponsorClass('Kisoji Biotechnology Inc.')).toBe('INDUSTRY');
    expect(classifySponsorClass('CinnaGen Co.')).toBe('INDUSTRY');
    expect(classifySponsorClass('Cancer Research UK', 'Non-commercial')).toBe('OTHER');
    expect(classifySponsorClass('Universitätsklinikum Jena')).toBe('OTHER');
    expect(classifySponsorClass('Yonsei University Health System', 'Medical Institute')).toBe('OTHER');
    expect(classifySponsorClass('Ministry of Health Israel')).toBe('OTHER_GOV');
    expect(classifySponsorClass('IQVIA RDS Inc.')).toBe('CRO');
    expect(classifySponsorClass('PAREXEL International')).toBe('CRO');
    expect(classifySponsorClass(null)).toBe('UNKNOWN');
  });
});

// ─── Adapters ────────────────────────────────────────────────────────────────

describe('adapter registry', () => {
  it('exposes all 15 adapters with the required metadata', () => {
    const ids = Object.keys(REGISTRY_ADAPTERS).sort();
    expect(ids).toEqual(['anzctr', 'cde', 'chictr', 'cris', 'ctis', 'ctri', 'drks', 'health_canada', 'irct', 'isrctn', 'jrct', 'mfds', 'mytrial', 'pactr', 'rebec']);
    for (const a of Object.values(REGISTRY_ADAPTERS) as AnyRegistryAdapter[]) {
      expect(a.countryScope.length).toBeGreaterThan(0);
      expect(a.license).toBeTruthy();
      expect(['api', 'bulk', 'scrape_required']).toContain(a.capability);
      expect(a.urls.detail('X')).toMatch(/^https?:\/\//);
      expect(a.estimatedReach).toBeGreaterThan(0);
    }
    expect(getRegistryAdapter('health-canada')?.registry).toBe('health_canada');
    expect(getRegistryAdapter('nope')).toBeNull();
  });

  it('sweepable adapters exclude scrape_required and env-gated ones', () => {
    const ids = sweepableAdapters({} as NodeJS.ProcessEnv).map(a => a.registry).sort();
    expect(ids).toEqual(['cris', 'ctis', 'drks', 'health_canada', 'irct', 'isrctn', 'jrct', 'rebec']);
    const withKeys = sweepableAdapters({ MFDS_API_KEY: 'k', ANZCTR_API_USER: 'u', ANZCTR_API_PASSWORD: 'p' } as NodeJS.ProcessEnv).map(a => a.registry);
    expect(withKeys).toEqual(expect.arrayContaining(['mfds', 'anzctr']));
  });

  it('scrape_required adapters throw NotImplementedError from fetchPage', async () => {
    for (const id of ['pactr', 'mytrial', 'cde', 'chictr', 'ctri'] as const) {
      await expect(REGISTRY_ADAPTERS[id].fetchPage(null, {})).rejects.toBeInstanceOf(NotImplementedError);
      expect(REGISTRY_ADAPTERS[id].capability).toBe('scrape_required');
    }
  });

  it('company_trials key format is <REGISTRY>:<id>', () => {
    expect(companyTrialKey('isrctn', '12345678')).toBe('ISRCTN:12345678');
    expect(companyTrialKey('ctis', '2024-512345-12-00')).toBe('CTIS:2024-512345-12-00');
    expect(companyTrialKey('anzctr', 'ACTRN12624000123456')).toBe('ANZCTR:ACTRN12624000123456');
    expect(companyTrialKey('health_canada', '29510')).toBe('HEALTH_CANADA:29510');
    expect(cursorSource('ctis')).toBe('registry:ctis');
  });
});

describe('ISRCTN adapter', () => {
  const rec = mapIsrctnFullTrial(xmlBlocks(ISRCTN_XML, 'fullTrial')[0], NOW);
  it('maps the fullTrial XML', () => {
    expect(rec.registry).toBe('isrctn');
    expect(rec.registry_id).toBe('15819396');
    expect(rec.title).toBe('A Phase I/II study of KJ-103 alone and with pembrolizumab');
    expect(rec.phase).toBe('phase_1_2');
    expect(rec.interventions.map(i => i.name)).toEqual(['KJ-103', 'pembrolizumab']);
    expect(rec.interventions[0].type).toBe('drug');
    expect(rec.conditions).toEqual(['Advanced solid tumours & HNSCC', 'Cancer']);
    expect(rec.countries).toEqual(['GB']);
    expect(rec.secondary_ids).toEqual(expect.arrayContaining(['NCT06000001', 'IRAS1012337']));
    expect(rec.first_registered).toBe('2026-02-01');
    expect(rec.last_updated).toBe('2026-09-08');
    expect(rec.start_date).toBe('2026-03-01');
    expect(rec.primary_completion_date).toBe('2029-09-01');
    expect(rec.status).toBe('recruiting');
    expect(rec.status_raw).toBe('derived:dates');
    expect(rec.study_type).toBe('interventional');
    expect(rec.source_url).toBe('https://www.isrctn.com/ISRCTN15819396');
  });
  it('reassigns a non-commercial sponsor to its single industry funder', () => {
    expect(rec.sponsor_name).toBe('Kisoji Biotechnology Inc.');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.collaborators).toContain('Cancer Research UK');
    expect((rec.raw as { sponsor_reassigned_from_funder: boolean }).sponsor_reassigned_from_funder).toBe(true);
  });
  it('mapRecord on the adapter object agrees', () => {
    expect(REGISTRY_ADAPTERS.isrctn.mapRecord(xmlBlocks(ISRCTN_XML, 'fullTrial')[0]).registry_id).toBe('15819396');
  });
});

describe('CTIS adapter', () => {
  const rec = mapCtisRecord(CTIS_RAW, NOW);
  it('maps search hit + retrieve payload', () => {
    expect(rec.registry_id).toBe('2026-525215-13-00');
    expect(rec.title).toBe('A Phase I, first-in-human study of RO7654321');
    expect(rec.sponsor_name).toBe('F. Hoffmann-La Roche AG');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.interventions).toEqual([
      { name: 'RO7654321', type: 'drug', role: 'experimental' },
      { name: 'PEMBROLIZUMAB', type: 'drug', role: 'comparator' },
    ]);
    expect(rec.phase).toBe('phase_1');
    expect(rec.status).toBe('not_yet_recruiting'); // authorised, recruitment starts after NOW
    expect(rec.countries).toEqual(['FR', 'IT']);
    expect(rec.secondary_ids).toEqual(['NCT07000002']);
    expect(rec.start_date).toBe('2026-09-10');
    expect(rec.primary_completion_date).toBe('2031-08-31');
    expect(rec.first_registered).toBe('2026-05-21');
    expect(rec.last_updated).toBe('2026-09-09');
    expect((rec.raw as { sponsor_country: string }).sponsor_country).toBe('CH');
    expect(rec.source_url).toBe('https://euclinicaltrials.eu/ctis-public/view/2026-525215-13-00');
  });
  it('degrades to search-hit data when retrieve is missing', () => {
    const lite = mapCtisRecord({ hit: CTIS_RAW.hit, detail: null }, NOW);
    expect(lite.sponsor_name).toBe('F. Hoffmann-La Roche AG');
    expect(lite.interventions).toEqual([{ name: 'RO7654321', type: 'drug', role: 'unknown' }]);
    expect(lite.phase).toBe('phase_1');
    expect(lite.countries).toEqual(['FR', 'IT']);
    expect(lite.status).toBe('recruiting');
    expect(lite.last_updated).toBe('2026-09-08');
  });
  it('marks all-member-states-ended trials completed', () => {
    const ended = JSON.parse(JSON.stringify(CTIS_RAW)) as typeof CTIS_RAW;
    ended.detail.authorizedApplication.authorizedPartsII = [{ mscInfo: { countryName: 'France', trialStatus: 'Ended' } }];
    expect(mapCtisRecord(ended, NOW).status).toBe('completed');
  });
});

describe('Health Canada adapter', () => {
  const rec = mapHealthCanadaRecord(HC_RAW, NOW);
  it('parses phase from the protocol title', () => {
    expect(phaseFromTitle('A PHASE IIA, INTERNATIONAL STUDY')).toBe('Phase IIA');
    expect(phaseFromTitle('PHASE 2/3 STUDY')).toBe('Phase 2/3');
    expect(phaseFromTitle('OBSERVATIONAL STUDY')).toBeNull();
    expect(mapRegistryPhase('Phase IIA')).toBe('phase_2');
  });
  it('joins protocol + drug products', () => {
    expect(rec.registry_id).toBe('29510');
    expect(rec.sponsor_name).toBe('Novartis Pharmaceuticals Canada Inc');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.interventions).toEqual([
      { name: 'SECUKINUMAB (AIN457)', type: 'drug', role: 'experimental' },
      { name: 'PLACEBO', type: 'drug', role: 'placebo' },
    ]);
    expect(rec.phase).toBe('phase_3');
    expect(rec.status).toBe('recruiting');
    expect(rec.conditions).toEqual(['Plaque Psoriasis']);
    expect(rec.secondary_ids).toEqual(['CAIN457 A2317']);
    expect(rec.countries).toEqual(['CA']);
    expect(rec.first_registered).toBe('2014-03-07');
    expect(rec.title).toMatch(/^A 52-Week, Multicenter/);
  });
});

describe('IRCT adapter (ICTRP XML)', () => {
  const rec = mapIrctXml({ internalId: 70000, xml: IRCT_XML });
  it('maps the ICTRP export', () => {
    expect(rec.registry).toBe('irct');
    expect(rec.registry_id).toBe('IRCT20230122057183N1');
    expect(rec.sponsor_name).toBe('CinnaGen Co.');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.phase).toBe('phase_2');
    expect(rec.status).toBe('recruiting');
    expect(rec.interventions).toEqual([{ name: 'CinnoRA (adalimumab biosimilar)', type: 'drug', role: 'experimental' }]);
    expect(rec.conditions).toEqual(['Rheumatoid arthritis']);
    expect(rec.countries).toEqual(['IR']);
    expect(rec.secondary_ids).toContain('NCT05000003');
    expect(rec.first_registered).toBe('2023-08-12');
    expect(rec.start_date).toBe('2023-05-12');
    expect(rec.study_type).toBe('interventional');
    expect(rec.source_url).toBe('https://en.irct.ir/trial/70000');
    expect(isDrugTrial(rec)).toBe(true);
  });
});

describe('ReBEC adapter (ICTRP XML)', () => {
  it('maps DD/MM/YYYY dates and non-drug trials', () => {
    const rec = mapRebecXml({ code: 'RBR-74547s2', internalId: 17022, xml: REBEC_XML });
    expect(rec.registry_id).toBe('RBR-74547s2');
    expect(rec.first_registered).toBe('2026-09-08');
    expect(rec.start_date).toBe('2026-10-30');
    expect(rec.primary_completion_date).toBe('2029-05-30');
    expect(rec.phase).toBe('not_applicable');
    expect(rec.status).toBe('not_yet_recruiting');
    expect(rec.sponsor_type).toBe('OTHER');
    expect(rec.countries).toEqual(['BR']);
    expect(rec.secondary_ids).toContain('U1111-1342-6778');
    expect(isDrugTrial(rec)).toBe(false);
  });
  it('finds codes on list pages and the internal xml id on detail pages', () => {
    expect(extractRebecCodes('<a href="/rg/RBR-10vpgvfs">x</a><a href="/rg/RBR-4f5qndb">y</a><a href="/rg/RBR-10vpgvfs">z</a>')).toEqual(['RBR-10vpgvfs', 'RBR-4f5qndb']);
    expect(extractRebecInternalId('<a href="https://ensaiosclinicos.gov.br/xml_ictrp/downloadxmlictrp/18587">XML</a>')).toBe(18587);
  });
});

describe('DRKS adapter (HTML)', () => {
  const rec = mapDrksHtml({ id: 'DRKS00033000', html: DRKS_HTML }, NOW);
  it('maps the labelled trial page', () => {
    expect(drksId(33000)).toBe('DRKS00033000');
    expect(rec.registry_id).toBe('DRKS00033000');
    expect(rec.title).toBe('Evaluation of ABC-123 in patients with rectal cancer');
    expect(rec.status).toBe('recruiting');
    expect(rec.phase).toBe('phase_2');
    expect(rec.study_type).toBe('interventional');
    expect(rec.countries).toEqual(['DE', 'AT']);
    expect(rec.sponsor_name).toBe('Acme Pharma GmbH');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.interventions).toEqual([
      { name: 'ABC-123 200 mg tablet once daily for 12 weeks', type: 'drug', role: 'experimental' },
      { name: 'Placebo tablet once daily for 12 weeks', type: 'drug', role: 'placebo' },
    ]);
    expect(rec.conditions).toEqual(['C20 - Malignant neoplasm of rectum']);
    expect(rec.secondary_ids).toEqual(expect.arrayContaining(['NCT06123456', '2022-501234-11-00']));
    expect(rec.start_date).toBe('2024-02-01');
    expect(rec.primary_completion_date).toBe('2025-12-31');
    expect(rec.first_registered).toBe('2023-11-07');
    expect(rec.last_updated).toBe('2026-01-05');
    expect(isDrugTrial(rec)).toBe(true);
  });
});

describe('jRCT adapter (HTML)', () => {
  const rec = mapJrctHtml({ id: 'jRCT2080224823', html: JRCT_HTML });
  it('maps the English detail page', () => {
    expect(rec.registry_id).toBe('jRCT2080224823');
    expect(rec.title).toMatch(/^An Open-Label Study/);
    expect(rec.phase).toBe('phase_3');
    expect(rec.status).toBe('completed');
    expect(rec.sponsor_name).toBe('Regeneron Pharmaceuticals, Inc.');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.collaborators).toEqual([]);
    expect(rec.interventions).toEqual([{ name: 'Evinacumab', type: 'drug', role: 'experimental' }]);
    expect(rec.conditions).toEqual(['Homozygous Familial Hypercholesterolemia']);
    expect(rec.secondary_ids).toEqual(expect.arrayContaining(['NCT03409744', 'JapicCTI-194906']));
    expect(rec.countries).toEqual(['JP']);
    expect(rec.first_registered).toBe('2019-08-06');
    expect(rec.last_updated).toBe('2024-04-27');
    expect(rec.start_date).toBe('2019-10-01');
    expect(rec.primary_completion_date).toBe('2023-04-13');
  });
});

describe('CRIS adapter (HTML)', () => {
  const rec = mapCrisHtml({ seq: 25000, html: CRIS_HTML });
  it('maps Korean labels with English values', () => {
    expect(rec.registry_id).toBe('KCT0008639');
    expect(rec.title).toBe('A Phase 2 study of HL-001 in NSCLC');
    expect(rec.status).toBe('recruiting');
    expect(rec.phase).toBe('phase_2');
    expect(rec.study_type).toBe('interventional');
    expect(rec.start_date).toBe('2023-06-16');
    expect(rec.primary_completion_date).toBe('2025-06-16');
    expect(rec.first_registered).toBe('2023-07-24');
    expect(rec.last_updated).toBe('2024-03-20');
    expect(rec.interventions).toEqual([{ name: 'HL-001 100mg orally twice daily for 12 weeks', type: 'drug', role: 'experimental' }]);
    expect(rec.secondary_ids).toEqual(['NCT05555555']);
    expect(rec.countries).toEqual(['KR']);
  });
  it('promotes a pharmaceutical funder over an academic responsible organisation', () => {
    expect(rec.sponsor_name).toBe('HanAll Biopharma');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.collaborators).toEqual(['Yonsei University Health System']);
  });
});

describe('MFDS adapter (data.go.kr JSON)', () => {
  it('maps an approval item', () => {
    const rec = mapMfdsItem(MFDS_ITEM, NOW);
    expect(rec.registry_id).toBe('31234');
    expect(rec.sponsor_name).toBe('Hanmi Pharm. Co., Ltd.');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.phase).toBe('phase_1');
    expect(rec.status).toBe('not_yet_recruiting');
    expect(rec.interventions).toEqual([{ name: 'HM12345', type: 'drug', role: 'experimental' }]);
    expect(rec.first_registered).toBe('2026-08-20');
    expect(rec.countries).toEqual(['KR']);
  });
  it('fetchPage refuses to run without MFDS_API_KEY', async () => {
    const prev = process.env.MFDS_API_KEY;
    delete process.env.MFDS_API_KEY;
    await expect(REGISTRY_ADAPTERS.mfds.fetchPage(null, {})).rejects.toThrow(/MFDS_API_KEY/);
    if (prev) process.env.MFDS_API_KEY = prev;
  });
});

describe('ANZCTR adapter (XML)', () => {
  it('maps the ANZCTR trial XML', () => {
    const rec = mapAnzctrXml({ actrn: 'ACTRN12624000123456', xml: ANZCTR_XML });
    expect(rec.registry_id).toBe('ACTRN12624000123456');
    expect(rec.sponsor_name).toBe('Kinetic Oncology Pty Ltd');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.phase).toBe('phase_2');
    expect(rec.status).toBe('recruiting');
    expect(rec.interventions).toEqual([{ name: 'XYZ-9 300 mg oral daily', type: 'drug', role: 'experimental' }]);
    expect(rec.countries).toEqual(['AU', 'NZ']);
    expect(rec.secondary_ids).toEqual(expect.arrayContaining(['NCT06222222', 'U1111-1300-0001']));
    expect(rec.start_date).toBe('2024-03-05');
    expect(rec.first_registered).toBe('2024-01-15');
    expect(rec.last_updated).toBe('2026-03-03');
  });
  it('fetchPage refuses to run without credentials', async () => {
    delete process.env.ANZCTR_API_USER;
    await expect(REGISTRY_ADAPTERS.anzctr.fetchPage(null, {})).rejects.toThrow(/ANZCTR_API_USER/);
  });
});

describe('scrape_required stubs map worker pages', () => {
  it('PACTR', () => {
    const page: ScrapedPage = {
      id: 'PACTR202301234567890', url: 'https://pactr.samrc.ac.za/TrialDisplay.aspx?TrialID=1',
      fields: { 'Trial ID': 'PACTR202301234567890', 'Scientific title': 'Phase 3 malaria vaccine', 'Primary sponsor': 'Sanofi Pasteur', 'Primary sponsor type': 'Commercial',
        'Intervention name': ['R21/Matrix-M', 'Rabies vaccine'], 'Intervention type': ['Drug', 'Drug'], 'Group name': ['Experimental', 'Control'],
        'Phase': 'Phase 3', 'Recruitment status': 'Recruiting', 'Countries of recruitment': 'Kenya, Ghana', 'Secondary identifying numbers': 'NCT04704830', 'Date of registration': '2023-01-15' },
    };
    const rec = mapPactrPage(page);
    expect(rec.registry_id).toBe('PACTR202301234567890');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.interventions[1].role).toBe('comparator');
    expect(rec.phase).toBe('phase_3');
    expect(rec.countries).toEqual(['KE', 'GH']);
    expect(rec.secondary_ids).toContain('NCT04704830');
  });
  it('MyTrial', () => {
    const rec = mapMyTrialPage({ id: 'MOH_2024-01-01_012345', url: '', fields: { 'MOH Number': 'MOH_2024-01-01_012345', 'Trial Name': 'ABC in psoriasis', Sponsor: 'Kamada Ltd', 'Product Name': 'KMD-101', Phase: 'Phase 2', Status: 'Recruiting', 'Approval Date': '15/02/2024', 'NCT Number': 'NCT06111111' } });
    expect(rec.registry_id).toBe('MOH_2024-01-01_012345');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.phase).toBe('phase_2');
    expect(rec.countries).toEqual(['IL']);
    expect(rec.first_registered).toBe('2024-02-15');
    expect(rec.secondary_ids).toContain('NCT06111111');
  });
  it('CDE', () => {
    expect(translateCdeStatus('进行中（招募中）')).toBe('recruiting');
    const rec = mapCdePage({ id: 'CTR20230001', url: '', fields: { '登记号': 'CTR20230001', '试验专业题目': 'HRS-1234 在晚期实体瘤中的I期研究', '申办者': '江苏恒瑞医药股份有限公司', '药物名称': 'HRS-1234', '药物类型': '化学药物', '适应症': '晚期实体瘤', '试验分期': 'I期', '试验状态': '进行中（招募中）', '首次公示信息日期': '2023-02-01' } });
    expect(rec.registry_id).toBe('CTR20230001');
    expect(rec.phase).toBe('phase_1');
    expect(rec.status).toBe('recruiting');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.interventions).toEqual([{ name: 'HRS-1234', type: 'drug', role: 'experimental' }]);
    expect(rec.countries).toEqual(['CN']);
  });
  it('ChiCTR', () => {
    const rec = mapChictrPage({ id: 'ChiCTR2300070000', url: '', fields: { 'Registration number': 'ChiCTR2300070000', 'Scientific title': 'X in Y', 'Primary sponsor': 'Peking Union Medical College Hospital', Group: ['Experimental', 'Control'], Intervention: ['Drug A 10 mg', 'Placebo'], 'Intervention code': 'Drug', 'Study phase': 'Phase II', 'Recruiting status': 'Recruiting', 'Date of Registration': '2023-03-01' } });
    expect(rec.phase).toBe('phase_2');
    expect(rec.sponsor_type).toBe('OTHER');
    expect(rec.interventions.map(i => i.role)).toEqual(['experimental', 'comparator']);
  });
  it('CTRI', () => {
    const rec = mapCtriPage({ id: 'CTRI/2023/01/048888', url: '', fields: { 'CTRI Number': 'CTRI/2023/01/048888', 'Scientific Title of Study': 'Z in diabetes', 'Primary Sponsor': "Dr. Reddy's Laboratories Ltd", 'Type of Sponsor': 'Pharmaceutical industry-Indian', 'Intervention Name': ['DRL-9', 'Placebo'], 'Intervention Type': ['Intervention', 'Comparator Agent'], 'Phase of Trial': 'Phase 2/ Phase 3', 'Recruitment Status of Trial (India)': 'Open to Recruitment', 'Countries of Recruitment': 'India', 'Secondary ID': 'NCT05999999', 'Date of Registration': '10/01/2023' } });
    expect(rec.phase).toBe('phase_2_3');
    expect(rec.status).toBe('recruiting');
    expect(rec.sponsor_type).toBe('INDUSTRY');
    expect(rec.interventions[1].role).toBe('placebo');
    expect(rec.secondary_ids).toContain('NCT05999999');
    expect(rec.first_registered).toBe('2023-01-10');
  });
});

// ─── Sponsor normalization ───────────────────────────────────────────────────

describe('sponsor normalization contract', () => {
  it('strips diacritics, punctuation and legal suffixes', () => {
    expect(normalizeSponsorName('F. Hoffmann-La Roche AG')).toBe('f hoffmann la roche');
    expect(normalizeSponsorName('NOVARTIS PHARMACEUTICALS CANADA INC')).toBe('novartis pharmaceuticals canada');
    expect(normalizeSponsorName('Regeneron Pharmaceuticals, Inc.')).toBe('regeneron pharmaceuticals');
    expect(normalizeSponsorName('Universitätsklinikum Jena')).toBe('universitatsklinikum jena');
    expect(normalizeSponsorName('Hanmi Pharm. Co., Ltd.')).toBe('hanmi pharm');
    expect(normalizeSponsorName('Johnson & Johnson')).toBe('johnson and johnson');
  });
  it('yields country-stripped and sector-stripped lookup keys', () => {
    expect(sponsorLookupKeys('NOVARTIS PHARMACEUTICALS CANADA INC')).toEqual(['novartis pharmaceuticals canada', 'novartis pharmaceuticals', 'novartis']);
    expect(sponsorLookupKeys('Merck Canada Inc')).toEqual(['merck canada', 'merck']);
    expect(sponsorLookupKeys('')).toEqual([]);
  });
});

// ─── Mapper ──────────────────────────────────────────────────────────────────

function isrctnRecord(): RegistryRecord {
  return mapIsrctnFullTrial(xmlBlocks(ISRCTN_XML, 'fullTrial')[0], NOW);
}

describe('ingestRegistryRecords', () => {
  it('bridges to an existing CT.gov row instead of creating a second company_trials row', async () => {
    const { client, calls } = mockSupabase(call => {
      if (call.table === 'company_trials' && call.op === 'select') {
        expect(call.filters).toEqual([['in', 'nct_id', ['NCT06000001']]]);
        return { data: [{ id: 'ct-1', nct_id: 'NCT06000001' }] };
      }
      if (call.table === 'registry_trials' && call.op === 'upsert') {
        return { data: (call.payload as unknown[]).map((_, i) => ({ id: `rt-${i}` })) };
      }
      return {};
    });
    const result = await ingestRegistryRecords(client, [isrctnRecord()]);
    expect(result).toMatchObject({ fetched: 1, stored: 1, bridged: 1, mapped: 0, skipped: 0, companiesCreated: 0, errors: [] });
    expect(calls.some(c => c.table === 'company_trials' && c.op === 'upsert')).toBe(false);
    expect(calls.some(c => c.table === 'companies')).toBe(false);
    const rt = calls.find(c => c.table === 'registry_trials' && c.op === 'upsert')!;
    expect(rt.options).toEqual({ onConflict: 'registry,registry_id' });
    const row = (rt.payload as Record<string, unknown>[])[0];
    expect(row).toMatchObject({ registry: 'isrctn', registry_id: '15819396', mapped_company_trial_id: 'ct-1', map_status: 'bridged:NCT06000001', phase: 'phase_1_2', status: 'recruiting' });
    expect(row.secondary_ids).toContain('NCT06000001');
  });

  it('creates the company, upserts company_trials keyed REGISTRY:id, degrades missing columns, writes interventions', async () => {
    let companyTrialsAttempts = 0;
    const { client, calls } = mockSupabase(call => {
      if (call.table === 'company_trials' && call.op === 'select') return { data: [] };
      if (call.table === 'sponsor_aliases') return { error: { message: 'relation "public.sponsor_aliases" does not exist' } };
      if (call.table === 'companies' && call.op === 'select') return { data: [] };
      if (call.table === 'companies' && call.op === 'upsert') {
        const row = (call.payload as Record<string, unknown>[])[0];
        return { data: [{ id: 'co-1', name: row.name }] };
      }
      if (call.table === 'company_trials' && call.op === 'upsert') {
        companyTrialsAttempts++;
        const rows = call.payload as Record<string, unknown>[];
        if (rows.some(r => 'registry' in r)) return { error: { message: "Could not find the 'registry' column of 'company_trials' in the schema cache" } };
        return { data: rows.map(r => ({ id: 'ct-9', nct_id: r.nct_id })) };
      }
      if (call.table === 'trial_interventions') return { data: null };
      if (call.table === 'registry_trials' && call.op === 'upsert') return { data: [{ id: 'rt-0' }] };
      return {};
    });
    const record = isrctnRecord();
    record.secondary_ids = record.secondary_ids.filter(s => !s.startsWith('NCT'));
    const result = await ingestRegistryRecords(client, [record]);
    expect(result).toMatchObject({ fetched: 1, stored: 1, bridged: 0, mapped: 1, skipped: 0, companiesCreated: 1, errors: [], droppedColumns: ['registry'] });
    expect(companyTrialsAttempts).toBe(2);

    const companyUpsert = calls.find(c => c.table === 'companies' && c.op === 'upsert')!;
    const companyRow = (companyUpsert.payload as Record<string, unknown>[])[0];
    expect(companyRow).toMatchObject({ name: 'Kisoji Biotechnology Inc.', actively_acquiring: false, data_sources: ['registry:isrctn'], owner_type: 'industry', hq_country: 'GB' });
    expect(companyUpsert.options).toEqual({ onConflict: 'name' });

    const ctUpserts = calls.filter(c => c.table === 'company_trials' && c.op === 'upsert');
    const finalRow = (ctUpserts[1].payload as Record<string, unknown>[])[0];
    expect(finalRow).toMatchObject({
      company_id: 'co-1', nct_id: 'ISRCTN:15819396', phase: 'phase_1_2', status: 'recruiting', intervention_name: 'KJ-103',
      intervention_type: 'DRUG', lead_sponsor_type: 'INDUSTRY', lead_sponsor_class: 'INDUSTRY', locations_countries: ['GB'], study_type: 'interventional',
    });
    expect(finalRow).not.toHaveProperty('registry');
    expect(ctUpserts[1].options).toEqual({ onConflict: 'company_id,nct_id' });

    // migration 106 schema, shared with the CT.gov sweep: keyed on the
    // registry-prefixed company_trials key + normalized name, upserted.
    const ivUpsert = calls.find(c => c.table === 'trial_interventions' && c.op === 'upsert')!;
    expect((ivUpsert.payload as Record<string, unknown>[]).map(({ updated_at: _u, ...r }) => r)).toEqual([
      { nct_id: 'ISRCTN:15819396', company_id: 'co-1', name: 'KJ-103', name_normalized: 'kj 103', intervention_type: 'drug', arm_role: 'experimental', is_primary_asset: true },
      { nct_id: 'ISRCTN:15819396', company_id: 'co-1', name: 'pembrolizumab', name_normalized: 'pembrolizumab', intervention_type: 'drug', arm_role: 'experimental', is_primary_asset: false },
    ]);

    const rt = calls.find(c => c.table === 'registry_trials' && c.op === 'upsert')!;
    expect((rt.payload as Record<string, unknown>[])[0]).toMatchObject({ mapped_company_trial_id: 'ct-9', map_status: 'mapped' });
  });

  it('resolves via sponsor_aliases when present and never creates a company', async () => {
    const { client, calls } = mockSupabase(call => {
      if (call.table === 'company_trials' && call.op === 'select') return { data: [] };
      if (call.table === 'sponsor_aliases') {
        expect(call.filters).toEqual([['eq', 'sponsor_name_normalized', 'kisoji biotechnology'], ['limit', '', 1]]);
        return { data: [{ company_id: 'co-alias', sponsor_name: 'Kisoji Biotechnology', relationship: 'self' }] };
      }
      if (call.table === 'company_trials' && call.op === 'upsert') return { data: (call.payload as Record<string, unknown>[]).map(r => ({ id: 'ct-2', nct_id: r.nct_id })) };
      if (call.table === 'registry_trials' && call.op === 'upsert') return { data: [{ id: 'rt-0' }] };
      return {};
    });
    const record = isrctnRecord();
    record.secondary_ids = [];
    const result = await ingestRegistryRecords(client, [record]);
    expect(result.mapped).toBe(1);
    expect(result.companiesCreated).toBe(0);
    expect(calls.some(c => c.table === 'companies')).toBe(false);
    const ct = calls.find(c => c.table === 'company_trials' && c.op === 'upsert')!;
    expect((ct.payload as Record<string, unknown>[])[0].company_id).toBe('co-alias');
  });

  it('skips CRO sponsors and non-drug trials but still stores them in registry_trials', async () => {
    const { client, calls } = mockSupabase(call => {
      if (call.table === 'registry_trials' && call.op === 'upsert') return { data: (call.payload as unknown[]).map((_, i) => ({ id: `rt-${i}` })) };
      if (call.table === 'company_trials' && call.op === 'select') return { data: [] };
      return {};
    });
    const cro = isrctnRecord();
    cro.secondary_ids = [];
    cro.sponsor_name = 'IQVIA RDS Inc.';
    cro.sponsor_type = 'CRO';
    const nonDrug = mapRebecXml({ code: 'RBR-74547s2', internalId: 17022, xml: REBEC_XML });
    const result = await ingestRegistryRecords(client, [cro, nonDrug]);
    expect(result).toMatchObject({ fetched: 2, stored: 2, mapped: 0, skipped: 2 });
    expect(calls.some(c => c.table === 'companies' || (c.table === 'company_trials' && c.op === 'upsert'))).toBe(false);
    const rows = calls.find(c => c.table === 'registry_trials')!.payload as Record<string, unknown>[];
    expect(rows.map(r => r.map_status)).toEqual(['skipped:cro_sponsor', 'skipped:not_drug_trial']);
  });
});

// ─── Sweep runner ────────────────────────────────────────────────────────────

describe('runRegistrySweep', () => {
  function fakeAdapter(pages: Array<{ records: RegistryRecord[]; nextCursor: string | null; done: boolean }>): AnyRegistryAdapter {
    let i = 0;
    return {
      ...REGISTRY_ADAPTERS.isrctn,
      fetchPage: jest.fn(async () => pages[Math.min(i++, pages.length - 1)]),
    };
  }

  it('pages until done, ingests, and persists the cursor + completion state', async () => {
    const { client, calls } = mockSupabase(call => {
      if (call.table === 'radar_sync_cursors' && call.op === 'select') return { data: [] };
      if (call.table === 'radar_sync_cursors' && call.op === 'upsert') return { data: null };
      if (call.table === 'company_trials' && call.op === 'select') return { data: [{ id: 'ct-1', nct_id: 'NCT06000001' }] };
      if (call.table === 'registry_trials' && call.op === 'upsert') return { data: (call.payload as unknown[]).map((_, i) => ({ id: `rt-${i}` })) };
      return {};
    });
    const adapter = fakeAdapter([
      { records: [isrctnRecord()], nextCursor: '2026-09-01T00:00:00', done: false },
      { records: [], nextCursor: '2026-09-08T00:00:00', done: true },
    ]);
    const result = await runRegistrySweep(client, adapter, { budgetMs: 10_000, limit: 5 });
    expect(result).toMatchObject({ registry: 'isrctn', pages: 2, done: true, cursor: '2026-09-08T00:00:00', fetched: 1, bridged: 1, timedOut: false, errors: [] });
    expect(adapter.fetchPage).toHaveBeenCalledTimes(2);
    const write = calls.find(c => c.table === 'radar_sync_cursors' && c.op === 'upsert')!;
    const payload = write.payload as { source: string; cursor: string | null; state: { last_completed_at?: string } };
    expect(payload.source).toBe('registry:isrctn');
    expect(payload.cursor).toBe('2026-09-08T00:00:00');
    expect(payload.state.last_completed_at).toBeTruthy();
  });

  it('records unavailable adapters without touching the cursor', async () => {
    const { client, calls } = mockSupabase(call => (call.table === 'radar_sync_cursors' && call.op === 'select' ? { data: [] } : {}));
    const result = await runRegistrySweep(client, REGISTRY_ADAPTERS.pactr, { budgetMs: 1000 });
    expect(result.unavailable).toMatch(/not implemented/);
    expect(result.pages).toBe(0);
    expect(calls.some(c => c.table === 'radar_sync_cursors' && c.op === 'upsert')).toBe(false);
  });
});
