import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError } from '@/lib/sentry-api';

export const dynamic = 'force-dynamic';

interface TrialSummary {
  totalTrials: number;
  totalEnrollment: number;
  phaseDistribution: Record<string, number>;
  topSponsors: { name: string; count: number }[];
  recentTrials: {
    nct_id: string;
    title: string;
    sponsor: string;
    phase: string;
    status: string;
    enrollment?: number;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const therapeuticArea = params.get('therapeuticArea');
    const modality = params.get('modality');

    if (!therapeuticArea) {
      return NextResponse.json(
        { error: 'therapeuticArea parameter required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Map therapeutic area to indication categories used in the trials table
    const indicationCategories = getIndicationCategories(therapeuticArea);

    // Query active/recruiting trials matching therapeutic area
    let query = supabase
      .from('company_trials')
      .select('nct_id, trial_title, company_name, phase, status, indication_category, indication_specific, modality, conditions')
      .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting', 'enrolling_by_invitation']);

    if (indicationCategories.length > 0) {
      query = query.in('indication_category', indicationCategories);
    }

    if (modality) {
      query = query.eq('modality', modality);
    }

    const { data: trials, error } = await query
      .order('start_date', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[trials/intelligence] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch trials' }, { status: 500 });
    }

    if (!trials || trials.length === 0) {
      return NextResponse.json({
        summary: {
          totalTrials: 0,
          totalEnrollment: 0,
          phaseDistribution: {},
          topSponsors: [],
          recentTrials: [],
        },
      });
    }

    // Phase distribution
    const phaseDistribution: Record<string, number> = {};
    for (const t of trials) {
      const p = t.phase || 'Unknown';
      phaseDistribution[p] = (phaseDistribution[p] || 0) + 1;
    }

    // Top sponsors
    const sponsorCounts: Record<string, number> = {};
    for (const t of trials) {
      const s = t.company_name || 'Unknown';
      sponsorCounts[s] = (sponsorCounts[s] || 0) + 1;
    }
    const topSponsors = Object.entries(sponsorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Recent trials (first 15)
    const recentTrials = trials.slice(0, 15).map(t => ({
      nct_id: t.nct_id,
      title: t.trial_title || 'Untitled',
      sponsor: t.company_name || 'Unknown',
      phase: t.phase || 'Unknown',
      status: t.status || 'Unknown',
    }));

    const summary: TrialSummary = {
      totalTrials: trials.length,
      totalEnrollment: 0, // enrollment not stored in upsert — use count as proxy
      phaseDistribution,
      topSponsors,
      recentTrials,
    };

    return NextResponse.json({ summary });
  } catch (error) {
    captureApiError(error, 'trials-intelligence');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getIndicationCategories(therapeuticArea: string): string[] {
  switch (therapeuticArea) {
    case 'oncology':
      return ['solid_tumor', 'hematological'];
    case 'neurology':
      return ['cns'];
    case 'immunology':
      return ['autoimmune', 'dermatology'];
    case 'metabolic':
      return ['metabolic', 'cardiovascular'];
    default:
      return [];
  }
}
