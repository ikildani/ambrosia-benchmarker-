/**
 * Corporate families — pure rules (migration 193).
 *
 * One owner sits behind many company rows: its Chinese legal name (齐鲁制药有限公司 next to
 * "Qilu Pharmaceutical"), trial and operating subsidiaries (Genentech under Roche, 上海津曼特
 * under CSPC) and acquired companies (Shire under Takeda). Each row keeps its identity; accepted
 * company_relations join rows into a family (companies.family_id) that programs, ownership,
 * availability and the deal ledger read.
 *
 * Rules, strongest first. Each produces a proposal with the evidence it rests on:
 *
 *   name_parent        the row's own name declares a parent ("Kymab Ltd, A Sanofi Company",
 *                      "Juno Therapeutics, a subsidiary of Celgene", "Baxalta now part of Shire");
 *                      the parent is resolved through lib/entities/resolve.ts.
 *   acquisition_codes  an acquisition deal between two holders of the same development codes,
 *                      when they share two or more codes or the deal names the acquired company
 *                      (a single shared code is usually an asset purchase: Pfizer → Biogen PF-05251749).
 *   email_domain       Chinese-name rows reached from one corporate e-mail domain that carry the
 *                      same brand (四川科伦药业 / 广西科伦制药 / 湖南科伦制药 on kelun.com). A domain
 *                      alone is not enough: it also reaches CROs and the foreign licensors whose
 *                      China trials a licensee runs.
 *   model              domain clusters and code-sharing pairs the rules cannot settle (Simcere =
 *                      先声, Roche + Chugai), adjudicated with the evidence in the prompt and accepted
 *                      at confidence ≥ MODEL_MIN_CONFIDENCE.
 */

import { createHash } from 'crypto';
import { z } from 'zod';

export type FamilyRelation = 'same_entity' | 'subsidiary';
export type FamilySource = 'name_parent' | 'email_domain' | 'acquisition_codes' | 'model';

export interface FamilyCompany {
  id: string;
  name: string;
  hq_country?: string | null;
  owner_type?: string | null;
  company_type?: string | null;
  website_url?: string | null;
  merged_into?: string | null;
}

export interface RelationProposal {
  company_id: string;
  parent_id: string;
  relation: FamilyRelation;
  source: FamilySource;
  decided_by: 'rule' | 'model';
  confidence: number;
  evidence: Record<string, unknown>;
}

export const MODEL_MIN_CONFIDENCE = 0.85;

// ─── name_parent ────────────────────────────────────────────────────────────

const PARENT_PATTERNS: readonly RegExp[] = [
  // "…, a wholly owned subsidiary of Eli Lilly and Company", "(a subsidiary of X)"
  /(?:^|[\s,(])(?:an?\s+)?(?:(?:wholly|majority|fully)[- ]owned\s+|indirect\s+|direct\s+)?subsidiary\s+of\s+(?:the\s+)?(.+?)\s*(?:[([]|$)/i,
  // "…, A Sanofi Company", "(a Johnson & Johnson company)", "…, an Ipsen Company"
  /[,(]\s*an?\s+(.+?)\s+(?:group\s+)?company\)?\s*$/i,
  // "…, a member of the Novartis group of companies"
  /member\s+of\s+the\s+(.+?)\s+group\b/i,
  // "Baxalta now part of Shire", "…, a division of SGS Belgium NV", "acquired by X"
  /(?:now\s+(?:a\s+)?part\s+of|division\s+of|acquired\s+by)\s+(?:the\s+)?(.+?)\s*(?:[([,]|$)/i,
];

/** The parent a company name declares, or null. "Kymab Ltd, A Sanofi Company" → "Sanofi". */
export function parentPhrase(name: string | null | undefined): string | null {
  const s = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  for (const re of PARENT_PATTERNS) {
    const m = re.exec(s);
    if (!m) continue;
    const parent = m[1]
      .replace(/\[[^\]]*\]?/g, ' ')
      .replace(/[)\].;:]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    // "a Delaware company", "a limited liability company": a legal form, not a parent.
    if (parent.length < 3 || /^(delaware|limited liability|private|public|joint stock|holding|pharmaceutical|biotech(nology)?|clinical[- ]stage)$/i.test(parent)) {
      continue;
    }
    return parent;
  }
  return null;
}

// ─── email_domain: Chinese brand tokens ─────────────────────────────────────

const CJK = /[㐀-鿿]/;

export function hasCjk(name: string | null | undefined): boolean {
  return CJK.test(name ?? '');
}

/** Provinces and the cities that most often prefix a Chinese legal name. */
const CN_PLACES = [
  '内蒙古', '黑龙江', '北京', '上海', '天津', '重庆', '河北', '山西', '辽宁', '吉林', '江苏', '浙江', '安徽', '福建', '江西',
  '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏',
  '新疆', '香港', '澳门', '台湾', '深圳', '广州', '杭州', '南京', '苏州', '成都', '武汉', '西安', '长沙', '郑州', '济南',
  '青岛', '厦门', '合肥', '珠海', '无锡', '常州', '宁波', '石家庄', '哈尔滨', '沈阳', '大连', '长春', '昆明', '南昌',
  '福州', '泰州', '烟台', '连云港', '中山', '东莞', '佛山', '绍兴', '台州', '嘉兴', '南通', '扬州', '镇江', '徐州', '宜昌',
  '海口', '兰州', '太原', '南宁', '贵阳', '温州', '金华', '湖州', '淄博', '潍坊', '威海', '临沂', '东营', '泰安', '济宁',
  '保定', '唐山', '廊坊', '沧州', '邯郸', '洛阳', '新乡', '株洲', '绵阳', '德阳', '宜宾', '泸州', '乐山', '中国',
];

/** Descriptor words removed before brand comparison, longest first. */
const CN_DESCRIPTORS = [
  '有限责任公司', '股份有限公司', '生物医药', '生物制药', '生物科技', '生物技术', '生物工程', '生物制品', '医药科技', '医药技术',
  '研究院', '研究所', '分公司', '有限公司', '制药厂', '国际', '集团', '股份', '公司', '药业', '制药', '医药', '生物', '科技',
  '技术', '研究', '开发', '发展', '工业', '中药', '药物', '生技', '医学', '健康', '创新', '药品', '实业', '控股', '投资',
  '贸易', '产业', '工程', '研发', '中心', '总厂', '新药', '化学', '医疗', '器械', '制品', '疫苗', '基因', '细胞', '有限',
  '责任', '省', '市', '区', '县', '厂',
].sort((a, b) => b.length - a.length);

/**
 * The distinctive two-character runs of a Chinese company name once places, descriptors and
 * parenthetical locations are removed. 武汉九珑人福药业有限责任公司 → {九珑, 珑人, 人福}.
 */
export function cjkBrandBigrams(name: string | null | undefined): Set<string> {
  let s = (name ?? '').replace(/[（(][^）)]*[）)]/g, '|');
  for (const p of CN_PLACES) s = s.split(p).join('|');
  for (const d of CN_DESCRIPTORS) s = s.split(d).join('|');
  const out = new Set<string>();
  for (const seg of s.split(/[^㐀-鿿]+/)) {
    const chars = [...seg];
    for (let i = 0; i + 1 < chars.length; i++) out.add(chars[i] + chars[i + 1]);
  }
  return out;
}

export interface DomainMember extends FamilyCompany {
  via: string[];
  trials: number;
}

export interface BrandGroup {
  brand: string;
  member_ids: string[];
  anchor_id: string;
}

/**
 * Chinese-name rows of one domain cluster that share the cluster's dominant brand bigram (present
 * in at least two members). Repeats on the remainder, so a domain with two brands yields two groups.
 */
export function brandGroups(members: readonly DomainMember[]): BrandGroup[] {
  // Hospitals, universities and institutes on a licensee's domain are never part of its group.
  const pool = members.filter(m => hasCjk(m.name) && (m.owner_type ?? 'industry') === 'industry');
  const groups: BrandGroup[] = [];
  let rest = pool.map(m => ({ m, grams: cjkBrandBigrams(m.name) }));
  while (rest.length >= 2) {
    const freq = new Map<string, number>();
    for (const r of rest) for (const g of r.grams) freq.set(g, (freq.get(g) ?? 0) + 1);
    const best = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!best) break;
    const [brand] = best;
    const groupRows = rest.filter(r => r.grams.has(brand));
    // A row sharing a second brand with two group members joins too: 双鹤药业（海南） next to
    // 华润双鹤药业 and 华润双鹤利民药业 under China Resources (华润).
    const absorbed = rest.filter(r => !r.grams.has(brand)
      && [...r.grams].some(g => groupRows.filter(x => x.grams.has(g)).length >= 2));
    const members = [...groupRows, ...absorbed];
    const inGroup = members.map(r => r.m);
    const anchor = [...inGroup].sort((a, b) => b.trials - a.trials || a.name.length - b.name.length || a.id.localeCompare(b.id))[0];
    groups.push({ brand, member_ids: inGroup.map(m => m.id), anchor_id: anchor.id });
    rest = rest.filter(r => !members.includes(r));
  }
  return groups;
}

/** CRO and site-network domains: they run trials for many sponsors and never mean "same company". */
export const SERVICE_DOMAINS = new Set([
  'iqvia.com', 'iconplc.com', 'parexel.com', 'fortrea.com', 'ppd.com', 'ppdi.com', 'syneoshealth.com', 'medpace.com',
  'tigermedgrp.com', 'tigermed.net', 'wuxiapptec.com', 'pharmaron.com', 'covance.com', 'labcorp.com', 'thermofisher.com',
  'novotech-cro.com', 'premier-research.com', 'worldwide.com', 'psi-cro.com', 'clinipace.com', 'precisionformedicine.com',
  'caidya.com', 'dmed.com.cn', 'hkcro.com', 'tenacia.com', 'pfizer-cro.com', 'linical.com', 'cmic-holdings.com',
]);

// ─── acquisition_codes ──────────────────────────────────────────────────────

export interface CodePair {
  a_id: string;
  b_id: string;
  shared: number;
  codes: string[];
  licensing_deal: boolean;
  acquirer_id: string | null;
  acquired_id: string | null;
  acquisition_deal_id: string | null;
  acquisition_asset: string | null;
}

function nameRoot(name: string): string | null {
  const w = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).find(t => t.length >= 4);
  return w ?? null;
}

/** Acquired company → acquirer, when the acquisition is of the company and not one asset. */
export function acquisitionProposal(pair: CodePair, companies: ReadonlyMap<string, FamilyCompany>): RelationProposal | null {
  if (!pair.acquisition_deal_id || !pair.acquirer_id || !pair.acquired_id || pair.acquirer_id === pair.acquired_id) return null;
  const acquired = companies.get(pair.acquired_id);
  // Large pharma is not acquired by deal record: "GSK → Novartis, ofatumumab" is an asset purchase.
  if (acquired?.company_type === 'large_pharma') return null;
  const root = acquired ? nameRoot(acquired.name) : null;
  const namesCompany = !!root && (pair.acquisition_asset ?? '').toLowerCase().includes(root);
  if (pair.shared < 2 && !namesCompany) return null;
  return {
    company_id: pair.acquired_id,
    parent_id: pair.acquirer_id,
    relation: 'subsidiary',
    source: 'acquisition_codes',
    decided_by: 'rule',
    confidence: pair.shared >= 2 ? 0.92 : 0.88,
    evidence: { deal_id: pair.acquisition_deal_id, shared_codes: pair.codes.slice(0, 12), names_company: namesCompany },
  };
}

// ─── model adjudication ─────────────────────────────────────────────────────

export interface ReviewSubject {
  /** 'domain:kelun.com' or 'pair:<a>:<b>' */
  subject: string;
  kind: 'domain' | 'pair';
  domain?: string;
  codes?: string[];
  members: DomainMember[];
}

export function membersHash(members: readonly { id: string }[]): string {
  return createHash('sha1').update(members.map(m => m.id).sort().join(',')).digest('hex').slice(0, 16);
}

export const FAMILY_SYSTEM_PROMPT = [
  'You decide which pharmaceutical / biotech company records belong to the same corporate group.',
  'Same group means: the same legal entity under another name or language (a Chinese legal name and its English name,',
  'a former name), or a parent and a subsidiary it controls (majority-owned or acquired).',
  'NOT the same group: a licensor and its licensee, co-development partners, a contract research organisation (CRO) or',
  'site network that runs trials for the sponsor, a hospital, university or academic institute, a distributor.',
  'Sharing an e-mail domain or a development code is a hint, not proof: a Chinese licensee often runs the China trials',
  'of a foreign licensor under its own domain, and licensees keep the licensor\'s code.',
  'Group records only when you are confident from the names (including translation or transliteration between Chinese',
  'and English) and well-established corporate structure. When unsure, leave a record out.',
  'Answer with JSON only: {"groups":[{"members":[<idx>...],"parent":<idx>,"relation":"same_entity"|"subsidiary",',
  '"confidence":<0-1>,"reason":"<one sentence>"}]}. Every group has at least two members and its parent is one of them.',
  'Return {"groups":[]} when no records belong together.',
].join(' ');

export function buildReviewPrompt(s: ReviewSubject): string {
  const lines: string[] = [];
  if (s.kind === 'domain') lines.push(`These company records are all reached from the e-mail / web domain "${s.domain}".`);
  else lines.push(`These two company records hold the same development code(s): ${(s.codes ?? []).slice(0, 12).join(', ')}.`);
  lines.push('');
  s.members.forEach((m, i) => {
    const bits = [m.hq_country ? `HQ ${m.hq_country}` : null, m.owner_type ? `type ${m.owner_type}` : null,
      m.website_url ? `website ${m.website_url}` : null, m.via.length ? `seen via ${m.via.join('+')}` : null,
      m.trials ? `${m.trials} trials` : null].filter(Boolean);
    lines.push(`[${i}] ${m.name}${bits.length ? ` (${bits.join('; ')})` : ''}`);
  });
  lines.push('', 'Which of these records belong to the same corporate group?');
  return lines.join('\n');
}

const ModelGroup = z.object({
  members: z.array(z.number().int().nonnegative()).min(2),
  parent: z.number().int().nonnegative(),
  relation: z.enum(['same_entity', 'subsidiary']).default('subsidiary'),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(400).default(''),
});
export const ModelAnswer = z.object({ groups: z.array(ModelGroup).max(20) });
export type ModelAnswerT = z.infer<typeof ModelAnswer>;

/** Turn a validated model answer into proposals; drops out-of-range indexes and low confidence. */
export function proposalsFromAnswer(s: ReviewSubject, answer: ModelAnswerT, model: string): RelationProposal[] {
  const out: RelationProposal[] = [];
  const seen = new Set<string>();
  for (const g of answer.groups) {
    if (g.confidence < MODEL_MIN_CONFIDENCE) continue;
    const parent = s.members[g.parent];
    if (!parent || !g.members.includes(g.parent)) continue;
    for (const idx of g.members) {
      const child = s.members[idx];
      if (!child || child.id === parent.id || seen.has(child.id)) continue;
      seen.add(child.id);
      out.push({
        company_id: child.id,
        parent_id: parent.id,
        relation: g.relation,
        source: 'model',
        decided_by: 'model',
        confidence: Math.round(g.confidence * 100) / 100,
        evidence: { subject: s.subject, domain: s.domain ?? null, codes: s.codes?.slice(0, 12) ?? null, reason: g.reason, model },
      });
    }
  }
  return out;
}
