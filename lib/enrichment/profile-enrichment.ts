/**
 * Profile enrichment: fill empty identity fields on user_profiles from the
 * cheapest reliable source, in order.
 *
 *   1. domain     company_domain from the email (skips free-mail and academic)
 *   2. companies  match the domain label against the companies table for
 *                 company_name and company_type
 *   3. apollo     when APOLLO_API_KEY is set: people match by email for name
 *                 and title, organization enrich by domain for company type
 *
 * Only empty fields are written; anything the user typed wins. Every call
 * that fills something logs a `profile_enriched` event. Errors never
 * propagate to the caller: signup must not fail because enrichment did.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { emailDomain, isAcademicDomain, isFreeMailDomain } from './free-mail-domains';

export type EnrichmentSource = 'domain' | 'companies' | 'apollo';

export interface EnrichableProfile {
  id: string;
  email: string;
  full_name?: string | null;
  company_name?: string | null;
  company_domain?: string | null;
  company_type?: string | null;
  job_title?: string | null;
  job_function?: string | null;
}

export interface EnrichmentResult {
  filled: Partial<Pick<EnrichableProfile, 'full_name' | 'company_name' | 'company_domain' | 'company_type' | 'job_title'>>;
  sources: Partial<Record<keyof EnrichmentResult['filled'], EnrichmentSource>>;
  skipped?: 'free_mail' | 'no_domain' | 'complete';
  apolloUsed: boolean;
}

/**
 * "apogeepharma.ca" → "Apogee Pharma"; "wego-solutions.com" → "Wego Solutions";
 * "huishengvc.com" → "Huisheng VC"; "isomorphiclabs.com" → "Isomorphic Labs".
 * Splits on separators and on a trailing industry token when the label is
 * one run of letters. A readable guess the user is asked to confirm, not truth.
 */
const DOMAIN_SUFFIX_TOKENS = ['therapeutics', 'biosciences', 'bioscience', 'pharmaceuticals', 'pharma', 'biotech', 'genomics',
  'ventures', 'capital', 'partners', 'advisory', 'consulting', 'health', 'medical', 'labs', 'lab', 'bio', 'med', 'tx', 'vc', 'rx'];
const UPPER_TOKENS = new Set(['vc', 'rx', 'tx']);
export function guessCompanyNameFromDomain(domain: string): string {
  const label = domain.toLowerCase().split('.')[0] || domain;
  let parts = label.split(/[-_]+/).filter(Boolean);
  if (parts.length === 1) {
    const word = parts[0];
    for (const suf of DOMAIN_SUFFIX_TOKENS) {
      if (word.length > suf.length + 2 && word.endsWith(suf)) {
        parts = [word.slice(0, -suf.length), suf];
        break;
      }
    }
  }
  return parts
    .map(w => (UPPER_TOKENS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Normalize for matching: lower-case alphanumerics only, then strip corporate
 * and industry suffixes from the END repeatedly, so "Apogee Pharma Inc." and
 * the domain label "apogeepharma" both reduce to "apogee".
 */
const MATCH_SUFFIXES = ['incorporated', 'pharmaceuticals', 'pharmaceutical', 'therapeutics', 'biosciences', 'bioscience',
  'corporation', 'holdings', 'holding', 'ventures', 'venture', 'limited', 'company', 'biotech', 'genomics', 'capital',
  'partners', 'pharma', 'group', 'labs', 'gmbh', 'corp', 'inc', 'ltd', 'llc', 'plc', 'bio', 'lab', 'ag', 'sa', 'nv', 'bv', 'ab', 'co']
  .sort((a, b) => b.length - a.length);
export function normalizeCompanyToken(s: string): string {
  let t = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of MATCH_SUFFIXES) {
      if (t.length > suf.length + 2 && t.endsWith(suf)) {
        t = t.slice(0, -suf.length);
        changed = true;
      }
    }
  }
  return t;
}

const COMPANY_TYPE_ALLOWED = new Set(['pharma_large', 'pharma_mid', 'biotech', 'investor_vc', 'investor_pe', 'advisor', 'other']);

/**
 * Look the domain label up in the companies table. Match rule: the
 * normalized domain label must equal the normalized company name (or one of
 * its name variations). A prefix ilike narrows the candidate set first.
 */
export async function matchCompanyByDomain(
  supabase: SupabaseClient,
  domain: string,
): Promise<{ name: string; company_type: string | null } | null> {
  const label = domain.toLowerCase().split('.')[0];
  if (!label || label.length < 3) return null;
  const firstToken = label.split(/[-_]/)[0];
  const { data, error } = await supabase
    .from('companies')
    .select('name, name_variations, company_type')
    .ilike('name', `${firstToken}%`)
    .limit(25);
  if (error || !data) return null;
  const want = normalizeCompanyToken(label);
  const wantRaw = label.replace(/[^a-z0-9]/g, '');
  for (const row of data as Array<{ name: string; name_variations: string[] | null; company_type: string | null }>) {
    const names = [row.name, ...(row.name_variations || [])];
    for (const n of names) {
      const norm = normalizeCompanyToken(n);
      const raw = n.toLowerCase().replace(/[^a-z0-9]/g, '');
      if ((norm && norm === want) || raw === wantRaw) {
        return { name: row.name, company_type: row.company_type && COMPANY_TYPE_ALLOWED.has(row.company_type) ? row.company_type : null };
      }
    }
  }
  return null;
}

interface ApolloPerson { first_name?: string; last_name?: string; name?: string; title?: string; organization?: { name?: string; industry?: string; estimated_num_employees?: number } }

/** Map Apollo industry / headcount to the profile's company_type vocabulary. */
export function apolloCompanyType(industry?: string | null, employees?: number | null): string | null {
  const ind = (industry || '').toLowerCase();
  if (/venture|private equity|investment|capital/.test(ind)) return /private equity/.test(ind) ? 'investor_pe' : 'investor_vc';
  if (/consult|advis|law|legal|accounting/.test(ind)) return 'advisor';
  if (/pharma|biotech|life science|medical|health/.test(ind)) {
    if (employees != null && employees >= 10000) return 'pharma_large';
    if (employees != null && employees >= 1000) return 'pharma_mid';
    return 'biotech';
  }
  return null;
}

async function apolloPeopleMatch(email: string, apiKey: string): Promise<ApolloPerson | null> {
  const res = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': apiKey },
    body: JSON.stringify({ email, reveal_personal_emails: false }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { person?: ApolloPerson };
  return json.person ?? null;
}

async function apolloOrganizationEnrich(domain: string, apiKey: string): Promise<{ name?: string; industry?: string; estimated_num_employees?: number } | null> {
  const res = await fetch(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`, {
    headers: { 'Cache-Control': 'no-cache', 'X-Api-Key': apiKey },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { organization?: { name?: string; industry?: string; estimated_num_employees?: number } };
  return json.organization ?? null;
}

/** Compute what enrichment would fill. Pure with respect to user_profiles: no writes. */
export async function computeEnrichment(
  supabase: SupabaseClient,
  profile: EnrichableProfile,
  options: { apolloApiKey?: string | null; useApollo?: boolean } = {},
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = { filled: {}, sources: {}, apolloUsed: false };
  const needsName = !profile.full_name?.trim();
  const needsCompany = !profile.company_name?.trim();
  const needsType = !profile.company_type;
  const needsTitle = !profile.job_title?.trim();
  if (!needsName && !needsCompany && !needsType && !needsTitle) {
    result.skipped = 'complete';
    return result;
  }

  const domain = emailDomain(profile.email);
  if (!domain) { result.skipped = 'no_domain'; return result; }
  const freeMail = isFreeMailDomain(domain);
  const academic = isAcademicDomain(domain);

  // 1. domain
  if (!freeMail && !profile.company_domain) {
    result.filled.company_domain = domain;
    result.sources.company_domain = 'domain';
  }

  // 2. companies table
  if (!freeMail && !academic && (needsCompany || needsType)) {
    try {
      const match = await matchCompanyByDomain(supabase, domain);
      if (match) {
        if (needsCompany) { result.filled.company_name = match.name; result.sources.company_name = 'companies'; }
        if (needsType && match.company_type) { result.filled.company_type = match.company_type; result.sources.company_type = 'companies'; }
      }
    } catch { /* never fail the caller */ }
  }

  // 3. Apollo
  const apiKey = options.apolloApiKey ?? process.env.APOLLO_API_KEY ?? null;
  const useApollo = options.useApollo ?? true;
  if (apiKey && useApollo && (needsName || needsTitle || (needsCompany && !result.filled.company_name) || (needsType && !result.filled.company_type))) {
    try {
      result.apolloUsed = true;
      const person = await apolloPeopleMatch(profile.email, apiKey);
      if (person) {
        const name = person.name || [person.first_name, person.last_name].filter(Boolean).join(' ');
        if (needsName && name) { result.filled.full_name = name; result.sources.full_name = 'apollo'; }
        if (needsTitle && person.title) { result.filled.job_title = person.title; result.sources.job_title = 'apollo'; }
        if (needsCompany && !result.filled.company_name && person.organization?.name) {
          result.filled.company_name = person.organization.name; result.sources.company_name = 'apollo';
        }
        if (needsType && !result.filled.company_type) {
          const t = apolloCompanyType(person.organization?.industry, person.organization?.estimated_num_employees);
          if (t) { result.filled.company_type = t; result.sources.company_type = 'apollo'; }
        }
      }
      if (!freeMail && !academic && ((needsCompany && !result.filled.company_name) || (needsType && !result.filled.company_type))) {
        const org = await apolloOrganizationEnrich(domain, apiKey);
        if (org) {
          if (needsCompany && !result.filled.company_name && org.name) { result.filled.company_name = org.name; result.sources.company_name = 'apollo'; }
          if (needsType && !result.filled.company_type) {
            const t = apolloCompanyType(org.industry, org.estimated_num_employees);
            if (t) { result.filled.company_type = t; result.sources.company_type = 'apollo'; }
          }
        }
      }
    } catch { /* never fail the caller */ }
  }

  // Last resort for a corporate domain with no match anywhere: a readable guess
  // from the domain label, clearly attributed so the UI can ask the user to confirm.
  if (needsCompany && !result.filled.company_name && !freeMail && !academic) {
    result.filled.company_name = guessCompanyNameFromDomain(domain);
    result.sources.company_name = 'domain';
  }

  if (Object.keys(result.filled).length === 0) result.skipped = freeMail ? 'free_mail' : undefined;
  return result;
}

/** Best single source label for the row, most authoritative first. */
export function summarizeSource(sources: EnrichmentResult['sources']): EnrichmentSource | null {
  const vals = Object.values(sources) as EnrichmentSource[];
  if (vals.includes('apollo')) return 'apollo';
  if (vals.includes('companies')) return 'companies';
  if (vals.includes('domain')) return 'domain';
  return null;
}

/** Compute and persist. Returns what was written. Never throws. */
export async function enrichProfile(
  supabase: SupabaseClient,
  profile: EnrichableProfile,
  options: { apolloApiKey?: string | null; useApollo?: boolean } = {},
): Promise<EnrichmentResult> {
  const result = await computeEnrichment(supabase, profile, options);
  const keys = Object.keys(result.filled);
  try {
    const source = summarizeSource(result.sources);
    await supabase
      .from('user_profiles')
      .update({
        ...result.filled,
        profile_enriched_at: new Date().toISOString(),
        ...(source && keys.some(k => k !== 'company_domain') ? { profile_enrichment_source: source } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);
    if (keys.length > 0) {
      await supabase.from('events').insert({
        user_id: profile.id,
        event_type: 'profile_enriched',
        event_data: { filled: result.filled, sources: result.sources, apollo_used: result.apolloUsed },
        user_tier: 'free',
      });
    }
  } catch { /* never fail the caller */ }
  return result;
}
