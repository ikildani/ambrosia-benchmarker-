/**
 * CRIS — Clinical Research Information Service (Korea Disease Control and
 * Prevention Agency; WHO primary registry for Korea). Complements MFDS
 * approvals: CRIS carries investigator-initiated and academic trials, MFDS
 * carries IND approvals.
 *
 * Endpoints (no auth; verified Sep 2026):
 *   GET https://cris.nih.go.kr/cris/search/detailSearch.do?seq={n}&search_page=L
 *       Server-rendered bilingual page (Korean labels; values carry 국문/영문
 *       Korean/English pairs). seq is the internal sequential id (~26,000 in 2026);
 *       KCT ids (KCT0008639) live in the page. Unknown seq returns the search page.
 *   Open API: data.go.kr lists a "질병관리청_임상연구정보서비스(CRIS)" service, but the
 *       guessed path https://apis.data.go.kr/1352159/crisinfo/getCrisInfo returns
 *       NO_OPENAPI_SERVICE_ERROR (code 12); the exact service path must be copied from
 *       the data.go.kr listing after subscribing (set CRIS_API_URL + MFDS_API_KEY —
 *       data.go.kr keys are per-account, not per-service). Until then the HTML path is used.
 * Labels parsed (verified on seq=25000): "CRIS등록번호" → KCT id; "연구제목" → 국문/영문 title;
 *   "최초제출일" (first submitted), "검토/등록일" (registered), "최종갱신일" (last updated);
 *   "전체연구모집현황" (overall recruitment status, e.g. "모집 중(Recruiting)");
 *   "첫 연구대상자 등록일" (first enrolment date), "연구종료일" (study end);
 *   "연구책임기관" → "기관명" → 영문 (responsible organisation = sponsor), "기관종류"
 *   (organisation type, e.g. "제약회사 (Pharmaceutical Company)", "의료기관 (Medical Institute)");
 *   "연구비지원기관" → "기관명" → 영문 (funder); "식약처규제연구" (MFDS-regulated: 예(Yes)/아니오(No));
 *   "타등록시스템 등록여부" (registered elsewhere) + NCT ids anywhere on the page.
 *   Unverified labels (design section): "연구종류" (study type), "임상시험단계"/"임상시험 단계"
 *   (phase), "중재종류" (intervention type), "중재명"/"중재 상세설명" (intervention),
 *   "질환명"/"대상질환" (condition).
 * License   KDCA public data (공공누리 Type 1: attribution).
 * Reach     ~11,000 KCT records; ~1,200 industry-sponsored drug trials.
 * Rate      we use 700 ms between requests.
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, RegistryIntervention } from './types';
import {
  classifySponsorClass,
  compact,
  extractSecondaryIds,
  htmlToTokens,
  makeIntervention,
  mapRegistryPhase,
  mapRegistryStatus,
  normalizeRegistryDate,
  registryFetch,
  sleep,
  tokenAfter,
  tokenIndex,
  uniq,
} from './shared';

const BASE = () => process.env.CRIS_BASE_URL ?? 'https://cris.nih.go.kr/cris/search/detailSearch.do';
const DEFAULT_START_SEQ = 20_000; // ~2021 onward
const MISS_STREAK_STOP = 40;

export interface CrisRaw {
  seq: number;
  html: string;
}

/** English value of a 국문/영문 pair that follows `label` (falls back to Korean). */
function bilingualAfter(tokens: string[], label: string | RegExp, from = 0): { ko: string | null; en: string | null; index: number } {
  const i = tokenIndex(tokens, label, from);
  if (i === -1) return { ko: null, en: null, index: -1 };
  let ko: string | null = null;
  let en: string | null = null;
  for (let j = i + 1; j < Math.min(tokens.length, i + 8); j++) {
    if (tokens[j] === '국문' && tokens[j + 1]) { ko = tokens[j + 1]; j++; continue; }
    if (tokens[j] === '영문' && tokens[j + 1]) { en = tokens[j + 1]; break; }
    if (ko || en) break;
  }
  return { ko, en, index: i };
}

function englishPart(s: string | null): string | null {
  if (!s) return null;
  const m = /\(([^()]+)\)\s*$/.exec(s);
  return m ? m[1].trim() : s;
}

export function mapCrisHtml(raw: CrisRaw): RegistryRecord {
  const tokens = htmlToTokens(raw.html);
  const kct = tokenAfter(tokens, 'CRIS등록번호') ?? (/KCT\d{7}/.exec(raw.html)?.[0] ?? String(raw.seq));
  const title = bilingualAfter(tokens, '연구제목');
  const statusRaw = tokenAfter(tokens, '전체연구모집현황');
  const startRaw = tokenAfter(tokens, '첫 연구대상자 등록일');
  const endRaw = tokenAfter(tokens, '연구종료일');
  const submitted = tokenAfter(tokens, '최초제출일');
  const registered = tokenAfter(tokens, '검토/등록일');
  const updated = tokenAfter(tokens, '최종갱신일');
  const mfdsRegulated = tokenAfter(tokens, '식약처규제연구');

  // Sponsor = 연구책임기관 (responsible organisation); funder = 연구비지원기관
  const sponsorSection = tokenIndex(tokens, /^\d+\.\s*연구책임기관$/);
  const sponsorName = sponsorSection !== -1 ? bilingualAfter(tokens, '기관명', sponsorSection) : { ko: null, en: null, index: -1 };
  const sponsorType = sponsorSection !== -1 ? tokenAfter(tokens, '기관종류', { from: sponsorSection }) : null;
  const funderSection = tokenIndex(tokens, /^\d+\.\s*연구비지원기관$/);
  const funderName = funderSection !== -1 ? bilingualAfter(tokens, '기관명', funderSection) : { ko: null, en: null, index: -1 };
  const funderType = funderSection !== -1 ? tokenAfter(tokens, '기관종류', { from: funderSection }) : null;

  let sponsor = sponsorName.en ?? sponsorName.ko;
  let sponsorClass = classifySponsorClass(sponsor, englishPart(sponsorType));
  const collaborators: string[] = [];
  const funder = funderName.en ?? funderName.ko;
  if (funder && funder !== sponsor) {
    // A pharmaceutical funder of an academic responsible organisation is the asset owner.
    if (sponsorClass !== 'INDUSTRY' && classifySponsorClass(funder, englishPart(funderType)) === 'INDUSTRY') {
      collaborators.push(sponsor ?? '');
      sponsor = funder;
      sponsorClass = 'INDUSTRY';
    } else {
      collaborators.push(funder);
    }
  }

  // Design section (labels unverified — matched loosely)
  const phaseRaw = tokenAfter(tokens, /^임상시험\s*단계$/) ?? tokenAfter(tokens, /^Phase$/i);
  const studyTypeRaw = tokenAfter(tokens, /^연구종류$/);
  const interventionTypeRaw = tokenAfter(tokens, /^중재종류$/);
  const interventions: RegistryIntervention[] = [];
  const ivName = bilingualAfter(tokens, /^중재명$/);
  const ivText = tokenAfter(tokens, /^중재\s*상세설명$/) ?? (ivName.index !== -1 ? ivName.en ?? ivName.ko : null);
  const drugType = interventionTypeRaw && /의약품|drug|biolog/i.test(interventionTypeRaw) ? 'drug' : interventionTypeRaw ? englishPart(interventionTypeRaw)?.toLowerCase() ?? 'unknown' : mfdsRegulated && /예|yes/i.test(mfdsRegulated) ? 'drug' : 'unknown';
  if (ivText) {
    const iv = makeIntervention(ivText.slice(0, 160), drugType, 'experimental');
    if (iv) interventions.push(iv);
  }
  const condition = bilingualAfter(tokens, /^질환명$/);
  const conditions = compact([condition.en ?? condition.ko, tokenAfter(tokens, /^대상질환$/)]);

  const secondaryIds = uniq(extractSecondaryIds(tokens.join(' '))).filter(s => s !== kct);
  const studyType = studyTypeRaw ? (/중재|interven/i.test(studyTypeRaw) ? 'interventional' : /관찰|observ/i.test(studyTypeRaw) ? 'observational' : englishPart(studyTypeRaw)?.toLowerCase() ?? null) : null;

  return {
    registry: 'cris',
    registry_id: kct,
    secondary_ids: secondaryIds,
    title: title.en ?? title.ko,
    sponsor_name: sponsor,
    sponsor_type: sponsorClass,
    collaborators: compact(collaborators),
    interventions,
    conditions,
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status: mapRegistryStatus(englishPart(statusRaw) ?? statusRaw),
    study_type: studyType,
    countries: ['KR'],
    start_date: normalizeRegistryDate(startRaw),
    primary_completion_date: normalizeRegistryDate(endRaw),
    first_registered: normalizeRegistryDate(registered) ?? normalizeRegistryDate(submitted),
    last_updated: normalizeRegistryDate(updated),
    source_url: `${BASE()}?seq=${raw.seq}&search_page=L`,
    raw: { format: 'cris_html_tokens', seq: raw.seq, mfds_regulated: mfdsRegulated, sponsor_type_raw: sponsorType, funder_type_raw: funderType, tokens: tokens.slice(0, 500) },
  };
}

interface CrisCursor {
  nextSeq: number;
  missStreak: number;
}

function parseCursor(cursor: string | null): CrisCursor {
  if (!cursor) return { nextSeq: DEFAULT_START_SEQ, missStreak: 0 };
  try {
    const c = JSON.parse(cursor) as Partial<CrisCursor>;
    return { nextSeq: Math.max(1, Number(c.nextSeq) || DEFAULT_START_SEQ), missStreak: Number(c.missStreak) || 0 };
  } catch {
    const n = Number(cursor);
    return { nextSeq: Number.isFinite(n) && n > 0 ? n : DEFAULT_START_SEQ, missStreak: 0 };
  }
}

export const crisAdapter: RegistryAdapter<CrisRaw> = {
  registry: 'cris',
  displayName: 'CRIS (Korea)',
  countryScope: ['KR'],
  license: 'KDCA public data (KOGL Type 1, attribution)',
  capability: 'api',
  transport: 'html',
  verified: 'partial',
  rateLimitMs: 700,
  defaultLimit: 30,
  estimatedReach: 11_000,
  urls: {
    search: 'https://cris.nih.go.kr/cris/search/listSearch.do',
    detail: id => `https://cris.nih.go.kr/cris/search/detailSearch.do?search_lang=E&focus=reset_12&search_page=M&pageSize=10&page=1&seq=${id}`,
  },

  mapRecord(raw: CrisRaw): RegistryRecord {
    return mapCrisHtml(raw);
  },

  /** Cursor: {"nextSeq":n,"missStreak":k}; same id-walk contract as IRCT. */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const c = parseCursor(cursor);
    const limit = Math.min(opts.limit ?? this.defaultLimit, 150);
    const records: RegistryRecord[] = [];
    const warnings: string[] = [];
    let seq = c.nextSeq;
    let missStreak = c.missStreak;
    let firstMiss: number | null = null;
    for (let i = 0; i < limit; i++, seq++) {
      if (opts.signal?.aborted) break;
      try {
        const res = await registryFetch(`${BASE()}?seq=${seq}&search_page=L`, { signal: opts.signal, timeoutMs: 25_000, retries: 0 });
        const html = res.ok ? await res.text() : '';
        if (res.ok && /KCT\d{7}/.test(html) && /CRIS등록번호/.test(html)) {
          missStreak = 0;
          firstMiss = null;
          records.push(mapCrisHtml({ seq, html }));
        } else if (res.ok || res.status === 404) {
          missStreak++;
          if (firstMiss === null) firstMiss = seq;
        } else {
          warnings.push(`CRIS ${seq}: HTTP ${res.status}`);
        }
      } catch (err) {
        warnings.push(`CRIS ${seq}: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (missStreak >= MISS_STREAK_STOP) {
        return { records, nextCursor: JSON.stringify({ nextSeq: firstMiss ?? seq, missStreak: 0 } satisfies CrisCursor), done: true, warnings };
      }
      await sleep(this.rateLimitMs);
    }
    return { records, nextCursor: JSON.stringify({ nextSeq: seq, missStreak } satisfies CrisCursor), done: false, warnings };
  },
};

export default crisAdapter;
