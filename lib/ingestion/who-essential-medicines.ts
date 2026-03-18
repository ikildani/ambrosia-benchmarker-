/**
 * WHO Essential Medicines List Ingestion
 *
 * Fetches the WHO Model List of Essential Medicines from the eEML API.
 * Used to flag indications with WHO-designated unmet need, which affects
 * deal valuation (regulatory pathway, pricing, and market access context).
 *
 * Source: https://list.essentialmeds.org/
 * Data: 1,418 recommendations, 667 medicines, 153 therapeutic equivalents
 * Updates: Every 2 years (24th list released Feb 2026)
 */

import { fetchWithTimeout } from '../fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';

const WHO_EML_API = 'https://list.essentialmeds.org/api/medicines';

interface WHOMedicine {
  name: string;
  atc_code?: string;
  category?: string;
  section?: string;
  indications?: string[];
  dosage_forms?: string[];
  is_complementary?: boolean;
}

/**
 * Fetch WHO Essential Medicines List and store as reference data.
 * Used to enrich deal context — deals for WHO-essential indications
 * may have regulatory advantages (prequalification, LMIC access).
 */
export async function runWHOEMLIngestion(
  supabase: SupabaseClient,
): Promise<{ fetched: number; stored: number; errors: string[] }> {
  const errors: string[] = [];
  let fetched = 0;
  let stored = 0;

  try {
    // The eEML site doesn't have a public REST API, so we use Perplexity
    // to get structured data from the WHO list pages
    const response = await fetchWithTimeout('https://list.essentialmeds.org/medicines', {
      timeoutMs: 20_000,
      headers: { 'Accept': 'text/html', 'User-Agent': 'Ambrosia Ventures research@ambrosiaventures.co' },
    });

    if (!response.ok) {
      errors.push(`WHO EML fetch failed: ${response.status}`);
      return { fetched, stored, errors };
    }

    const html = await response.text();

    // Extract medicine names from HTML (the page lists all medicines)
    const medicineMatches = html.match(/<a[^>]*class="[^"]*medicine[^"]*"[^>]*>([^<]+)<\/a>/gi);
    if (!medicineMatches) {
      errors.push('Could not parse WHO EML page');
      return { fetched, stored, errors };
    }

    const medicines: string[] = [];
    for (const match of medicineMatches) {
      const nameMatch = match.match(/>([^<]+)</);
      if (nameMatch) medicines.push(nameMatch[1].trim());
    }

    fetched = medicines.length;

    // Store in research_signals table for cross-reference
    for (const name of medicines) {
      const { error } = await supabase.from('research_signals').upsert({
        source_type: 'who_eml',
        source_id: `who-eml-${name.toLowerCase().replace(/\s+/g, '-')}`,
        title: name,
        abstract: `WHO Model List of Essential Medicines (24th list, 2026)`,
        therapeutic_area: 'other',
        signal_type: 'regulatory',
      }, { onConflict: 'source_type,source_id' });

      if (!error) stored++;
    }

    console.log(`[WHO EML] Fetched ${fetched} medicines, stored ${stored}`);
  } catch (err) {
    errors.push(`WHO EML error: ${err}`);
  }

  return { fetched, stored, errors };
}
