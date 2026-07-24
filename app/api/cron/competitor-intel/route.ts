/**
 * Daily competitor intelligence cron job.
 * Fetches RSS feeds from biopharma news sources, deduplicates, analyzes
 * relevance via Claude, stores results, and sends alerts for high-relevance items.
 *
 * Schedule: Daily at 12:00 UTC via Vercel Cron
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { fetchCompetitorContent, filterNewEntries } from '@/lib/seo/competitor-monitor';
import { analyzeCompetitorContent, type AnalyzedEntry } from '@/lib/seo/competitor-analysis';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract deal parameters from an analyzed competitor entry for the SEO content queue.
 * Infers TA, modality, companies, and deal value from title + description.
 */
function extractTopicParams(entry: AnalyzedEntry): Record<string, unknown> {
  const text = `${entry.title} ${entry.description}`.toLowerCase();

  // Infer therapeutic area
  const taMap: Record<string, string> = {
    oncology: 'oncology', cancer: 'oncology', tumor: 'oncology',
    neuro: 'neurology', alzheimer: 'neurology', parkinson: 'neurology', cns: 'neurology',
    immun: 'immunology', autoimmune: 'immunology', 'rheumatoid': 'immunology',
    metabolic: 'metabolic', diabetes: 'metabolic', obesity: 'metabolic', 'glp-1': 'metabolic',
    cardio: 'cardiovascular', heart: 'cardiovascular',
    rare: 'rareDisease', orphan: 'rareDisease',
    hemato: 'hematology', leukemia: 'hematology', lymphoma: 'hematology', myeloma: 'hematology',
    infectious: 'infectiousDisease', antiviral: 'infectiousDisease', antibiotic: 'infectiousDisease',
    ophthal: 'ophthalmology', retina: 'ophthalmology', eye: 'ophthalmology',
    dermat: 'dermatology', skin: 'dermatology', psoriasis: 'dermatology',
    gastro: 'gastroenterology', ibd: 'gastroenterology', crohn: 'gastroenterology',
  };

  let therapeuticArea = 'oncology'; // default
  for (const [keyword, ta] of Object.entries(taMap)) {
    if (text.includes(keyword)) {
      therapeuticArea = ta;
      break;
    }
  }

  // Infer modality
  const modalityMap: Record<string, string> = {
    adc: 'adc', 'antibody-drug conjugate': 'adc',
    bispecific: 'bispecific',
    'small molecule': 'smallMolecule',
    monoclonal: 'mab', antibody: 'mab',
    'gene therapy': 'geneTherapy',
    'cell therapy': 'cellTherapy', 'car-t': 'carT_heme',
    rnai: 'rnai', sirna: 'rnai',
    mrna: 'mrna',
    protac: 'protac',
    peptide: 'peptide',
    radiopharm: 'radiopharmaceutical',
    'glp-1': 'glp1Agonist',
  };

  let modality = 'smallMolecule'; // default
  for (const [keyword, mod] of Object.entries(modalityMap)) {
    if (text.includes(keyword)) {
      modality = mod;
      break;
    }
  }

  // Infer deal type
  const dealTypeMap: Record<string, string> = {
    licens: 'licensing', acquisition: 'acquisition', acquire: 'acquisition',
    'co-develop': 'codevelopment', collaborat: 'collaboration', option: 'option',
  };

  let dealType = 'licensing'; // default
  for (const [keyword, dt] of Object.entries(dealTypeMap)) {
    if (text.includes(keyword)) {
      dealType = dt;
      break;
    }
  }

  // Infer phase
  const phaseMap: Record<string, string> = {
    'phase 3': 'phase3', 'phase 2': 'phase2', 'phase 1': 'phase1',
    'phase3': 'phase3', 'phase2': 'phase2', 'phase1': 'phase1',
    preclinical: 'preclinical', approved: 'approved',
  };

  let phase = 'phase2'; // default
  for (const [keyword, p] of Object.entries(phaseMap)) {
    if (text.includes(keyword)) {
      phase = p;
      break;
    }
  }

  // Extract company names (heuristic: look for known patterns)
  const companies: string[] = [];
  // Try to extract from title patterns like "Company A and Company B" or "Company A / Company B"
  const titleParts = entry.title.split(/\s+(?:and|&|\/|,)\s+/i);
  if (titleParts.length >= 2) {
    // Take first word(s) from each part as potential company names
    for (const part of titleParts.slice(0, 2)) {
      const cleaned = part.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).slice(0, 3).join(' ');
      if (cleaned.length > 1 && cleaned.length < 40) {
        companies.push(cleaned);
      }
    }
  }

  // Extract deal value if mentioned
  const valueMatch = text.match(/\$\s*([\d,.]+)\s*(billion|million|[bm])\b/i);
  let dealValue: string | undefined;
  if (valueMatch) {
    const num = parseFloat(valueMatch[1].replace(/,/g, ''));
    const unit = valueMatch[2].toLowerCase();
    if (unit.startsWith('b')) {
      dealValue = `$${num}B`;
    } else {
      dealValue = `$${num}M`;
    }
  }

  return {
    therapeuticArea,
    headline: entry.title,
    companies,
    dealValue,
    modality,
    phase,
    dealType,
    suggestedResponse: entry.suggestedResponse,
    sourceUrl: entry.url,
  };
}

function buildSlackPayload(entries: AnalyzedEntry[]) {
  const lines = entries.map(
    (e) =>
      `\u{1F50D} [${e.source}] ${e.title} (relevance: ${e.relevanceScore.toFixed(2)})\n` +
      `\u{1F4A1} Suggested response: ${e.suggestedResponse}`
  );

  return {
    text: `Competitor Intel: ${entries.length} new relevant article(s) detected`,
    attachments: [
      {
        color: '#3498db',
        title: `Competitor Intel: ${entries.length} new relevant articles detected`,
        text: lines.join('\n\n'),
        fallback: `Competitor intelligence: ${entries.length} relevant articles found`,
      },
    ],
  };
}

function buildEmailHtml(entries: AnalyzedEntry[]): string {
  const rows = entries
    .map(
      (e) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <strong><a href="${e.url}" style="color:#3498db;">${e.title}</a></strong><br>
          <span style="color:#666;font-size:13px;">${e.source} &middot; Relevance: ${e.relevanceScore.toFixed(2)}</span><br>
          <span style="font-size:13px;">${e.analysis}</span><br>
          <span style="color:#2ecc71;font-size:13px;"><strong>Suggested response:</strong> ${e.suggestedResponse}</span>
        </td>
      </tr>`
    )
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#2c3e50;">Daily Competitor Intelligence Digest</h2>
      <p>${entries.length} relevant article(s) detected from biopharma news sources.</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="color:#999;font-size:12px;margin-top:20px;">
        Generated by Solidus Competitor Intelligence
      </p>
    </div>`;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // 1. Auth
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (!crypto.timingSafeEqual(tokenBuf, secretBuf)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    // 2. Fetch competitor content from RSS feeds
    const allEntries = await fetchCompetitorContent();

    // 3. Filter out already-seen entries
    const newEntries = await filterNewEntries(supabase, allEntries);

    if (newEntries.length === 0) {
      await logCronRun(supabase, 'competitor-intel', {
        fetched: allEntries.length,
        processed: 0,
        inserted: 0,
        parameters: { status: 'no_new_entries' },
      });
      return NextResponse.json({ message: 'No new entries', fetched: allEntries.length });
    }

    // 4. Analyze via Claude
    const analyzed = await analyzeCompetitorContent(newEntries);

    // 5. Insert all analyzed entries into competitor_content
    const errors: string[] = [];
    let inserted = 0;

    for (const entry of analyzed) {
      const { error } = await supabase.from('competitor_content').insert({
        source: entry.source,
        url: entry.url,
        title: entry.title,
        description: entry.description,
        published_at: entry.publishedAt,
        keyword_overlap: entry.keywordOverlap,
        relevance_score: entry.relevanceScore,
        analysis: entry.analysis,
        suggested_response: entry.suggestedResponse,
        created_at: new Date().toISOString(),
      });

      if (error) {
        errors.push(`${entry.url}: ${error.message}`);
      } else {
        inserted++;
      }
    }

    // 5b. Push high-relevance entries (>= 0.75) to SEO content queue for reactive blog generation
    const queueCandidates = analyzed.filter((e) => e.relevanceScore >= 0.75);
    let queued = 0;

    for (const entry of queueCandidates) {
      try {
        // Extract deal info from the title/description for topic_params
        const topicParams = extractTopicParams(entry);

        const { error: queueError } = await supabase.from('seo_content_queue').insert({
          source: 'competitor_intel',
          trigger_event: {
            title: entry.title,
            url: entry.url,
            source: entry.source,
            description: entry.description,
            publishedAt: entry.publishedAt,
            relevanceScore: entry.relevanceScore,
            analysis: entry.analysis,
            suggestedResponse: entry.suggestedResponse,
          },
          priority: 90,
          status: 'pending',
          topic_params: topicParams,
        });

        if (queueError) {
          console.error('[competitor-intel] Queue insert failed:', queueError.message);
        } else {
          queued++;
        }
      } catch (qErr) {
        console.error('[competitor-intel] Queue push error:', qErr);
      }
    }

    // 6. Send alerts for high-relevance entries (> 0.5)
    const highRelevance = analyzed.filter((e) => e.relevanceScore > 0.5);

    if (highRelevance.length > 0) {
      // Slack notification
      if (process.env.SLACK_WEBHOOK_URL) {
        try {
          await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildSlackPayload(highRelevance)),
          });
        } catch (slackErr) {
          console.error('[competitor-intel] Slack notification failed:', slackErr);
        }
      }

      // Email digest via SendGrid
      if (process.env.SENDGRID_API_KEY) {
        try {
          sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

          const adminEmails = process.env.ADMIN_EMAILS
            ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim())
            : ['issa@ambrosiaventures.co'];

          await sgMail.send({
            to: adminEmails,
            from: 'alerts@ambrosiaventures.co',
            subject: 'Daily Competitor Intelligence Digest',
            html: buildEmailHtml(highRelevance),
          });
        } catch (emailErr) {
          console.error('[competitor-intel] Email notification failed:', emailErr);
        }
      }
    }

    // 7. Log cron run
    await logCronRun(supabase, 'competitor-intel', {
      fetched: allEntries.length,
      processed: newEntries.length,
      inserted,
      errors,
      parameters: {
        newEntries: newEntries.length,
        analyzed: analyzed.length,
        highRelevance: highRelevance.length,
        queuedForBlog: queued,
      },
    });

    const durationMs = Date.now() - startTime;

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'competitor-intel', {
        processed: newEntries.length,
        inserted,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      fetched: allEntries.length,
      newEntries: newEntries.length,
      analyzed: analyzed.length,
      inserted,
      highRelevance: highRelevance.length,
      queuedForBlog: queued,
      errors: errors.length,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[competitor-intel] Error:', message);

    await logCronRun(supabase, 'competitor-intel', {
      errors: [message],
      parameters: { stage: 'top-level' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
