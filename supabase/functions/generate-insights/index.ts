// Supabase Edge Function: Generate AI Market Insights
// Schedule: Run monthly before data retention cleanup

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface AggregatedData {
  modalityTrends: Record<string, { count: number; avgUpfront: number; avgTotalValue: number }>;
  phaseDistribution: Record<string, number>;
  territoryPreferences: Record<string, number>;
  indicationPopularity: Record<string, number>;
  totalCalculations: number;
  uniqueUsers: number;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get current period (last month)
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // First of current month
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1); // First of previous month

    // Fetch calculations for the period
    const { data: calculations, error: calcError } = await supabase
      .from('calculations')
      .select('*')
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString());

    if (calcError) {
      throw new Error(`Failed to fetch calculations: ${calcError.message}`);
    }

    if (!calculations || calculations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No data for period' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate data
    const aggregated = aggregateData(calculations);

    // Generate AI insights (if API key is configured)
    const aiSummaries = await generateAISummaries(aggregated, periodStart, periodEnd);

    // Store insights
    const insightsToStore = [
      {
        insight_type: 'modality_trend',
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        insight_data: aggregated.modalityTrends,
        ai_summary: aiSummaries.modality,
      },
      {
        insight_type: 'phase_distribution',
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        insight_data: aggregated.phaseDistribution,
        ai_summary: aiSummaries.phase,
      },
      {
        insight_type: 'territory_preference',
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        insight_data: aggregated.territoryPreferences,
        ai_summary: aiSummaries.territory,
      },
      {
        insight_type: 'indication_popularity',
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        insight_data: aggregated.indicationPopularity,
        ai_summary: aiSummaries.indication,
      },
    ];

    const { error: insertError } = await supabase
      .from('market_insights')
      .insert(insightsToStore);

    if (insertError) {
      throw new Error(`Failed to store insights: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        stats: {
          totalCalculations: aggregated.totalCalculations,
          uniqueUsers: aggregated.uniqueUsers,
        },
        insightsGenerated: insightsToStore.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Insight generation error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

function aggregateData(calculations: any[]): AggregatedData {
  const modalityTrends: Record<string, { count: number; totalUpfront: number; totalValue: number }> = {};
  const phaseDistribution: Record<string, number> = {};
  const territoryPreferences: Record<string, number> = {};
  const indicationPopularity: Record<string, number> = {};
  const userIds = new Set<string>();

  for (const calc of calculations) {
    // Track unique users
    if (calc.user_id) userIds.add(calc.user_id);
    if (calc.anonymous_id) userIds.add(calc.anonymous_id);

    // Modality trends
    const modality = calc.modality || 'unknown';
    if (!modalityTrends[modality]) {
      modalityTrends[modality] = { count: 0, totalUpfront: 0, totalValue: 0 };
    }
    modalityTrends[modality].count++;
    modalityTrends[modality].totalUpfront += calc.output_upfront_mid || 0;
    modalityTrends[modality].totalValue += calc.output_total_deal_value_high || 0;

    // Phase distribution
    const phase = calc.development_phase || 'unknown';
    phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;

    // Territory preferences
    const territory = calc.territory_scope || 'unknown';
    territoryPreferences[territory] = (territoryPreferences[territory] || 0) + 1;

    // Indication popularity
    const indication = calc.indication_category || 'unknown';
    indicationPopularity[indication] = (indicationPopularity[indication] || 0) + 1;
  }

  // Convert modality totals to averages
  const modalityTrendsWithAvg: Record<string, { count: number; avgUpfront: number; avgTotalValue: number }> = {};
  for (const [modality, data] of Object.entries(modalityTrends)) {
    modalityTrendsWithAvg[modality] = {
      count: data.count,
      avgUpfront: data.count > 0 ? Math.round(data.totalUpfront / data.count) : 0,
      avgTotalValue: data.count > 0 ? Math.round(data.totalValue / data.count) : 0,
    };
  }

  return {
    modalityTrends: modalityTrendsWithAvg,
    phaseDistribution,
    territoryPreferences,
    indicationPopularity,
    totalCalculations: calculations.length,
    uniqueUsers: userIds.size,
  };
}

async function generateAISummaries(
  data: AggregatedData,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  modality: string | null;
  phase: string | null;
  territory: string | null;
  indication: string | null;
}> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

  // If no API key, return null summaries
  if (!anthropicApiKey) {
    return {
      modality: null,
      phase: null,
      territory: null,
      indication: null,
    };
  }

  const periodStr = `${periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

  try {
    const summaries: {
      modality: string | null;
      phase: string | null;
      territory: string | null;
      indication: string | null;
    } = {
      modality: null,
      phase: null,
      territory: null,
      indication: null,
    };

    // Generate modality insight
    const modalityPrompt = `Based on this Solidus platform usage data for ${periodStr}:
Modality breakdown: ${JSON.stringify(data.modalityTrends)}
Total calculations: ${data.totalCalculations}

Provide a 2-3 sentence market insight about modality trends in biopharma deal-making across oncology and neurology. Focus on which modalities are most explored and what this might indicate about market interest.`;

    summaries.modality = await callClaude(anthropicApiKey, modalityPrompt);

    // Generate phase insight
    const phasePrompt = `Based on this Solidus platform usage data for ${periodStr}:
Development phase distribution: ${JSON.stringify(data.phaseDistribution)}
Total calculations: ${data.totalCalculations}

Provide a 2-3 sentence market insight about which development phases are most actively being evaluated for deals and what this suggests about market dynamics.`;

    summaries.phase = await callClaude(anthropicApiKey, phasePrompt);

    // Generate territory insight
    const territoryPrompt = `Based on this Solidus platform usage data for ${periodStr}:
Territory preferences: ${JSON.stringify(data.territoryPreferences)}
Total calculations: ${data.totalCalculations}

Provide a 2-3 sentence market insight about territorial deal structures being explored and what this indicates about geographic licensing strategies.`;

    summaries.territory = await callClaude(anthropicApiKey, territoryPrompt);

    // Generate indication insight
    const indicationPrompt = `Based on this Solidus platform usage data for ${periodStr}:
Indication categories: ${JSON.stringify(data.indicationPopularity)}
Total calculations: ${data.totalCalculations}

Provide a 2-3 sentence market insight about which therapeutic indications (oncology and neurology) are attracting the most deal-making interest.`;

    summaries.indication = await callClaude(anthropicApiKey, indicationPrompt);

    return summaries;
  } catch (error) {
    console.error('AI summary generation error:', error);
    return {
      modality: null,
      phase: null,
      territory: null,
      indication: null,
    };
  }
}

async function callClaude(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error('Claude API call failed:', error);
    return null;
  }
}
