import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { fixUpfrontExceedsTdv, fixMissingTherapeuticArea, flagDuplicatesForReview } from '@/lib/ingestion/auto-remediate';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatMonth(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!token || !secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // ═══════════════════════════════════════════════════════════════════
    // QUERY 1: Total deal count
    // ═══════════════════════════════════════════════════════════════════
    const { count: totalDeals } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true });

    // ═══════════════════════════════════════════════════════════════════
    // QUERY 2: Deals added this month
    // ═══════════════════════════════════════════════════════════════════
    const { count: dealsThisMonth } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfMonth);

    // ═══════════════════════════════════════════════════════════════════
    // QUERY 3: Deals by source type
    // ═══════════════════════════════════════════════════════════════════
    const { data: dealsBySource } = await supabase
      .from('deals')
      .select('source_type');

    const sourceCounts = new Map<string, number>();
    for (const deal of dealsBySource || []) {
      const src = deal.source_type || 'unknown';
      sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ISSUE 1: Missing upfront where terms are disclosed
    // ═══════════════════════════════════════════════════════════════════
    const { count: missingUpfront } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('terms_disclosed', true)
      .is('upfront_usd', null);

    // ═══════════════════════════════════════════════════════════════════
    // ISSUE 2: Upfront exceeds total deal value (suspicious)
    // ═══════════════════════════════════════════════════════════════════
    const { data: suspiciousDeals } = await supabase
      .from('deals')
      .select('id, licensor_name, licensee_name, upfront_usd, total_deal_value_usd')
      .not('upfront_usd', 'is', null)
      .not('total_deal_value_usd', 'is', null);

    const upfrontExceedsTdv = (suspiciousDeals || []).filter(
      (d) => d.upfront_usd > d.total_deal_value_usd && d.total_deal_value_usd > 0
    );

    // ═══════════════════════════════════════════════════════════════════
    // ISSUE 3: Potential duplicates (same licensor + licensee within 7 days)
    // ═══════════════════════════════════════════════════════════════════
    const { data: allDealsForDupes } = await supabase
      .from('deals')
      .select('id, licensor_name, licensee_name, announced_date, asset_name')
      .order('announced_date', { ascending: true });

    let potentialDuplicates = 0;
    const dupeExamples: string[] = [];

    if (allDealsForDupes && allDealsForDupes.length > 1) {
      // Group by normalized licensor+licensee pair
      const pairMap = new Map<string, typeof allDealsForDupes>();

      for (const deal of allDealsForDupes) {
        const key = `${deal.licensor_name.toLowerCase().trim()}|${deal.licensee_name.toLowerCase().trim()}`;
        if (!pairMap.has(key)) pairMap.set(key, []);
        pairMap.get(key)!.push(deal);
      }

      for (const [, deals] of pairMap) {
        if (deals.length < 2) continue;

        for (let i = 0; i < deals.length - 1; i++) {
          const dateA = new Date(deals[i].announced_date).getTime();
          const dateB = new Date(deals[i + 1].announced_date).getTime();
          const daysDiff = Math.abs(dateB - dateA) / (1000 * 60 * 60 * 24);

          if (daysDiff <= 7) {
            potentialDuplicates++;
            if (dupeExamples.length < 3) {
              dupeExamples.push(
                `${deals[i].licensor_name} + ${deals[i].licensee_name} (${deals[i].announced_date} & ${deals[i + 1].announced_date})`
              );
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ISSUE 4: Deals with no therapeutic area assigned
    // ═══════════════════════════════════════════════════════════════════
    const { count: noTaDeals } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .or('therapeutic_area.is.null,therapeutic_area.eq.other');

    // ═══════════════════════════════════════════════════════════════════
    // ISSUE 5: Deals with modality = 'other' that could be classified
    // ═══════════════════════════════════════════════════════════════════
    const { count: otherModalityDeals } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('modality', 'other');

    // ═══════════════════════════════════════════════════════════════════
    // ISSUE 6: Stale company profiles (not updated in 90+ days)
    // ═══════════════════════════════════════════════════════════════════
    const { count: staleCompanies } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .lt('updated_at', ninetyDaysAgo);

    // ═══════════════════════════════════════════════════════════════════
    // AUTO-REMEDIATION: Fix detected issues before scoring
    // ═══════════════════════════════════════════════════════════════════
    const tdvFixResult = await fixUpfrontExceedsTdv(supabase);
    const taFixResult = await fixMissingTherapeuticArea(supabase);

    // Build duplicate groups from the pairMap for flagging
    const duplicateGroups: Array<{ dealIds: string[]; licensor: string; licensee: string }> = [];
    if (allDealsForDupes && allDealsForDupes.length > 1) {
      const pairMapForDupes = new Map<string, typeof allDealsForDupes>();
      for (const deal of allDealsForDupes) {
        const key = `${deal.licensor_name.toLowerCase().trim()}|${deal.licensee_name.toLowerCase().trim()}`;
        if (!pairMapForDupes.has(key)) pairMapForDupes.set(key, []);
        pairMapForDupes.get(key)!.push(deal);
      }
      for (const [, deals] of pairMapForDupes) {
        if (deals.length < 2) continue;
        for (let i = 0; i < deals.length - 1; i++) {
          const dateA = new Date(deals[i].announced_date).getTime();
          const dateB = new Date(deals[i + 1].announced_date).getTime();
          const daysDiff = Math.abs(dateB - dateA) / (1000 * 60 * 60 * 24);
          if (daysDiff <= 7) {
            duplicateGroups.push({
              dealIds: [deals[i].id, deals[i + 1].id],
              licensor: deals[i].licensor_name,
              licensee: deals[i].licensee_name,
            });
          }
        }
      }
    }
    const dupResult = await flagDuplicatesForReview(supabase, duplicateGroups);

    // ═══════════════════════════════════════════════════════════════════
    // COMPUTE QUALITY SCORE (before remediation — for comparison)
    // ═══════════════════════════════════════════════════════════════════
    const total = totalDeals || 1;
    const issues = {
      missingUpfront: missingUpfront || 0,
      upfrontExceedsTdv: upfrontExceedsTdv.length,
      duplicates: potentialDuplicates,
      noTa: noTaDeals || 0,
      otherModality: otherModalityDeals || 0,
      staleCompanies: staleCompanies || 0,
    };

    // Quality score: start at 100, deduct for issues proportional to deal count
    let qualityScore = 100;
    qualityScore -= Math.min(20, (issues.missingUpfront / total) * 200); // Up to -20 for missing upfronts
    qualityScore -= Math.min(15, issues.upfrontExceedsTdv * 3);          // -3 per suspicious deal, max -15
    qualityScore -= Math.min(15, issues.duplicates * 2);                  // -2 per duplicate, max -15
    qualityScore -= Math.min(15, (issues.noTa / total) * 150);           // Up to -15 for unclassified TAs
    qualityScore -= Math.min(10, (issues.otherModality / total) * 100);  // Up to -10 for 'other' modalities
    qualityScore -= Math.min(10, (issues.staleCompanies / 100) * 10);    // Up to -10 for stale companies
    qualityScore = Math.max(0, Math.round(qualityScore));

    // Bonus: if deals were added this month, that's a healthy sign
    if ((dealsThisMonth || 0) > 0) {
      qualityScore = Math.min(100, qualityScore + 5);
    }

    const preRemediationScore = qualityScore;

    // ═══════════════════════════════════════════════════════════════════
    // RECALCULATE QUALITY SCORE AFTER REMEDIATION
    // ═══════════════════════════════════════════════════════════════════
    const postIssues = {
      missingUpfront: issues.missingUpfront,
      upfrontExceedsTdv: Math.max(0, issues.upfrontExceedsTdv - tdvFixResult.fixed),
      duplicates: Math.max(0, issues.duplicates - dupResult.fixed),
      noTa: Math.max(0, issues.noTa - taFixResult.fixed),
      otherModality: issues.otherModality,
      staleCompanies: issues.staleCompanies,
    };

    let postRemediationScore = 100;
    postRemediationScore -= Math.min(20, (postIssues.missingUpfront / total) * 200);
    postRemediationScore -= Math.min(15, postIssues.upfrontExceedsTdv * 3);
    postRemediationScore -= Math.min(15, postIssues.duplicates * 2);
    postRemediationScore -= Math.min(15, (postIssues.noTa / total) * 150);
    postRemediationScore -= Math.min(10, (postIssues.otherModality / total) * 100);
    postRemediationScore -= Math.min(10, (postIssues.staleCompanies / 100) * 10);
    postRemediationScore = Math.max(0, Math.round(postRemediationScore));
    if ((dealsThisMonth || 0) > 0) {
      postRemediationScore = Math.min(100, postRemediationScore + 5);
    }

    // Use post-remediation score as the final score
    qualityScore = postRemediationScore;

    // ═══════════════════════════════════════════════════════════════════
    // SEND SLACK REPORT
    // ═══════════════════════════════════════════════════════════════════
    const sourceStr = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([src, count]) => {
        const label = src.replace(/_/g, ' ').replace(/\bsec\b/gi, 'SEC').replace(/\b8k\b/g, '8-K');
        return `${label}: ${count}`;
      })
      .join(', ');

    const issueLines = [
      `\u2022 ${issues.missingUpfront} deal(s) with missing upfront (terms disclosed)`,
      `\u2022 ${issues.upfrontExceedsTdv} deal(s) with upfront > total value`,
      `\u2022 ${issues.duplicates} potential duplicate(s) (same parties within 7 days)`,
      `\u2022 ${issues.noTa} deal(s) with no TA assigned`,
      `\u2022 ${issues.otherModality} deal(s) with modality = 'other'`,
      `\u2022 ${issues.staleCompanies} company profile(s) stale (90+ days)`,
    ];

    // Add examples for suspicious data
    const exampleLines: string[] = [];
    if (upfrontExceedsTdv.length > 0) {
      const examples = upfrontExceedsTdv.slice(0, 3).map(
        (d) => `  \u2192 ${d.licensor_name} + ${d.licensee_name}: upfront $${d.upfront_usd}M > TDV $${d.total_deal_value_usd}M`
      );
      exampleLines.push(...examples);
    }
    if (dupeExamples.length > 0) {
      exampleLines.push(...dupeExamples.map((e) => `  \u2192 ${e}`));
    }

    const scoreEmoji = qualityScore >= 90 ? ':large_green_circle:' : qualityScore >= 70 ? ':large_yellow_circle:' : ':red_circle:';
    const scoreColor = qualityScore >= 90 ? '#16a34a' : qualityScore >= 70 ? '#f59e0b' : '#dc2626';
    const totalIssues = Object.values(issues).reduce((sum, v) => sum + v, 0);

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Monthly Deal Data Health \u2014 ${formatMonth()}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Total Deals:*\n${(totalDeals || 0).toLocaleString()}` },
          { type: 'mrkdwn', text: `*Added This Month:*\n${(dealsThisMonth || 0).toLocaleString()}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*By Source:* ${sourceStr || 'N/A'}` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: totalIssues > 0
            ? `:warning: *Data Issues (${totalIssues} total):*\n${issueLines.join('\n')}`
            : ':white_check_mark: *No data issues detected*',
        },
      },
      ...(exampleLines.length > 0 ? [{
        type: 'section' as const,
        text: { type: 'mrkdwn' as const, text: `*Examples:*\n${exampleLines.join('\n')}` },
      }] : []),
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:wrench: *Auto-Remediation:*\n• Upfront > TDV: found ${issues.upfrontExceedsTdv} | fixed ${tdvFixResult.fixed} | review ${tdvFixResult.errors.length}\n• Missing TA: found ${issues.noTa} | fixed ${taFixResult.fixed} | skipped ${taFixResult.skipped}\n• Duplicates: found ${potentialDuplicates} | flagged ${dupResult.fixed} | review ${potentialDuplicates - dupResult.fixed}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${scoreEmoji} *Quality Score: ${preRemediationScore}/100 → ${qualityScore}/100* ${preRemediationScore !== qualityScore ? '(+' + (qualityScore - preRemediationScore) + ' after remediation)' : '(no change)'}`,
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `${formatTimestamp()} | Monthly audit | solidus.ambrosiaventures.co` }],
      },
    ];

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${scoreEmoji} Monthly Deal Data Health: ${qualityScore}/100 | ${(totalDeals || 0).toLocaleString()} deals | ${totalIssues} issues`,
          attachments: [{
            color: scoreColor,
            blocks,
          }],
        }),
      });
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'deal-data-health', {
        processed: totalDeals || 0,
        inserted: tdvFixResult.fixed + taFixResult.fixed + dupResult.fixed,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      month: formatMonth(),
      totalDeals: totalDeals || 0,
      dealsThisMonth: dealsThisMonth || 0,
      sourceBreakdown: Object.fromEntries(sourceCounts),
      issues,
      qualityScore,
    });
  } catch (error) {
    console.error('[Deal Data Health] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
