/**
 * CDE — China Center for Drug Evaluation drug clinical trial registration
 * platform (药物临床试验登记与信息公示平台, chinadrugtrials.org.cn). The best
 * asset-level source for China: every IND-approved drug trial with the
 * sponsor (申办者), drug name (药物名称), code name, target/indication and
 * phase; many are never posted to CT.gov.
 *
 * Capability  scrape_required. Verified Sep 2026:
 *   http://www.chinadrugtrials.org.cn/… → 301 https; https://www.chinadrugtrials.org.cn/
 *   clinicaltrials.searchlist.dhtml answers HTTP 202 with a 25 KB JavaScript
 *   challenge page (WAF), so plain fetch cannot reach the listing. The listing
 *   itself is a POST form (clinicaltrials.searchlist.dhtml with pageSize/pageNo,
 *   ~20 rows per page, sorted by registration date) and the detail page
 *   (clinicaltrials.searchlistdetail.dhtml, POST id=…) needs the session cookie
 *   set by the challenge — a browser with CN-friendly egress is required.
 * URL patterns
 *   search  https://www.chinadrugtrials.org.cn/clinicaltrials.searchlist.dhtml
 *   detail  https://www.chinadrugtrials.org.cn/clinicaltrials.searchlistdetail.dhtml?id={internal}
 *           (public id CTR20230001)
 * Field mapping (Chinese labels → RegistryRecord):
 *   "登记号"                          → registry_id (CTRyyyynnnn)
 *   "试验专业题目" / "试验通俗题目"     → title
 *   "申办者" / "申请人"                → sponsor_name (sponsor_type INDUSTRY unless 医院/大学)
 *   "药物名称", "药物代码"? (code)      → interventions (type drug; role experimental)
 *   "适应症"                          → conditions
 *   "试验分期" ("I期", "II期", "III期", "I/II期", "IV期", "其它") → phase
 *   "试验状态" ("进行中（尚未招募）", "进行中（招募中）", "进行中（招募完成）", "已完成", "主动暂停", "主动终止")
 *                                     → status
 *   "首次公示信息日期", "第一例受试者入组日期", "试验完成日期"? , "最后更新日期"? → dates
 *   "药物类型" ("化学药物", "生物制品", "中药/天然药物") → intervention type / raw
 *   "NCT编号" / other registries        → secondary_ids
 * License   CDE public disclosure; no reuse licence published — store minimal fields,
 *           keep source_url, do not redistribute raw pages.
 * Reach     ~24,000 registrations (2013–2026); >90% industry-sponsored drug trials,
 *           ~2,500 new per year. Highest-value scrape target of the set.
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, ScrapedPage } from './types';
import { NotImplementedError } from './types';
import {
  classifySponsorClass,
  compact,
  extractSecondaryIds,
  makeIntervention,
  mapRegistryPhase,
  mapRegistryStatus,
  normalizeRegistryDate,
  splitList,
  uniq,
} from './shared';

const REASON = 'WAF JavaScript challenge (HTTP 202) and POST-only listing/detail with session cookies; needs browser + CN-friendly egress';

const CN_STATUS: Array<[RegExp, string]> = [
  [/尚未招募/, 'not yet recruiting'],
  [/招募中/, 'recruiting'],
  [/招募完成/, 'active, not recruiting'],
  [/已完成/, 'completed'],
  [/主动暂停|暂停/, 'suspended'],
  [/主动终止|终止/, 'terminated'],
  [/撤销|撤回/, 'withdrawn'],
];

export function translateCdeStatus(raw: string | null): string | null {
  if (!raw) return null;
  for (const [re, en] of CN_STATUS) if (re.test(raw)) return en;
  return raw;
}

function field(page: ScrapedPage, ...labels: string[]): string | null {
  for (const l of labels) {
    const v = page.fields[l];
    if (Array.isArray(v)) return v.filter(Boolean).join('; ') || null;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export function mapCdePage(page: ScrapedPage): RegistryRecord {
  const id = field(page, '登记号', 'Registration No', 'CTR') ?? page.id;
  const sponsor = field(page, '申办者', '申请人', 'Sponsor');
  const drugType = field(page, '药物类型', 'Drug type');
  const names = compact([...splitList(field(page, '药物名称', 'Drug name')), ...splitList(field(page, '药物代码', 'Code name'))]);
  const ivType = drugType && /生物/.test(drugType) ? 'biological' : 'drug';
  const interventions = names
    .map(n => makeIntervention(n, ivType, /安慰剂|placebo/i.test(n) ? 'placebo' : 'experimental'))
    .filter((iv): iv is NonNullable<typeof iv> => !!iv);
  const phaseRaw = field(page, '试验分期', 'Phase');
  const phaseEn = phaseRaw ? phaseRaw.replace(/期/g, '').replace(/其它|其他/, 'other') : null;
  const statusRaw = field(page, '试验状态', 'Status');
  const allText = Object.values(page.fields).flat().filter(Boolean).join(' ');

  return {
    registry: 'cde',
    registry_id: id,
    secondary_ids: uniq([...compact([field(page, 'NCT编号', 'NCT')]), ...extractSecondaryIds(allText)]).filter(s => s !== id),
    title: field(page, '试验专业题目', '试验通俗题目', 'Title'),
    sponsor_name: sponsor,
    sponsor_type: classifySponsorClass(sponsor, sponsor && /医院|大学|研究所|学院/.test(sponsor) ? 'hospital' : 'company'),
    collaborators: compact(splitList(field(page, '联合申办者', 'Co-sponsor'))).filter(c => c !== sponsor),
    interventions,
    conditions: splitList(field(page, '适应症', 'Indication')).slice(0, 20),
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseEn),
    status_raw: statusRaw,
    status: mapRegistryStatus(translateCdeStatus(statusRaw)),
    study_type: 'interventional',
    countries: ['CN'],
    start_date: normalizeRegistryDate(field(page, '第一例受试者入组日期', 'First enrolment date')),
    primary_completion_date: normalizeRegistryDate(field(page, '试验完成日期', '试验终止日期', 'Completion date')),
    first_registered: normalizeRegistryDate(field(page, '首次公示信息日期', 'First posted')),
    last_updated: normalizeRegistryDate(field(page, '最后更新日期', '最近更新日期', 'Last updated')),
    source_url: page.url || `https://www.chinadrugtrials.org.cn/clinicaltrials.searchlist.dhtml?ctr=${encodeURIComponent(id)}`,
    raw: { format: 'scraped_page', fields: page.fields, drug_type: drugType, fetched_at: page.fetchedAt ?? null },
  };
}

export const cdeAdapter: RegistryAdapter<ScrapedPage> = {
  registry: 'cde',
  displayName: 'CDE drug trial registry (China)',
  countryScope: ['CN'],
  license: 'CDE public disclosure; no reuse licence published (store minimal fields)',
  capability: 'scrape_required',
  transport: 'none',
  verified: 'verified',
  rateLimitMs: 3000,
  defaultLimit: 20,
  estimatedReach: 24_000,
  urls: {
    search: 'https://www.chinadrugtrials.org.cn/clinicaltrials.searchlist.dhtml',
    detail: id => `https://www.chinadrugtrials.org.cn/clinicaltrials.searchlist.dhtml?ctr=${encodeURIComponent(id)}`,
  },
  mapRecord(raw: ScrapedPage): RegistryRecord {
    return mapCdePage(raw);
  },
  async fetchPage(_cursor: string | null, _opts: FetchPageOptions): Promise<FetchPageResult> {
    throw new NotImplementedError('cde', REASON);
  },
};

export default cdeAdapter;
