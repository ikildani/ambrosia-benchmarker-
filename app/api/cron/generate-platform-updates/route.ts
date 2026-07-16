import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const GITHUB_REPO = 'ikildani/ambrosia-benchmarker-';
const IGNORED_PREFIXES = ['chore:', 'ci:', 'test:', 'docs:', 'style:', 'build:', 'revert:'];
const IGNORED_PATTERNS = [
  /merge.*branch/i,
  /bump.*version/i,
  /update.*lock/i,
  /co-authored-by/i,
  /auto-commit/i,
  /seed.*script/i,
  /generate.*script/i,
];

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { date: string };
  };
}

interface GeneratedUpdate {
  title: string;
  body: string;
  category: 'feature' | 'improvement' | 'data' | 'fix' | 'announcement';
  cta_url: string | null;
  cta_label: string | null;
}

function isUserFacing(message: string): boolean {
  const firstLine = message.split('\n')[0].toLowerCase();
  if (IGNORED_PREFIXES.some((p) => firstLine.startsWith(p))) return false;
  if (IGNORED_PATTERNS.some((p) => p.test(firstLine))) return false;
  return true;
}

async function fetchCommitsSince(since: string): Promise<GitHubCommit[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');

  const commits: GitHubCommit[] = [];
  let page = 1;

  while (page <= 5) {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits?sha=main&since=${since}&per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!res.ok) {
      if (res.status === 409) return [];
      throw new Error(`GitHub API error: ${res.status}`);
    }

    const data: GitHubCommit[] = await res.json();
    if (data.length === 0) break;
    commits.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return commits;
}

async function generateUpdates(commits: GitHubCommit[]): Promise<GeneratedUpdate[]> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 90_000 });

  const commitList = commits
    .map((c) => `- ${c.commit.message.split('\n')[0]}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are the product communications writer for Ambrosia Ventures, a biopharma deal intelligence platform (calculator.ambrosiaventures.co). The platform helps BD executives, investors, and advisors benchmark licensing deal terms across 1,500+ biopharma transactions.

Analyze these recent git commits and produce platform update announcements for our users:

${commitList}

RULES:
1. Only create updates for changes that USERS would care about. Skip internal refactors, build fixes, CI changes, script additions, dependency updates, and developer tooling.
2. Group related commits into a single update (e.g., 5 commits about "molecular targets" = 1 update).
3. Write 2-6 updates maximum. If there's nothing user-facing, return an empty array.
4. Each update must be specific — cite what changed, not vague promises. Mention numbers, modalities, features by name.
5. Category must be one of: feature, improvement, data, fix, announcement.
6. Body should be 2-3 sentences max. Direct, specific, institutional tone. No exclamation marks. No marketing fluff. Write like Bloomberg or Refinitiv would announce a terminal update.
7. Title should be declarative and specific (e.g., "Molecular Target Valuations Are Live", not "New Feature Added").
8. cta_url should only be set if there's a specific page the user should visit. Use https://calculator.ambrosiaventures.co as the base. Set to null if no specific page applies.
9. cta_label should be action-oriented if set (e.g., "Run a Calculation", "View API Access"). Max 3 words.

Respond with ONLY a JSON array of objects, no markdown, no explanation:
[{"title": "...", "body": "...", "category": "...", "cta_url": "..." or null, "cta_label": "..." or null}]

If no user-facing changes exist, respond with: []`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (u: GeneratedUpdate) =>
        u.title &&
        u.body &&
        ['feature', 'improvement', 'data', 'fix', 'announcement'].includes(u.category)
    );
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid =
    isValidLength &&
    timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Determine cutoff: last generated update's created_at, or 14 days ago
    const { data: lastUpdate } = await supabase
      .from('platform_updates')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const cutoff = lastUpdate?.created_at
      ? lastUpdate.created_at
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch commits from GitHub
    const allCommits = await fetchCommitsSince(cutoff);
    const userFacingCommits = allCommits.filter((c) =>
      isUserFacing(c.commit.message)
    );

    if (userFacingCommits.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'no_user_facing_commits',
        total_commits: allCommits.length,
      });
    }

    // Generate updates via Claude
    const generated = await generateUpdates(userFacingCommits);

    if (generated.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'ai_found_no_announceables',
        commits_analyzed: userFacingCommits.length,
      });
    }

    // Deduplicate against recent updates (same title within 30 days)
    const { data: recentUpdates } = await supabase
      .from('platform_updates')
      .select('title')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const existingTitles = new Set(
      (recentUpdates || []).map((u) => u.title.toLowerCase())
    );

    const fresh = generated.filter(
      (u) => !existingTitles.has(u.title.toLowerCase())
    );

    if (fresh.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'all_updates_already_exist',
        generated: generated.length,
      });
    }

    // Insert into platform_updates
    const { error: insertError } = await supabase
      .from('platform_updates')
      .insert(
        fresh.map((u) => ({
          title: u.title,
          body: u.body,
          category: u.category,
          cta_url: u.cta_url || null,
          cta_label: u.cta_label || null,
          created_by: 'auto:generate-platform-updates',
        }))
      );

    if (insertError) {
      captureApiError(insertError, 'cron-generate-platform-updates-insert');
      return NextResponse.json({ error: 'Failed to insert updates' }, { status: 500 });
    }

    try {
      await runCronIntelligence(supabase, 'generate-platform-updates', {
        processed: userFacingCommits.length,
        inserted: fresh.length,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      total_commits: allCommits.length,
      user_facing_commits: userFacingCommits.length,
      updates_generated: generated.length,
      updates_inserted: fresh.length,
      updates_deduplicated: generated.length - fresh.length,
      titles: fresh.map((u) => u.title),
    });
  } catch (error) {
    captureApiError(error, 'cron-generate-platform-updates');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Generate platform updates failed', detail: message },
      { status: 500 }
    );
  }
}
