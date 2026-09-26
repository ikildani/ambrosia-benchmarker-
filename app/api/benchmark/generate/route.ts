/**
 * Benchmark Generation API — Admin-authenticated endpoint that generates
 * a Deal Intelligence Brief for a given benchmark_request ID.
 *
 * Triggered manually by admin after the intake call.
 * Runs the full pipeline: engine + financial model + strategic memo +
 * AI playbook + partner matches + Puppeteer PDF rendering.
 *
 * POST /api/benchmark/generate { requestId: string }
 * Auth: ADMIN_API_KEY or admin email session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureBenchmarksLoaded } from '@/lib/benchmarks';
import { parseClientIntake, dataPackageToDiligence } from '@/lib/brief/client-intake';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';
import { computeSensitivityAnalysis } from '@/lib/sensitivity';
import { calculateRiskScore } from '@/lib/calculations';
import { findComparableDeals } from '@/lib/comparableDeals';
import { runFinancialModel } from '@/lib/financial/run-financial-model';
import { generateReportHTML } from '@/lib/report';
import { getDealMemoGenerator } from '@/lib/ai/deal-memo-generator';
import { getPlaybookGenerator } from '@/lib/ai/playbook-generator';
import type { PDFReportData, PartnerForPDF } from '@/lib/report/types';
import { renderPDFBuffer } from '@/lib/report/server-renderer';
import epiData from '@/data/epidemiology.json';
import { resolveIntake } from '@/lib/brief/intake-map';
import { buildBrief } from '@/lib/brief/build';
import { recordBriefPrediction } from '@/lib/outcomes/writers';
import { loadPriorsSnapshot } from '@/lib/outcomes/priors-snapshot';
import { fetchBriefPartners } from '@/lib/brief/partners';
import { buildExcelWorkbook } from '@/lib/generateExcel';
import { addBriefSheets } from '@/lib/brief/excel-sheets';
import { sendEmail } from '@/lib/email/client';
import { buildDeliveryEmail, dataRoomUrl, mintBriefLinks, DELIVERY_COLUMNS, SIGNED_URL_TTL_SECONDS, type BriefDeliveryRow } from '@/lib/brief/delivery';
import { modalityLabels } from '@/lib/report/helpers';
import type { MPOpinion } from '@/lib/brief/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function isAdminAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader === `Bearer ${adminKey}`) return true;
  // Internal callers (the intake route's automatic draft) authenticate with the cron secret.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('x-internal-secret') === cronSecret) return true;
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

    // Live calibrations overlay the static tables only once the cache is warm. Without this a
    // brief generated on a cold instance priced from data/benchmarks.json (found Sep 26 2026).
    await ensureBenchmarksLoaded();
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

    // Step 5: Partner matches — direct library call with the service client.
    // The HTTP endpoint resolves tier from the session (none here) and served
    // the free tier (3 locked matches); see lib/brief/partners.ts. Pool size
    // BRIEF_PARTNER_POOL feeds the buyer-mix rule; the legacy Partner Matches
    // page still shows its own top 8.
    let partnerMatches: PartnerForPDF[] | undefined;
    try {
      const pool = await fetchBriefPartners(supabase, {
        modality: baseInput.modality,
        phase: baseInput.phase,
        indication: baseInput.indication,
        territory: baseInput.territory,
        therapeuticArea: baseInput.therapeuticArea,
        dealType: baseInput.dealType,
      }, { log: (m) => console.log(`[Benchmark Gen] ${m}`) });
      if (pool.length > 0) partnerMatches = pool;
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
      mpOpinion,
      diligenceReady: req.diligence_ready?.length ? req.diligence_ready : dataPackageToDiligence(req.data_package).ready,
      diligenceGaps: req.diligence_gaps?.length ? req.diligence_gaps : dataPackageToDiligence(req.data_package).gaps,
      // Migration 135: the client's own model, runway, offers, buyers and package.
      client: parseClientIntake(req as Record<string, unknown>),
      log: (m) => console.log(m),
    });
    genNotes.push(...built.notes);

    // A brief whose load-bearing evidence failed to load (comparable deals,
    // buyer map) must not go out: its decision page would say "Hold" because
    // the database timed out, not because of the evidence. Return the request
    // to intake with the reason so the operator re-runs it.
    if (built.fatal.length) {
      const reason = `GENERATION ABORTED (${new Date().toISOString()}): ${built.fatal.join(', ')} failed after retries. Re-run generate.\n${genNotes.join('\n')}`;
      await supabase
        .from('benchmark_requests')
        .update({ status: 'intake', admin_notes: reason })
        .eq('id', requestId);
      return NextResponse.json({ error: 'Generation aborted: evidence unavailable', fatal: built.fatal, notes: genNotes }, { status: 502 });
    }

    // Step 5c: Outcome ledger — commit the brief's ask/floor, buyers and window
    // as a prediction (Alaric WS1). Fire-and-forget; never breaks generation.
    let predictionId: string | null = null;
    try {
      const priorsAsOf = await loadPriorsSnapshot(supabase);
      const written = await recordBriefPrediction(supabase, built.brief, { requestId, userId: req.user_id ?? null, priorsAsOf });
      if (written.ok) predictionId = written.id;
      else if (written.reason === 'deduped') {
        // Re-run within 24 h: keep the row already registered for this request.
        const { data: existing } = await supabase.from('predictions').select('id').eq('source', 'brief').eq('source_id', requestId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        predictionId = (existing as { id?: string } | null)?.id ?? null;
      }
    } catch (e) {
      console.warn('[Outcomes] brief prediction threw:', e instanceof Error ? e.message : e);
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
    const pageCount = (html.match(/class="report-page"/g) || []).length;

    // Step 9: Upload to Supabase Storage
    const briefToken = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const pdfPath = `briefs/${briefToken}/report.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from('reports')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      const reason = `GENERATION ABORTED (${new Date().toISOString()}): PDF upload failed: ${uploadErr.message}\n${genNotes.join('\n')}`;
      await supabase
        .from('benchmark_requests')
        .update({ status: 'intake', admin_notes: reason })
        .eq('id', requestId);
      return NextResponse.json({ error: 'PDF upload failed' }, { status: 502 });
    }

    // Excel data export beside the PDF. Non-fatal: the brief is the product,
    // the workbook is the working file behind it.
    let excelPath: string | null = null;
    try {
      const wb = buildExcelWorkbook(
        baseResult,
        { modality: baseInput.modality, phase: baseInput.phase, indication: baseInput.indication, territory: baseInput.territory },
        (partnerMatches ?? []).map(p => ({ company_name: p.company_name, match_score: p.match_score, match_reasons: p.match_reasons, deals_last_12mo: p.deals_last_12mo, hq_country: p.hq_country })),
        baseInput.therapeuticArea,
        undefined,
        sensitivityData,
      );
      // The brief sheets go first: decision, scored call, term sheet, bridge,
      // your model vs Solidus, comps with sources, buyers, catalysts, path, diligence.
      try {
        addBriefSheets(wb, built.brief, { deliveredAt: new Date().toISOString() });
      } catch (sheetErr) {
        genNotes.push(`brief sheets failed: ${sheetErr instanceof Error ? sheetErr.message : String(sheetErr)}`);
      }
      const xlsx = Buffer.from(await wb.xlsx.writeBuffer());
      const candidate = `briefs/${briefToken}/data.xlsx`;
      const { error: xlsxErr } = await supabase.storage.from('reports').upload(candidate, xlsx, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });
      if (xlsxErr) genNotes.push(`excel upload failed: ${xlsxErr.message}`);
      else excelPath = candidate;
    } catch (e) {
      genNotes.push(`excel build failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // The brief is confidential: signed, expiring links rather than public
    // object URLs. Storage paths are kept on the row so the data room can
    // mint fresh links at any time.
    const links = await mintBriefLinks(supabase, { pdf_storage_path: pdfPath, excel_storage_path: excelPath }, SIGNED_URL_TTL_SECONDS);
    const pdfUrl = links.pdfUrl ?? '';
    if (!links.pdfUrl) genNotes.push('signed PDF URL could not be minted');

    // Human gate: without a Managing Partner opinion the brief is a draft. It
    // is stored and the operator is told, but the row is never marked
    // delivered and no client-facing link is issued.
    const reviewed = !!mpOpinion;
    const now = new Date().toISOString();
    const noteLines = [
      reviewed ? `v3 build ${now}` : `v3 DRAFT ${now}: awaiting Managing Partner opinion (set mp_opinion, mp_reviewer, mp_reviewed_at and re-run generate)`,
      `pages ${pageCount}; storage ${pdfPath}`,
      ...genNotes,
    ];
    await supabase
      .from('benchmark_requests')
      .update({
        status: reviewed ? 'delivered' : 'call_complete',
        generation_completed_at: now,
        delivered_at: reviewed ? now : null,
        pdf_url: pdfUrl,
        pdf_storage_path: pdfPath,
        excel_url: links.excelUrl ?? null,
        excel_storage_path: excelPath,
        brief_token: briefToken,
        brief_page_count: pageCount,
        admin_notes: noteLines.join('\n'),
        // Migration 133: the brief as data (data room, alerts, follow-ups) and the ledger row it registered.
        brief_json: built.brief,
        prediction_id: predictionId,
        // Migration 137: an automatic draft reports back here.
        auto_draft_status: reviewed ? 'delivered' : 'draft_ready',
      })
      .eq('id', requestId);

    // Client delivery email — only for a reviewed brief, only once per token.
    let emailSent = false;
    if (reviewed && req.email) {
      const { data: fresh } = await supabase.from('benchmark_requests').select(DELIVERY_COLUMNS).eq('id', requestId).maybeSingle();
      const row = (fresh ?? null) as unknown as BriefDeliveryRow | null;
      if (row) {
        const mail = buildDeliveryEmail(row, links);
        const sent = await sendEmail({ to: row.email, subject: mail.subject, html: mail.html, replyTo: 'ikildani@ambrosiaventures.co' });
        emailSent = !!sent.success;
        if (sent.success) {
          await supabase.from('benchmark_requests').update({ delivery_email_sent_at: new Date().toISOString() }).eq('id', requestId);
        } else {
          genNotes.push(`delivery email not sent: ${sent.error ?? 'unknown'}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      delivered: reviewed,
      reason: reviewed ? undefined : 'Managing Partner opinion missing; brief stored as a draft',
      briefToken,
      pdfUrl,
      excelUrl: links.excelUrl,
      pageCount,
      storagePath: pdfPath,
      dataRoomUrl: reviewed ? dataRoomUrl(briefToken) : null,
      emailSent,
      notes: genNotes,
    });
  } catch (error) {
    console.error('[Benchmark Gen] Fatal error:', error);
    await supabase
      .from('benchmark_requests')
      .update({ status: 'intake', admin_notes: `GENERATION FAILED (${new Date().toISOString()}): ${(error as Error).message}` })
      .eq('id', requestId);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
