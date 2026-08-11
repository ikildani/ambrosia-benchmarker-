import { requireSingleSession } from '@/lib/auth/require-single-session';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { isAdminEmail } from '@/lib/config/authorized-emails';
import { calculateDealTerms } from '@/lib/calculations';
import type { CalculationInput } from '@/lib/calculations';
import { scoreComparableDealsHedonic } from '@/lib/comparableDeals';
import type { ComparableDealForUI } from '@/lib/comparableDeals';
import { findEnrichedComparableDeals } from '@/lib/comparableDeals.server';
import { narrateComparables } from '@/lib/ai/comparable-narrator';
import { generateCompReportHTML } from '@/lib/report/compReport';
import type { CompReportData, CompReportBenchmarkRange } from '@/lib/report/compReport/types';
import { prioritizeCompsForReport } from '@/lib/report/compReport/prioritizeComps';
import { renderPDFBuffer } from '@/lib/report/server-renderer';

export const maxDuration = 60;

interface AssetRequest {
  therapeuticArea: string;
  phase: string;
  modality: string;
  indication: string;
  territory: string;
  dealType?: string;
  competitivePosition?: string;
  assetName?: string;
  assetCode?: string;
}

interface RequestBody {
  assets: AssetRequest[];
  preparedFor?: string;
}

export async function POST(request: NextRequest) {
  try {
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;

    const authUser = await getAuthenticatedUser(request);
    const userEmail = authUser?.email || null;

    if (!isAdminEmail(userEmail)) {
      return NextResponse.json(
        { error: 'Admin access required for comp report generation' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as RequestBody;
    const { assets, preparedFor } = body;

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json(
        { error: 'At least one asset is required' },
        { status: 400 }
      );
    }

    const pdfBuffers: { buffer: Uint8Array; name: string }[] = [];

    for (const asset of assets) {
      const calcInput: CalculationInput = {
        therapeuticArea: asset.therapeuticArea,
        phase: asset.phase,
        modality: asset.modality,
        indication: asset.indication,
        territory: asset.territory,
        dealType: asset.dealType || 'licensing',
        competitivePosition: asset.competitivePosition,
      } as CalculationInput;

      const calcResult = calculateDealTerms(calcInput);

      const allScoredDeals = scoreComparableDealsHedonic(
        {
          therapeuticArea: asset.therapeuticArea,
          modality: asset.modality,
          indication: asset.indication,
          phase: asset.phase,
          dealType: asset.dealType || 'licensing',
          territory: asset.territory,
        },
        500
      );

      const hedonicResults = prioritizeCompsForReport(allScoredDeals, asset.indication, 12);

      const comparableDeals: ComparableDealForUI[] = hedonicResults.map(h => ({
        id: h.id,
        parties: `${h.deal.licensor} / ${h.deal.licensee}`,
        totalValue: h.deal.value,
        upfront: h.deal.upfrontM ? `$${h.deal.upfrontM}M` : undefined,
        year: h.deal.year,
        phase: h.deal.phase || undefined,
        relevanceReasons: h.reasons,
        scoreBreakdown: h.score,
      }));

      const { benchmarkRange: dbBenchmark } = await findEnrichedComparableDeals(
        {
          therapeuticArea: asset.therapeuticArea,
          modality: asset.modality,
          indication: asset.indication,
          phase: asset.phase,
          dealType: asset.dealType,
        },
        30
      );

      const years = hedonicResults.map(h => h.deal.year);
      const benchmarkRange: CompReportBenchmarkRange = {
        totalDealValue: dbBenchmark.totalValue,
        upfront: dbBenchmark.upfront,
        compCount: dbBenchmark.n,
        yearRange: {
          min: years.length > 0 ? Math.min(...years) : new Date().getFullYear() - 3,
          max: years.length > 0 ? Math.max(...years) : new Date().getFullYear(),
        },
        upfrontPctOfTDV: dbBenchmark.totalValue.median > 0
          ? (dbBenchmark.upfront.median / dbBenchmark.totalValue.median) * 100
          : 0,
      };

      let narration;
      try {
        narration = await narrateComparables(calcInput, calcResult, comparableDeals);
      } catch {
        // AI narration is best-effort; the report works without it
      }

      const reportData: CompReportData = {
        assetName: asset.assetName,
        assetCode: asset.assetCode,
        preparedFor,
        inputs: {
          therapeuticArea: asset.therapeuticArea,
          phase: asset.phase,
          modality: asset.modality,
          indication: asset.indication,
          territory: asset.territory,
          dealType: asset.dealType,
          competitivePosition: asset.competitivePosition,
        },
        benchmarkRange,
        comparableDeals,
        hedonicResults,
        narration,
      };

      const html = generateCompReportHTML(reportData);
      const pdfBuffer = await renderPDFBuffer(html);

      const label = asset.assetName || asset.indication || 'analysis';
      pdfBuffers.push({ buffer: pdfBuffer, name: label });
    }

    if (pdfBuffers.length === 1) {
      return new Response(pdfBuffers[0].buffer.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ambrosia-comp-report-${pdfBuffers[0].name}.pdf"`,
          'Content-Length': pdfBuffers[0].buffer.length.toString(),
        },
      });
    }

    // Multiple assets — return first PDF for now (can extend to ZIP later)
    const combined = pdfBuffers[0];
    return new Response(combined.buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ambrosia-comp-report-${combined.name}.pdf"`,
        'Content-Length': combined.buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Comp report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate comp report' },
      { status: 500 }
    );
  }
}
