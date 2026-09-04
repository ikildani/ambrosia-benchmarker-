/**
 * Asset Radar — Natural Language Search
 *
 * POST /api/radar/search
 *   { "query": "Unpartnered Phase 2+ ADCs in oncology from European companies" }
 *
 * Uses Claude to parse natural language into structured filters,
 * then queries clinical_assets with those filters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const anthropic = new Anthropic();

interface ParsedFilters {
  therapeutic_area?: string;
  modality?: string;
  phase_min?: string;
  indication?: string;
  partnership_status?: string;
  country?: string;
  region?: string;
  min_intent_score?: number;
  min_heat?: number;
  min_readiness?: number;
  company_name?: string;
  asset_name?: string;
  sort_by?: string;
  limit?: number;
}

const PARSE_PROMPT = `You are a pharma deal intelligence search parser. Convert the user's natural language query into a JSON filter object. Return ONLY valid JSON, no explanation.

Available filters:
- therapeutic_area: oncology, neurology, immunology, cardiovascular, metabolic, rare_disease, hematology, infectious_disease, ophthalmology, dermatology, respiratory
- modality: small_molecule, antibody, adc, bispecific, car_t, cell_therapy, gene_therapy, mrna, peptide, oligonucleotide, vaccine, radiopharm
- phase_min: preclinical, phase_1, phase_1_2, phase_2, phase_2_3, phase_3, approved (minimum phase)
- indication: specific indication text to search
- partnership_status: unpartnered, partnered, partially_partnered
- country: ISO country name (e.g., "US", "Japan", "Germany")
- region: continent/region (e.g., "Europe", "Asia", "North America")
- min_intent_score: 0-100 (minimum licensing intent)
- min_heat: 0-100 (minimum competitive heat)
- min_readiness: 0-100 (minimum deal readiness)
- company_name: partial company name match
- asset_name: partial asset name match
- sort_by: licensing_intent, deal_readiness, competitive_heat, confidence, newest
- limit: max results (default 30, max 100)

Examples:
"Phase 2+ ADCs in oncology" → {"modality":"adc","therapeutic_area":"oncology","phase_min":"phase_2"}
"Unpartnered neurology assets with high intent" → {"therapeutic_area":"neurology","partnership_status":"unpartnered","min_intent_score":50}
"Show me what Pfizer should be looking at" → {"sort_by":"licensing_intent","min_intent_score":30}
"Japanese biotech small molecules" → {"country":"Japan","modality":"small_molecule"}
"Hot assets in rare disease" → {"therapeutic_area":"rare_disease","sort_by":"competitive_heat","min_heat":30}`;

const PHASE_ORDER: Record<string, number> = {
  preclinical: 1, phase_1: 2, phase_1_2: 3, phase_2: 4,
  phase_2_3: 5, phase_3: 6, phase_4: 7, approved: 8,
};

const PHASE_VALUES: Record<number, string[]> = {
  1: ['preclinical'],
  2: ['phase1', 'phase_1', 'early_phase1', 'Phase 1', 'Early Phase 1'],
  3: ['phase1_phase2', 'phase_1_2', 'Phase 1/Phase 2'],
  4: ['phase2', 'phase_2', 'Phase 2'],
  5: ['phase2_phase3', 'phase_2_3', 'Phase 2/Phase 3'],
  6: ['phase3', 'phase_3', 'Phase 3'],
  7: ['phase4', 'phase_4', 'Phase 4'],
  8: ['approved', 'Approved'],
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const query = body.query;

  if (!query || typeof query !== 'string' || query.length < 3) {
    return NextResponse.json({ error: 'Query must be at least 3 characters' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    // Parse natural language to structured filters
    const parseResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [
        { role: 'user', content: `${PARSE_PROMPT}\n\nQuery: "${query}"` },
      ],
    });

    const parseText = parseResponse.content[0];
    if (parseText.type !== 'text') {
      return NextResponse.json({ error: 'Failed to parse query' }, { status: 500 });
    }

    let filters: ParsedFilters;
    try {
      const jsonMatch = parseText.text.match(/\{[\s\S]*\}/);
      filters = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      return NextResponse.json({ error: 'Failed to parse query into filters', raw: parseText.text }, { status: 400 });
    }

    // Build Supabase query
    let dbQuery = supabase
      .from('clinical_assets')
      .select('id, company_id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, trial_status, trial_count, enrollment_total, partnership_status, partner_company_name, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score, originator_country, originator_region, first_posted_date, last_update_date, nct_ids, territory_rights_available', { count: 'exact' });

    if (filters.therapeutic_area) dbQuery = dbQuery.eq('therapeutic_area', filters.therapeutic_area);
    if (filters.modality) dbQuery = dbQuery.eq('modality', filters.modality);
    if (filters.partnership_status) dbQuery = dbQuery.eq('partnership_status', filters.partnership_status);
    if (filters.country) dbQuery = dbQuery.ilike('originator_country', `%${filters.country}%`);
    if (filters.region) dbQuery = dbQuery.ilike('originator_region', `%${filters.region}%`);
    if (filters.company_name) dbQuery = dbQuery.ilike('company_name', `%${filters.company_name}%`);
    if (filters.asset_name) dbQuery = dbQuery.ilike('asset_name', `%${filters.asset_name}%`);
    if (filters.indication) dbQuery = dbQuery.or(`indication_category.ilike.%${filters.indication}%,indication_specific.ilike.%${filters.indication}%`);
    if (filters.min_intent_score) dbQuery = dbQuery.gte('licensing_intent_score', filters.min_intent_score);
    if (filters.min_heat) dbQuery = dbQuery.gte('competitive_heat', filters.min_heat);
    if (filters.min_readiness) dbQuery = dbQuery.gte('deal_readiness_score', filters.min_readiness);

    // Phase minimum filter
    if (filters.phase_min) {
      const minOrder = PHASE_ORDER[filters.phase_min] || 0;
      const allowedPhases: string[] = [];
      for (const [order, phases] of Object.entries(PHASE_VALUES)) {
        if (Number(order) >= minOrder) allowedPhases.push(...phases);
      }
      if (allowedPhases.length > 0) {
        dbQuery = dbQuery.in('phase', allowedPhases);
      }
    }

    // Sorting
    switch (filters.sort_by) {
      case 'deal_readiness':
        dbQuery = dbQuery.order('deal_readiness_score', { ascending: false });
        break;
      case 'competitive_heat':
        dbQuery = dbQuery.order('competitive_heat', { ascending: false });
        break;
      case 'confidence':
        dbQuery = dbQuery.order('confidence_score', { ascending: false });
        break;
      case 'newest':
        dbQuery = dbQuery.order('last_update_date', { ascending: false });
        break;
      default:
        dbQuery = dbQuery.order('licensing_intent_score', { ascending: false });
    }

    const limit = Math.min(filters.limit || 30, 100);
    dbQuery = dbQuery.limit(limit);

    const { data: assets, count, error } = await dbQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      query,
      parsed_filters: filters,
      assets: assets || [],
      total: count || 0,
      limit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
