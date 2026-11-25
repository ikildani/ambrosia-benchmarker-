/**
 * Corporate families — the job (migration 193; rules in ./company-family.ts).
 *
 * 1. name_parent: rows whose name declares a parent, resolved with resolveCompany.
 * 2. acquisition_codes: radar_company_code_pairs() pairs with a company acquisition between them.
 * 3. email_domain: radar_company_domain_members() clusters; Chinese-name rows sharing a brand.
 * 4. model: domain clusters and code-sharing pairs the rules leave open, at most maxModelCalls a
 *    run, each subject asked once (company_family_reviews) until its members change.
 * 5. Upsert company_relations (rows a person decided are never touched), then
 *    radar_refresh_company_families(). Programs regroup on the next percentiles refresh.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseJsonResponse } from '@/lib/ai/parse-json';
import { resolveCompany } from './resolve';
import {
  FAMILY_SYSTEM_PROMPT,
  MODEL_ANSWER_JSON_SCHEMA,
  ModelAnswer,
  SERVICE_DOMAINS,
  acquisitionProposal,
  brandGroups,
  buildReviewPrompt,
  hasCjk,
  membersHash,
  parentPhrase,
  proposalsFromAnswer,
  type CodePair,
  type DomainMember,
  type FamilyCompany,
  type RelationProposal,
  type ReviewSubject,
} from './company-family';

export const FAMILY_MODEL = 'claude-opus-5';
const PAGE = 1000;
const MAX_DOMAIN_MEMBERS = 25;
const SOURCE_RANK: Record<RelationProposal['source'], number> = { name_parent: 0, acquisition_codes: 1, email_domain: 2, model: 3 };

/** Minimal Messages client so tests can inject a fake. */
export interface FamilyModelClient {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: 'user'; content: string }[];
      output_config?: { effort?: 'low' | 'medium' | 'high'; format?: { type: 'json_schema'; schema: unknown } };
    }): Promise<{ content: { type: string; text?: string }[]; stop_reason?: string | null }>;
  };
}

export interface FamilyRunOptions {
  dryRun?: boolean;
  client?: FamilyModelClient | null;
  model?: string;
  maxModelCalls?: number;
  concurrency?: number;
  timeBudgetMs?: number;
}

export interface FamilyRunResult {
  dry_run: boolean;
  proposals: Record<RelationProposal['source'], number>;
  written: number;
  skipped_human: number;
  unresolved_parents: string[];
  domain_clusters: number;
  model_subjects_pending: number;
  model_calls: number;
  model_failures: number;
  families: Record<string, unknown> | null;
  sample: { child: string; parent: string; source: string; reason?: string }[];
  errors: string[];
  timed_out: boolean;
}

type Db = SupabaseClient<any, any, any>;

async function pagedRpc<T>(db: Db, fn: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.rpc(fn).range(from, from + PAGE - 1);
    if (error) throw new Error(`${fn}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const COMPANY_COLS = 'id, name, hq_country, owner_type, company_type, website_url, merged_into, family_id';

async function loadCompanies(db: Db, ids: Iterable<string>): Promise<Map<string, FamilyCompany & { family_id?: string | null }>> {
  const all = [...new Set(ids)];
  const out = new Map<string, FamilyCompany & { family_id?: string | null }>();
  for (let i = 0; i < all.length; i += 200) {
    const { data, error } = await db.from('companies').select(COMPANY_COLS).in('id', all.slice(i, i + 200));
    if (error) throw new Error(`companies load: ${error.message}`);
    for (const r of (data ?? []) as (FamilyCompany & { family_id?: string | null })[]) out.set(r.id, r);
  }
  return out;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

// ─── 1. name_parent ─────────────────────────────────────────────────────────

async function nameParentProposals(db: Db, unresolved: string[]): Promise<RelationProposal[]> {
  const rows: FamilyCompany[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('companies')
      .select('id, name')
      .is('merged_into', null)
      .eq('owner_type', 'industry')
      .or('name.ilike.*subsidiary of*,name.ilike.*a * company*,name.ilike.*an * company*,name.ilike.*member of the*,name.ilike.*part of*,name.ilike.*division of*,name.ilike.*acquired by*')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`name_parent candidates: ${error.message}`);
    rows.push(...((data ?? []) as FamilyCompany[]));
    if ((data ?? []).length < PAGE) break;
  }
  const found = await mapLimit(rows, 5, async (row): Promise<RelationProposal | null> => {
    const phrase = parentPhrase(row.name);
    if (!phrase) return null;
    const res = await resolveCompany(db, { name: phrase });
    const m = res.match;
    if (!m || m.id === row.id || (m.matchedOn === 'fuzzy' && m.confidence < 0.9)) {
      unresolved.push(`${row.name} → ${phrase}`);
      return null;
    }
    return {
      company_id: row.id,
      parent_id: m.id,
      relation: 'subsidiary',
      source: 'name_parent',
      decided_by: 'rule',
      confidence: m.matchedOn === 'fuzzy' ? 0.9 : 0.97,
      evidence: { name: row.name, parent_phrase: phrase, parent_name: m.canonicalName, matched_on: m.matchedOn },
    };
  });
  return found.filter((p): p is RelationProposal => p !== null);
}

// ─── 3. domain clusters ─────────────────────────────────────────────────────

interface DomainRow { domain: string; company_id: string; via: string; n: number }

function buildClusters(rows: readonly DomainRow[], companies: ReadonlyMap<string, FamilyCompany>): Map<string, DomainMember[]> {
  const byDomain = new Map<string, Map<string, DomainMember>>();
  for (const r of rows) {
    if (SERVICE_DOMAINS.has(r.domain)) continue;
    const c = companies.get(r.company_id);
    if (!c || c.merged_into) continue;
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, new Map());
    const m = byDomain.get(r.domain)!;
    const cur = m.get(c.id) ?? { ...c, via: [], trials: 0 };
    if (!cur.via.includes(r.via)) cur.via.push(r.via);
    if (r.via === 'cde_contact_email') cur.trials += Number(r.n) || 0;
    m.set(c.id, cur);
  }
  const out = new Map<string, DomainMember[]>();
  for (const [d, m] of byDomain) if (m.size >= 2) out.set(d, [...m.values()]);
  return out;
}

// ─── run ────────────────────────────────────────────────────────────────────

export async function runCompanyFamilies(db: Db, opts: FamilyRunOptions = {}): Promise<FamilyRunResult> {
  const started = Date.now();
  const budget = opts.timeBudgetMs ?? 200_000;
  const dryRun = opts.dryRun ?? false;
  const model = opts.model ?? FAMILY_MODEL;
  const result: FamilyRunResult = {
    dry_run: dryRun,
    proposals: { name_parent: 0, acquisition_codes: 0, email_domain: 0, model: 0 },
    written: 0,
    skipped_human: 0,
    unresolved_parents: [],
    domain_clusters: 0,
    model_subjects_pending: 0,
    model_calls: 0,
    model_failures: 0,
    families: null,
    sample: [],
    errors: [],
    timed_out: false,
  };
  const proposals: RelationProposal[] = [];

  // 1. name_parent
  try {
    proposals.push(...await nameParentProposals(db, result.unresolved_parents));
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  // 2 + 3. evidence functions
  const pairs = await pagedRpc<CodePair>(db, 'radar_company_code_pairs');
  const domainRows = await pagedRpc<DomainRow>(db, 'radar_company_domain_members');
  const companies = await loadCompanies(db, [
    ...pairs.flatMap(p => [p.a_id, p.b_id]),
    ...domainRows.map(r => r.company_id),
  ]);

  const acquisitionAccepted = new Set<string>();
  for (const p of pairs) {
    const prop = acquisitionProposal(p, companies);
    if (prop) {
      proposals.push(prop);
      acquisitionAccepted.add(`${p.a_id}:${p.b_id}`);
    }
  }

  const clusters = buildClusters(domainRows, companies);
  result.domain_clusters = clusters.size;
  const subjects: ReviewSubject[] = [];
  for (const [domain, members] of clusters) {
    const groups = brandGroups(members);
    for (const g of groups) {
      for (const id of g.member_ids) {
        if (id === g.anchor_id) continue;
        proposals.push({
          company_id: id,
          parent_id: g.anchor_id,
          relation: 'subsidiary',
          source: 'email_domain',
          decided_by: 'rule',
          confidence: 0.9,
          evidence: { domain, brand: g.brand },
        });
      }
    }
    // Left for the model: clusters with more than one unit once brands are grouped, industry rows only.
    const industry = members.filter(m => (m.owner_type ?? 'industry') === 'industry');
    const grouped = new Set(groups.flatMap(g => g.member_ids));
    const units = groups.length + industry.filter(m => !grouped.has(m.id)).length;
    if (industry.length >= 2 && units >= 2) {
      const top = [...industry].sort((a, b) => b.trials - a.trials || a.id.localeCompare(b.id)).slice(0, MAX_DOMAIN_MEMBERS);
      subjects.push({ subject: `domain:${domain}`, kind: 'domain', domain, members: top });
    }
  }
  // Code-sharing pairs with no licensing deal and no accepted acquisition: two or more codes, or a
  // Chinese-name row next to a Latin one (the twin case), both industry and not yet one family.
  for (const p of pairs) {
    if (p.licensing_deal || acquisitionAccepted.has(`${p.a_id}:${p.b_id}`)) continue;
    const a = companies.get(p.a_id);
    const b = companies.get(p.b_id);
    if (!a || !b || a.merged_into || b.merged_into) continue;
    if (a.family_id && a.family_id === b.family_id) continue;
    const twin = hasCjk(a.name) !== hasCjk(b.name);
    if (p.shared < 2 && !twin) continue;
    const m = (c: FamilyCompany): DomainMember => ({ ...c, via: ['shared_code'], trials: 0 });
    subjects.push({ subject: `pair:${p.a_id}:${p.b_id}`, kind: 'pair', codes: p.codes, members: [m(a), m(b)] });
  }

  // 4. model
  if (opts.client && subjects.length) {
    const reviewed = new Map<string, string>();
    const keys = subjects.map(s => s.subject);
    for (let i = 0; i < keys.length; i += 200) {
      const { data, error } = await db.from('company_family_reviews').select('subject, members_hash').in('subject', keys.slice(i, i + 200));
      if (error) throw new Error(`company_family_reviews: ${error.message}`);
      for (const r of (data ?? []) as { subject: string; members_hash: string }[]) reviewed.set(r.subject, r.members_hash);
    }
    const pending = subjects
      .filter(s => reviewed.get(s.subject) !== membersHash(s.members))
      .sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'domain' ? -1 : 1)
        || y.members.reduce((t, m) => t + m.trials, 0) - x.members.reduce((t, m) => t + m.trials, 0)
        || (y.codes?.length ?? 0) - (x.codes?.length ?? 0));
    result.model_subjects_pending = pending.length;
    const batch = pending.slice(0, opts.maxModelCalls ?? 40);
    const client = opts.client;
    await mapLimit(batch, opts.concurrency ?? 4, async (s) => {
      if (Date.now() - started > budget) {
        result.timed_out = true;
        return;
      }
      result.model_calls++;
      try {
        const res = await client.messages.create({
          model,
          // Thinking counts against max_tokens (claude-opus-5 thinks by default): 800 left ~27% of answers
          // with no text at all. Low effort + room + a schema-constrained answer.
          max_tokens: 4000,
          system: FAMILY_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildReviewPrompt(s) }],
          output_config: { effort: 'low', format: { type: 'json_schema', schema: MODEL_ANSWER_JSON_SCHEMA } },
        });
        const text = res.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('');
        if (!text.trim()) throw new Error(`empty answer for ${s.subject} (stop ${res.stop_reason ?? 'unknown'})`);
        const parsed = ModelAnswer.safeParse(parseJsonResponse<unknown>(text));
        if (!parsed.success) throw new Error(`invalid answer for ${s.subject}`);
        const props = proposalsFromAnswer(s, parsed.data, model);
        proposals.push(...props);
        if (!dryRun) {
          const { error } = await db.from('company_family_reviews').upsert({
            subject: s.subject,
            members_hash: membersHash(s.members),
            model,
            result: { members: s.members.map(m => m.id), answer: parsed.data },
            reviewed_at: new Date().toISOString(),
          }, { onConflict: 'subject' });
          if (error) result.errors.push(`review save ${s.subject}: ${error.message}`);
        }
      } catch (e) {
        result.model_failures++;
        if (result.errors.length < 20) result.errors.push(e instanceof Error ? e.message : String(e));
      }
    });
  }

  // 5. dedupe, protect human decisions, write
  const best = new Map<string, RelationProposal>();
  for (const p of proposals) {
    if (p.company_id === p.parent_id) continue;
    const k = `${p.company_id}:${p.parent_id}`;
    const cur = best.get(k);
    if (!cur || SOURCE_RANK[p.source] < SOURCE_RANK[cur.source]) best.set(k, p);
  }
  const final = [...best.values()];
  for (const p of final) result.proposals[p.source]++;

  const human = new Set<string>();
  const children = [...new Set(final.map(p => p.company_id))];
  for (let i = 0; i < children.length; i += 200) {
    const { data, error } = await db.from('company_relations').select('company_id, parent_id').eq('decided_by', 'human').in('company_id', children.slice(i, i + 200));
    if (error) throw new Error(`company_relations (human): ${error.message}`);
    for (const r of (data ?? []) as { company_id: string; parent_id: string }[]) human.add(`${r.company_id}:${r.parent_id}`);
  }
  const writable = final.filter(p => !human.has(`${p.company_id}:${p.parent_id}`));
  result.skipped_human = final.length - writable.length;

  const names = await loadCompanies(db, writable.slice(0, 40).flatMap(p => [p.company_id, p.parent_id]));
  result.sample = writable.slice(0, 40).map(p => ({
    child: names.get(p.company_id)?.name ?? p.company_id,
    parent: names.get(p.parent_id)?.name ?? p.parent_id,
    source: p.source,
    reason: typeof p.evidence.reason === 'string' ? p.evidence.reason : undefined,
  }));

  if (!dryRun) {
    const now = new Date().toISOString();
    for (let i = 0; i < writable.length; i += 500) {
      const chunk = writable.slice(i, i + 500).map(p => ({ ...p, status: 'accepted', updated_at: now }));
      const { error } = await db.from('company_relations').upsert(chunk, { onConflict: 'company_id,parent_id' });
      if (error) throw new Error(`company_relations upsert: ${error.message}`);
      result.written += chunk.length;
    }
    // Migration 199b: rows that differ only by legal suffix or punctuation ("AFT Pharmaceuticals" /
    // "Aft Pharmaceuticals Limited") get a name_stem relation before families are recomputed.
    const stem = await db.rpc('radar_link_name_stem_relations');
    if (stem.error) result.errors.push(`radar_link_name_stem_relations: ${stem.error.message}`);
    const { data, error } = await db.rpc('radar_refresh_company_families');
    if (error) result.errors.push(`radar_refresh_company_families: ${error.message}`);
    else result.families = (data ?? null) as Record<string, unknown> | null;
  }
  return result;
}
