/**
 * Pipeline Competitors API
 *
 * Returns real competitor data from the company_trials table for a given
 * therapeutic area / modality / phase combination. Used by the client-side
 * competitive dynamics engine to replace calibrated templates with real
 * market pipeline intelligence.
 *
 * Server-side only (requires Supabase service role key).
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchPipelineCompetitors } from '@/lib/financial/pipeline-query';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      therapeuticArea,
      indication,
      modality,
      phase,
      excludeCompany,
      launchYear,
    } = body;

    if (!therapeuticArea || !phase || launchYear == null) {
      return NextResponse.json(
        { error: 'Missing required fields: therapeuticArea, phase, launchYear' },
        { status: 400 },
      );
    }

    const data = await fetchPipelineCompetitors({
      therapeuticArea,
      indication,
      modality,
      phase,
      excludeCompany,
      launchYear: Number(launchYear),
      maxCompetitors: 6,
    });

    return NextResponse.json({
      ok: true,
      data: data || null,
    });
  } catch (error) {
    console.error('[pipeline-competitors] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch pipeline data' },
      { status: 500 },
    );
  }
}
