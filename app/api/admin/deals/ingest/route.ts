// Manual Rapid Deal Ingestion — admin endpoint for ingesting deals from any URL
// POST with { url: string } to extract and insert a deal from an article/press release

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import {
  findOrCreateCompany,
  deriveTherapeuticArea,
} from '@/lib/ingestion/sec-edgar';
import { notifyHighValueDeal } from '@/lib/slack/notify';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Auth: check admin API key
  const authHeader = request.headers.get('authorization');
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${adminApiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing required field: url' }, { status: 400 });
    }

    // Fetch URL content with 10s timeout
    console.log(`[deal-ingest] Fetching: ${url}`);
    const fetchResponse = await fetch(url, {
      headers: {
        'User-Agent':
          'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!fetchResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${fetchResponse.status}` },
        { status: 422 }
      );
    }

    let rawContent = await fetchResponse.text();

    // Strip HTML tags and take first 5000 chars
    const textContent = rawContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000);

    if (textContent.length < 50) {
      return NextResponse.json(
        { error: 'Fetched content too short to extract a deal' },
        { status: 422 }
      );
    }

    // Send to Claude for deal extraction
    console.log(`[deal-ingest] Extracting deal from ${textContent.length} chars...`);
    const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 25_000 });

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      system: `You are an expert biopharma deal analyst. Extract structured deal information from articles and press releases. Be precise — only extract explicitly stated information, use null for unknown fields. Financial values in USD (full numbers, not millions shorthand).`,
      messages: [
        {
          role: 'user',
          content: `Extract structured deal information from this article. Return ONLY valid JSON with these fields:
{
  "licensor_name": "company granting rights",
  "licensee_name": "company receiving rights",
  "asset_name": "drug/compound name or null",
  "total_deal_value_usd": number or null,
  "upfront_usd": number or null,
  "milestones_total_usd": number or null,
  "royalty_range": "e.g. 10-15% or null",
  "deal_type": "license|acquisition|collaboration|option|codevelopment",
  "therapeutic_area": "oncology|neurology|immunology|cardiovascular|metabolic|infectiousDisease|rareDisease|ophthalmology|hematology|dermatology|gastroenterology|womensHealth|other",
  "indication_category": "specific category or null",
  "modality": "small_molecule|antibody|adc|bispecific|car_t|cell_therapy|gene_therapy|mrna|radiopharm|peptide|oligonucleotide|vaccine|other",
  "phase_at_signing": "discovery|preclinical|phase_1|phase_2|phase_3|approved|unknown",
  "territory": "global|us|ex_us|us_eu|other or null",
  "announced_date": "YYYY-MM-DD or null"
}

If this is NOT a biopharma deal, return: { "is_deal": false, "reason": "brief explanation" }

Article text:
${textContent}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'AI extraction returned non-text response' }, { status: 500 });
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response as JSON' }, { status: 500 });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: 'AI response contained invalid JSON' },
        { status: 500 }
      );
    }

    if (parsed.is_deal === false) {
      return NextResponse.json(
        { is_deal: false, reason: parsed.reason || 'Not a biopharma deal' },
        { status: 200 }
      );
    }

    // Validate required fields
    if (!parsed.licensor_name && !parsed.licensee_name) {
      return NextResponse.json(
        { error: 'Could not extract licensor or licensee from content' },
        { status: 422 }
      );
    }

    const supabase = createServiceClient();

    // Find or create companies
    const licensorId = parsed.licensor_name
      ? await findOrCreateCompany(supabase, parsed.licensor_name.trim(), false)
      : null;
    const licenseeId = parsed.licensee_name
      ? await findOrCreateCompany(supabase, parsed.licensee_name.trim(), true)
      : null;

    // Derive therapeutic area
    const therapeuticArea =
      parsed.therapeutic_area && parsed.therapeutic_area !== 'other'
        ? parsed.therapeutic_area
        : deriveTherapeuticArea(parsed.indication_category);

    // Parse royalty range into low/high
    let royaltyLow: number | null = null;
    let royaltyHigh: number | null = null;
    if (parsed.royalty_range && typeof parsed.royalty_range === 'string') {
      const royaltyMatch = parsed.royalty_range.match(/([\d.]+)(?:\s*[-–]\s*([\d.]+))?/);
      if (royaltyMatch) {
        royaltyLow = parseFloat(royaltyMatch[1]) / 100;
        royaltyHigh = royaltyMatch[2] ? parseFloat(royaltyMatch[2]) / 100 : royaltyLow;
      }
    }

    // Map deal_type to DB format
    const dealTypeMap: Record<string, string> = {
      license: 'license',
      acquisition: 'acquisition',
      collaboration: 'collaboration',
      option: 'option',
      codevelopment: 'co_development',
      co_development: 'co_development',
    };
    const dealType = dealTypeMap[parsed.deal_type] || parsed.deal_type || 'other';

    // Insert deal
    const { data: insertedDeal, error: insertError } = await supabase
      .from('deals')
      .insert({
        licensor_name: parsed.licensor_name || null,
        licensor_id: licensorId,
        licensee_name: parsed.licensee_name || null,
        licensee_id: licenseeId,
        asset_name: parsed.asset_name || null,
        modality: parsed.modality || null,
        indication_category: parsed.indication_category || null,
        phase_at_signing: parsed.phase_at_signing || 'unknown',
        territory: parsed.territory || null,
        deal_type: dealType,
        upfront_usd: parsed.upfront_usd || null,
        milestones_total_usd: parsed.milestones_total_usd || null,
        royalty_low_pct: royaltyLow,
        royalty_high_pct: royaltyHigh,
        total_deal_value_usd: parsed.total_deal_value_usd || null,
        announced_date: parsed.announced_date || new Date().toISOString().split('T')[0],
        source_type: 'manual_ingest',
        source_url: url,
        terms_disclosed:
          parsed.upfront_usd !== null || parsed.milestones_total_usd !== null,
        verified: true,
        verification_status: 'verified',
        confidence_score: 85,
        extraction_model: 'claude-opus-4-6',
        extraction_timestamp: new Date().toISOString(),
        therapeutic_area: therapeuticArea,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[deal-ingest] Insert error:', insertError);
      return NextResponse.json(
        { error: `Database insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    console.log(
      `[deal-ingest] Inserted: ${parsed.licensor_name} -> ${parsed.licensee_name} (${parsed.asset_name || dealType})`
    );

    // Send Slack notification
    try {
      await notifyHighValueDeal({
        licensee: parsed.licensee_name || 'Unknown',
        licensor: parsed.licensor_name || 'Unknown',
        asset: parsed.asset_name || 'Undisclosed',
        totalValue: parsed.total_deal_value_usd || 0,
        dealType: dealType,
        therapeuticArea,
        announcedDate: parsed.announced_date || new Date().toISOString().split('T')[0],
      });
    } catch (slackErr) {
      console.error('[deal-ingest] Slack notification failed (non-fatal):', slackErr);
    }

    return NextResponse.json({
      success: true,
      deal: insertedDeal,
    });
  } catch (error) {
    console.error('[deal-ingest] Error:', error);
    return NextResponse.json(
      { error: 'Deal ingestion failed', details: String(error) },
      { status: 500 }
    );
  }
}
