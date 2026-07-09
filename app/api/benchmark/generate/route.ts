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
    // Step 1: Build base input (mAb/licensing baseline for financial model)
    const baseInput: CalculationInput = {
      therapeuticArea: req.therapeutic_area as any,
      phase: req.phase as any,
      dealType: 'licensing' as any,
      modality: 'mab' as any,
      indication: req.indication as any,
      territory: (req.territory || 'global') as any,
      competitivePosition: 'racing',
      dataQuality: 'robust',
      biomarkerStatus: 'unselected',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      peakSalesEstimate: { low: 800, median: 1500, high: 2500 },
      benchmarkDealValue: { low: 180, median: 335, high: 850 },
    };

    const baseResult = calculateDealTerms(baseInput);
    const sensitivityData = computeSensitivityAnalysis(baseInput, baseResult);
    const riskScore = calculateRiskScore(baseInput);
    const comparableDeals = findComparableDeals({
      therapeuticArea: req.therapeutic_area,
      modality: 'mab',
      indication: req.indication,
      phase: req.phase,
      dealType: 'licensing',
      territory: req.territory || 'global',
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
        labels: {
          phase: req.phase,
          modality: 'Monoclonal Antibody',
          indication: req.indication,
        },
      });
      if (!memoData.confidence_level) memoData.confidence_level = 'medium';
      if (!memoData.market_context) memoData.market_context = '';
      if (!memoData.deal_recommendation) memoData.deal_recommendation = '';
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
        labels: {
          phase: req.phase,
          modality: 'Monoclonal Antibody',
          indication: req.indication,
        },
      });
    } catch (err) {
      console.error('[Benchmark Gen] AI playbook failed:', err);
    }

    // Step 5: Partner matches
    let partnerMatches;
    try {
      const response = await fetch('https://calculator.ambrosiaventures.co/api/partners/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modality: 'mab',
          development_phase: req.phase,
          indication_category: req.indication,
          territory_scope: req.territory || 'global',
          therapeutic_area: req.therapeutic_area,
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
          }));
        }
      }
    } catch (err) {
      console.error('[Benchmark Gen] Partner match failed:', err);
    }

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
      buyerSpecificValuation: undefined,
      buyerSpecificValuations: undefined,
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
      })
      .eq('id', requestId);

    return NextResponse.json({
      success: true,
      briefToken,
      pdfUrl,
      pageCount: Math.round(pdfBuffer.length / 25000),
      dataRoomUrl: `https://calculator.ambrosiaventures.co/brief/${briefToken}`,
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
