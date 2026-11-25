/**
 * Free (no-AI) screen in front of every deal extraction. Nov 23 2026.
 *
 * Each source keeps its own title rule (lib/ingestion/exchanges/*.ts, the EFTS
 * query, the newswire keyword list). Those rules let through titles that carry
 * a deal word but are never a new deal, and the extractor was paid to say so
 * again on every run: in the week to Nov 23, 272 HKEX "not a deal" verdicts
 * covered 6 documents and 160 DART verdicts covered 6 (share-pledge reports,
 * supply contracts, milestone receipts, a digital-asset licence).
 *
 * Two checks, both measured on history before they were added:
 *   1. title: patterns for announcements that carry a deal word but are not a
 *      new licensing/M&A deal (terminations, payment receipts, renewals,
 *      litigation, non-pharma licences, share pledges, supply-only contracts);
 *   2. body: the fetched text must carry at least one life-science word, which
 *      drops the non-pharma issuers the HKEX title search returns.
 *
 * Patterns use only syntax JavaScript and Postgres regular expressions share
 * (alternation, classes, `.*`), so the same strings are measured in SQL
 * against the deals table and the ingestion logs (see the PR for the queries).
 */

/** Titles that carry a deal word but announce no new deal. Case-insensitive. */
export const NON_DEAL_TITLE_PATTERNS: ReadonlyArray<{ code: string; re: string }> = [
  // The end of a deal, not a deal.
  { code: 'termination', re: 'terminat|conclusion of .*(collaboration|agreement)|expiry of .*(licen|agreement)|返還|開発中止|契約.*解除|契約.*終了|해지|종료|终止' },
  // Payments under an existing deal (the deal itself is already recorded when it was signed).
  { code: 'payment_receipt', re: 'receipt of .*(milestone|royalt|upfront|payment|fee)|(first|second|third|fourth) milestone payment|milestone payment from|기술료 수령|마일스톤.*수령' },
  // Renewals and extensions of existing intra-group licences.
  { code: 'renewal', re: 'renewal of .*(continuing connected|licen|sublicen)|extension of .*sublicen|licen[cs]e renewal' },
  { code: 'litigation', re: 'legal proceeding|litigation|arbitration|settlement' },
  // Regulatory or business licences, not licensing deals.
  { code: 'regulatory_licence', re: 'pre-licen[cs]e|dir licen[cs]e|manufacturing licen[cs]e|import licen[cs]e|business licen[cs]e|obtaining licen[cs]es|licen[cs]es for type|licensed entit|regulated activit' },
  // Non-pharma noise from the all-issuer HKEX title search.
  { code: 'non_pharma', re: 'digital asset|virtual asset|securities and futures|money lending|mining|casino|investment property|property development|property management|trademark|商标|日常关联交易' },
  { code: 'reporting', re: 'annual report|interim report|annual results|interim results|positive data|topline|top-line|trial registration|臨床試験登録|試験登録完了' },
  { code: 'equity_only', re: 'put and call option|최대주주변경|주식담보|주식양수도|경영권변경|株式引受契約|単一販売|단일판매' },
];

/** A licensing/partnering word; titles with only a weak word (supply, distribution, joint venture, term sheet) need one of these. */
const STRONG_DEAL_WORD = 'licen|commerciali|collaborat|co-develop|option|acqui|merger|partnership|royalt|upfront|ライセンス|導入|導出|許諾|许可|授权|合作|라이선스|라이센스|기술이전|기술도입|공동개발';
const WEAK_ONLY_WORD = 'supply|distribution|manufactur|joint venture|term sheet';

/** At least one life-science word in the document body. */
export const LIFE_SCIENCE_BODY = 'pharm|biotech|bio|therap|drug|clinical|antibod|molecul|vaccine|oncolog|cancer|tumou?r|disease|patent|medic|health|treat|医药|药|生物|治疗|의약|제약|바이오|치료|医薬|製薬|治療|創薬|薬';

const compiled = NON_DEAL_TITLE_PATTERNS.map(p => ({ code: p.code, re: new RegExp(p.re, 'i') }));
const strongRe = new RegExp(STRONG_DEAL_WORD, 'i');
const weakRe = new RegExp(WEAK_ONLY_WORD, 'i');
const lifeRe = new RegExp(LIFE_SCIENCE_BODY, 'i');

export type PrefilterResult = { keep: true } | { keep: false; reason: string };

/** Title-level screen. Empty titles pass (EDGAR documents have none). */
export function screenTitle(title: string | null | undefined): PrefilterResult {
  const t = (title ?? '').trim();
  if (!t) return { keep: true };
  for (const p of compiled) if (p.re.test(t)) return { keep: false, reason: `title_${p.code}` };
  if (weakRe.test(t) && !strongRe.test(t)) return { keep: false, reason: 'title_supply_only' };
  return { keep: true };
}

/** Body-level screen on the text the extractor would read. */
export function screenBody(text: string | null | undefined): PrefilterResult {
  const t = text ?? '';
  if (!lifeRe.test(t.slice(0, 12_000))) return { keep: false, reason: 'body_no_life_science' };
  return { keep: true };
}

/** Both screens; the first failure wins. */
export function prefilterDocument(input: { title?: string | null; text?: string | null }): PrefilterResult {
  const title = screenTitle(input.title);
  if (!title.keep) return title;
  if (input.text != null) return screenBody(input.text);
  return { keep: true };
}
