/**
 * Benchmark Generation API — Admin-authenticated endpoint that generates
 * a Deal Intelligence Brief for a given benchmark_request ID.
 *
 * Triggered manually by admin after the intake call.
 * Runs the full pipeline: 52 calculations + financial model + AI memo +
 * AI playbook + partner matches + Puppeteer PDF rendering.
 *
 * POST /api/benchmark/generate { requestId: string }
 * Auth: ADMIN_API_KEY or admin email session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';
import { computeSensitivityAnalysis } from '@/lib/sensitivity';
import { calculateRiskScore } from '@/lib/calculations';
import { findComparableDeals } from '@/lib/comparableDeals';
import { runFinancialModel } from '@/lib/financial/run-financial-model';
import { generateReportHTML } from '@/lib/report';
import { getDealMemoGenerator } from '@/lib/ai/deal-memo-generator';
import { getPlaybookGenerator } from '@/lib/ai/playbook-generator';
import type { PDFReportData } from '@/lib/report/types';
import { renderPDFBuffer } from '@/lib/report/server-renderer';
import epiData from '@/data/epidemiology.json';
import { resolveIntake } from '@/lib/brief/intake-map';
import { buildBrief } from '@/lib/brief/build';
import { modalityLabels } from '@/lib/report/helpers';
import type { MPOpinion } from '@/lib/brief/types';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function isAdminAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader === `Bearer ${adminKey}`) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!isAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { requestId } = await request.json();
  if (!requestId) {
    return NextResponse.json({ error: 'requestId required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: req, error: fetchErr } = await supabase
    .from('benchmark_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchErr || !req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  // Update status to generating
  await supabase
    .from('benchmark_requests')
    .update({ status: 'generating', generation_started_at: new Date().toISOString() })
    .eq('id', requestId);

  try {
    // Step 1: Resolve the intake into engine keys + asset profile (v3)
    const resolved = resolveIntake(req, modalityLabels);
    const baseInput: CalculationInput = {
      ...resolved.input,
      peakSalesOverrideM: (resolved.input as { peakSalesOverrideM?: number }).peakSalesOverrideM,
    } as CalculationInput;
    const genNotes: string[] = [...resolved.notes];

    const baseResult = calculateDealTerms(baseInput);
    const sensitivityData = computeSensitivityAnalysis(baseInput, baseResult);
    const riskScore = calculateRiskScore(baseInput);
    const comparableDeals = findComparableDeals({
      therapeuticArea: baseInput.therapeuticArea,
      modality: baseInput.modality,
      indication: baseInput.indication,
      phase: baseInput.phase,
      dealType: baseInput.dealType,
      territory: baseInput.territory,
    }, 8);

    // Step 2: Financial model
    const fm = runFinancialModel(baseInput, baseResult, (epiData as any).indications);

    // Step 3: AI Deal Memo (with custom notes injected)
    let memoData;
    try {
      const memoGen = getDealMemoGenerator();
      memoData = await memoGen.generateMemo({
        inputs: baseInput,
        results: baseResult,
        labels: resolved.labels,
      });
      if (!memoData.confidence_level) memoData.confidence_level = 'medium';
      if (!memoData.market_context) memoData.market_context = '';
    } catch (err) {
      console.error('[Benchmark Gen] AI memo failed:', err);
    }

    // Step 4: AI Playbook
    let playbookData;
    try {
      const playbookGen = getPlaybookGenerator();
      playbookData = await playbookGen.generatePlaybook({
        inputs: baseInput,
        results: baseResult,
        labels: resolved.labels,
      });
    } catch (err) {
      console.error('[Benchmark Gen] AI playbook failed:', err);
    }

    // Step 5: Partner matches
    let partnerMatches;
    try {
      const response = await fetch('https://solidus.ambrosiaventures.co/api/partners/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modality: baseInput.modality,
          development_phase: baseInput.phase,
          indication_category: baseInput.indication,
          territory_scope: baseInput.territory,
          therapeutic_area: baseInput.therapeuticArea,
          tier: 'pro',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.matches?.length > 0) {
          partnerMatches = data.matches.map((m: any) => ({
            company_name: m.company_name,
            match_score: m.match_score,
            match_reasons: m.match_reasons || [],
            deals_last_12mo: m.deals_last_12mo || 0,
            hq_country: m.hq_country,
            strategic_context: m.strategic_context || null,
            pharma_intent: m.pharma_intent || null,
            company_id: m.company_id ?? null,
            company_type: m.company_type ?? null,
            deals_last_24mo: m.deals_last_24mo ?? null,
            last_deal_date: m.last_deal_date ?? null,
            phase_preference_min: m.phase_preference_min ?? null,
            phase_preference_max: m.phase_preference_max ?? null,
            acquisition_appetite: m.acquisition_appetite ?? null,
            median_upfront_usd: m.median_upfront_usd ?? null,
          }));
        }
      }
    } catch (err) {
      console.error('[Benchmark Gen] Partner match failed:', err);
    }

    // Step 5b: Brief v3 intelligence layer (comps, buyers, landscape, bridge, decision…)
    const mpOpinion: MPOpinion | null = req.mp_opinion
      ? { text: req.mp_opinion, reviewer: req.mp_reviewer || 'Issa Kildani, Managing Partner', reviewedAt: req.mp_reviewed_at || new Date().toISOString() }
      : null;
    const built = await buildBrief({
      supabase,
      asset: resolved.asset,
      inputs: baseInput,
      result: baseResult,
      fm,
      partners: partnerMatches ?? [],
      memo: memoData,
      defensive: fm.defensiveAnalysis,
      mpOpinion,
      diligenceReady: req.diligence_ready ?? [],
      diligenceGaps: req.diligence_gaps ?? [],
      log: (m) => console.log(m),
    });
    genNotes.push(...built.notes);

    // Step 6: Assemble PDFReportData
    const pdfData: PDFReportData = {
      result: baseResult,
      inputs: baseInput,
      sensitivityData,
      riskScore,
      partnerMatches: partnerMatches || undefined,
      memoData: memoData || undefined,
      playbookData: playbookData || undefined,
      comparableDeals,
      rnpvResult: fm.rnpv,
      monteCarloResult: fm.monteCarlo,
      marketSizeEstimate: fm.marketSize ?? undefined,
      scenarioResults: fm.scenarios,
      fxSensitivity: fm.fxSensitivity,
      defensiveAnalysis: fm.defensiveAnalysis,
      dealWaterfall: fm.dealWaterfall,
      scenarioComparison: fm.scenarioComparison,
      lifecycleExtensions: fm.lifecycleExtensions,
      competitiveDynamics: fm.competitiveDynamics,
      realOptions: fm.realOptions,
      buyerSpecificValuation: built.buyerValuations[0],
      buyerSpecificValuations: built.buyerValuations.length ? built.buyerValuations : undefined,
      brief: built.brief,
      regulatoryRisk: fm.regulatoryRisk,
      milestoneProbabilities: fm.milestoneProbabilities,
      earnoutValuation: fm.earnoutValuation,
      patentDynamics: fm.patentDynamics,
      cmcRisk: fm.cmcRisk,
      pricingConstraints: fm.pricingConstraints,
      indicationSequence: fm.indicationSequence,
      taxStructure: fm.taxStructure,
      royaltyStacking: fm.royaltyStacking,
      buyerSynergies: fm.buyerSynergies,
    };

    // Step 7: Build white-label config if requested
    const brandConfig = req.white_label ? {
      fundName: req.brand_name || undefined,
      primaryColor: req.brand_primary_color || undefined,
      secondaryColor: req.brand_secondary_color || undefined,
    } : undefined;

    // Step 8: Generate HTML + PDF
    const html = generateReportHTML(pdfData, brandConfig);
    const pdfBuffer = await renderPDFBuffer(html);

    // Step 9: Upload to Supabase Storage
    const briefToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const pdfPath = `briefs/${briefToken}/report.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from('reports')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    let pdfUrl = '';
    if (!uploadErr) {
      const { data: urlData } = supabase.storage
        .from('reports')
        .getPublicUrl(pdfPath);
      pdfUrl = urlData.publicUrl;
    }

    // Step 10: Update record
    await supabase
      .from('benchmark_requests')
      .update({
        status: 'delivered',
        generation_completed_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        pdf_url: pdfUrl,
        brief_token: briefToken,
        brief_page_count: Math.round(pdfBuffer.length / 25000),
        admin_notes: genNotes.length ? `v3 build notes:\n${genNotes.join('\n')}` : req.admin_notes,
      })
      .eq('id', requestId);

    return NextResponse.json({
      success: true,
      briefToken,
      pdfUrl,
      pageCount: Math.round(pdfBuffer.length / 25000),
      dataRoomUrl: `https://solidus.ambrosiaventures.co/brief/${briefToken}`,
    });
  } catch (error) {
    console.error('[Benchmark Gen] Fatal error:', error);
    await supabase
      .from('benchmark_requests')
      .update({ status: 'intake', admin_notes: `Generation failed: ${(error as Error).message}` })
      .eq('id', requestId);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
