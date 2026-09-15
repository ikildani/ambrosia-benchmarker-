#!/usr/bin/env npx tsx
/**
 * Backfill identity fields on existing user_profiles.
 *
 * Dry run by default: prints, per profile, what the domain and companies-table
 * pass would fill and whether Apollo would be needed. --apply writes and logs
 * profile_enriched events. --apollo includes Apollo calls (costs credits);
 * without it the run is free and only uses the email domain and the
 * companies table.
 *
 * Usage:
 *   npx tsx scripts/backfill-profile-enrichment.ts               # dry run, no Apollo
 *   npx tsx scripts/backfill-profile-enrichment.ts --apollo      # dry run incl. Apollo lookups
 *   npx tsx scripts/backfill-profile-enrichment.ts --apply
 *   npx tsx scripts/backfill-profile-enrichment.ts --apply --apollo
 */

import { createClient } from '@supabase/supabase-js';
import { computeEnrichment, enrichProfile, type EnrichableProfile } from '@/lib/enrichment/profile-enrichment';
import { emailDomain, isAcademicDomain, isFreeMailDomain } from '@/lib/enrichment/free-mail-domains';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const USE_APOLLO = args.has('--apollo');

/** Internal, partner and test accounts: never enrich against Apollo. */
const EXCLUDE = /@ambrosiaventures\.co$|@scirena\.bio$|@rubixls\.com$|^testallfreemx@/i;

async function main() {
  console.log(`MODE: ${APPLY ? 'APPLY (writing)' : 'dry run'} | Apollo: ${USE_APOLLO ? (process.env.APOLLO_API_KEY ? 'on' : 'requested but APOLLO_API_KEY missing') : 'off'}`);
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, company_name, company_domain, company_type, job_title, job_function, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const profiles = (data || []) as Array<EnrichableProfile & { created_at: string }>;

  const tally = { total: profiles.length, excluded: 0, complete: 0, freeMail: 0, academic: 0, corporate: 0,
    companiesMatch: 0, domainGuess: 0, needsApollo: 0, apolloFilledName: 0, apolloFilledCompany: 0 };
  const rows: string[] = [];

  for (const p of profiles) {
    if (EXCLUDE.test(p.email)) { tally.excluded += 1; continue; }
    const needsName = !p.full_name?.trim();
    const needsCompany = !p.company_name?.trim();
    if (!needsName && !needsCompany) { tally.complete += 1; continue; }
    const domain = emailDomain(p.email) || '';
    const free = isFreeMailDomain(domain);
    const academic = isAcademicDomain(domain);
    if (free) tally.freeMail += 1; else if (academic) tally.academic += 1; else tally.corporate += 1;

    const r = APPLY
      ? await enrichProfile(supabase, p, { useApollo: USE_APOLLO })
      : await computeEnrichment(supabase, p, { useApollo: USE_APOLLO });

    if (r.sources.company_name === 'companies') tally.companiesMatch += 1;
    if (r.sources.company_name === 'domain') tally.domainGuess += 1;
    if (r.sources.full_name === 'apollo') tally.apolloFilledName += 1;
    if (r.sources.company_name === 'apollo') tally.apolloFilledCompany += 1;
    const stillNeedsName = needsName && !r.filled.full_name;
    if (stillNeedsName) tally.needsApollo += 1;

    rows.push(`${p.email.padEnd(42)} ${free ? 'free-mail' : academic ? 'academic' : 'corporate'} | ` +
      `name: ${r.filled.full_name ? `${r.filled.full_name} (${r.sources.full_name})` : needsName ? 'MISSING' : 'ok'} | ` +
      `company: ${r.filled.company_name ? `${r.filled.company_name} (${r.sources.company_name})` : needsCompany ? 'MISSING' : 'ok'}` +
      `${r.filled.company_type ? ` | type: ${r.filled.company_type} (${r.sources.company_type})` : ''}`);
  }

  console.log(rows.join('\n'));
  console.log('\n== Summary ==');
  console.log(JSON.stringify(tally, null, 2));
  console.log(`\nNames only Apollo can supply (domain/companies cannot): ${tally.needsApollo}`);
}

main().catch(err => { console.error(err); process.exit(1); });
