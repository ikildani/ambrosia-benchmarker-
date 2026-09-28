/**
 * CDE (chinadrugtrials.org.cn) page parsers. Pure: HTML in, structured data
 * out, so the browser worker and the tests share them.
 *
 * Listing (POST /clinicaltrials.searchlist.dhtml, 20 rows per page, sorted by
 * registration number desc when rule=CTR&sort=desc): one <tr> per trial, every
 * cell an <a onclick="getDetail(this.id)" id="{internal hex id}" name="{row}">.
 * Detail (POST /clinicaltrials.searchlistdetail.dhtml with id + ckm_index):
 * tables of <th>label</th><td>value</td> pairs (two pairs per row in places),
 * plus sub-tables for 试验药 (investigational drugs) and 对照药 (comparators)
 * with 序号 / 名称 / 用法 columns.
 */

import type { ScrapedPage } from '../types';

export interface CdeListingRow {
  /** Internal hex id the detail POST needs. */
  id: string;
  /** Row ordinal (`name` attribute), sent as ckm_index. */
  index: string;
  ctr: string;
  status: string | null;
  drug: string | null;
  indication: string | null;
  title: string | null;
}

function text(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCdeListing(html: string): CdeListingRow[] {
  const out: CdeListingRow[] = [];
  const seen = new Set<string>();
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];
    const a = /<a[^>]*onclick="getDetail\(this\.id\)"[^>]*id="([0-9a-f]{16,40})"[^>]*name="([^"]*)"/i.exec(row);
    if (!a) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => text(c[1]));
    const ctr = cells.map(c => /CTR\d{8}/.exec(c)?.[0]).find(Boolean);
    if (!ctr || seen.has(ctr)) continue;
    seen.add(ctr);
    out.push({
      id: a[1],
      index: a[2],
      ctr,
      status: cells[2] || null,
      drug: cells[3] || null,
      indication: cells[4] || null,
      title: cells[5] || null,
    });
  }
  return out;
}

const NAME_PLACEHOLDER_RE = /^(na|n\/a|无|待定|暂无|-|—|null|none)$/i;

/**
 * A 名称 cell reads "中文通用名:SPGL008注射液 英文通用名:SPGL008 商品名称:待定".
 * The English generic name / code is what the asset index matches on, so it
 * wins; the Chinese generic name is the fallback; brand names are ignored.
 */
export function drugNameFromCell(cell: string): string | null {
  const en = /英文通用名[:：]\s*(.+?)(?=\s+(?:中文通用名|商品名称|英文商品名|规格)[:：]|$)/.exec(cell)?.[1]?.trim();
  const zh = /中文通用名[:：]\s*(.+?)(?=\s+(?:英文通用名|商品名称|英文商品名|规格)[:：]|$)/.exec(cell)?.[1]?.trim();
  const pick = en && !NAME_PLACEHOLDER_RE.test(en) ? en : zh && !NAME_PLACEHOLDER_RE.test(zh) ? zh : cell.trim();
  const cleaned = pick.replace(/&reg;|®|™/g, '').trim();
  return cleaned && !/暂未填写|登记人暂未填写/.test(cleaned) ? cleaned : null;
}

/** Names from a 序号 / 名称 / 用法 sub-table; empty when the registry says 暂未填写. */
function subTableNames(html: string): string[] {
  const out: string[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => text(c[1]));
    if (cells.length < 2) continue;
    const name = drugNameFromCell(cells[1]);
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

const NOT_FILLED_RE = /(登记人)?暂未填写(此|该)?信息|企业选择不公示/;

/**
 * Every <th>label</th><td>value</td> pair on the page keyed by label; repeated
 * labels accumulate into arrays. 试验药 / 对照药 become the drug-name lists of
 * their sub-tables; 药物名称 drops the "曾用名:" tail.
 */
export function parseCdeDetail(html: string, url: string, listing?: Partial<CdeListingRow>): ScrapedPage {
  const fields: Record<string, string | string[] | undefined> = {};
  const add = (label: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    const cur = fields[label];
    if (cur === undefined) fields[label] = v;
    else if (Array.isArray(cur)) { if (!cur.includes(v)) cur.push(v); }
    else if (cur !== v) fields[label] = [cur, v];
  };

  // Sub-tables first (their inner <th>s must not be read as page labels).
  const body = html.replace(/<th[^>]*>\s*(试验药|对照药)\s*<\/th>\s*<td[^>]*>([\s\S]*?<\/table>)\s*<\/td>/g, (_m, label: string, inner: string) => {
    const names = subTableNames(inner);
    fields[label] = names;
    return '';
  });

  const pairRe = /<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = pairRe.exec(body)) !== null) {
    const label = text(m[1]).replace(/[:：]$/, '');
    if (!label || /^(序号|名称|用法|指标|评价时间|终点指标选择|\d+)$/.test(label)) continue;
    let value = text(m[2]);
    if (NOT_FILLED_RE.test(value)) continue;
    if (label === '药物名称') value = value.replace(/曾用名[:：].*$/, '').trim();
    // The applicant block repeats 申请人名称 as a numbered sub-heading ("申请人名称 | 1").
    if (/^申请人名称|^申办者/.test(label) && /^[\d\s]+$/.test(value)) continue;
    if (!value) continue;
    add(label, value);
  }

  // The listing carries the recruitment sub-status (进行中 尚未招募); the detail page only 进行中.
  if (listing?.status && listing.status.length > String(fields['试验状态'] ?? '').length) fields['试验状态'] = listing.status;
  if (listing?.drug && !fields['药物名称']) fields['药物名称'] = listing.drug;
  if (listing?.indication && !fields['适应症']) fields['适应症'] = listing.indication;

  const id = (typeof fields['登记号'] === 'string' ? fields['登记号'] : null) ?? listing?.ctr ?? '';
  return { id, url, fields, fetchedAt: new Date().toISOString() };
}

/** Hidden form fields the listing and detail POSTs expect (mirrors the site's #searchfrm). */
export function cdeListingForm(page: number): Record<string, string> {
  return {
    keywords: '', id: '', ckm_index: '', sort: 'desc', sort2: '', rule: 'CTR', secondLevel: '0',
    currentpage: String(page), reg_no: '', indication: '', case_no: '', drugs_name: '', drugs_type: '',
    appliers: '', communities: '', researchers: '', agencies: '', state: '',
  };
}

export function cdeDetailForm(row: Pick<CdeListingRow, 'id' | 'index'>, page: number): Record<string, string> {
  return { ...cdeListingForm(page), id: row.id, ckm_index: row.index };
}

export const CDE_BASE = 'https://www.chinadrugtrials.org.cn';
export const CDE_LISTING_PATH = '/clinicaltrials.searchlist.dhtml';
export const CDE_DETAIL_PATH = '/clinicaltrials.searchlistdetail.dhtml';
export const CDE_LISTING_PAGE_SIZE = 20;

/** True when the body is the WAF challenge shell rather than a registry page. */
export function looksLikeCdeChallenge(html: string): boolean {
  // Every real listing or detail page carries the search form or the detail table.
  return !/searchDetailTable|getDetail\(|searchfrm/.test(html);
}
