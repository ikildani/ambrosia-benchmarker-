/**
 * Publishes AI-generated blog content to Supabase blog_posts table
 * and logs the generation to seo_content_log.
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import { type GeneratedBlogContent } from '@/lib/ai/content-generator';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PublishResult {
  success: boolean;
  slug?: string;
  error?: string;
}

interface TopicMeta {
  therapeuticArea: string;
  modality: string;
  phase: string;
  topicKey: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a URL-safe slug from a title (lowercase, kebab-case, max 80 chars).
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function formatTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ── Publisher ────────────────────────────────────────────────────────────────

export async function publishBlogPost(
  supabase: SupabaseClient,
  content: GeneratedBlogContent,
  topic: TopicMeta,
): Promise<PublishResult> {
  const slug = slugify(content.title);

  try {
    // 1. Insert into blog_posts
    const { data: post, error: postError } = await supabase
      .from('blog_posts')
      .insert({
        title: content.title,
        content: content.content,
        excerpt: content.excerpt,
        meta_description: content.meta_description,
        slug,
        category: 'deal-trends',
        tags: [topic.therapeuticArea, topic.modality, topic.phase],
        modality: topic.modality,
        ai_generated: true,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (postError) {
      console.error('[blog-publisher] Failed to insert blog_posts:', postError.message);
      return { success: false, error: postError.message };
    }

    // 2. Log to seo_content_log
    const { error: logError } = await supabase
      .from('seo_content_log')
      .insert({
        topic_key: topic.topicKey,
        content_type: 'blog_post',
        result_id: post.id,
        therapeutic_area: topic.therapeuticArea,
        modality: topic.modality,
        phase: topic.phase,
      });

    if (logError) {
      console.error('[blog-publisher] Failed to insert seo_content_log (non-fatal):', logError.message);
    }

    return { success: true, slug };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[blog-publisher] Unexpected error:', message);
    return { success: false, error: message };
  }
}

// ── Slack notification ───────────────────────────────────────────────────────

export async function notifySEOContentGenerated(slug: string, title: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('[Slack] SLACK_WEBHOOK_URL not configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `New SEO blog post published: ${title}`,
        attachments: [
          {
            color: '#10b981',
            blocks: [
              {
                type: 'header',
                text: { type: 'plain_text', text: 'SEO Blog Post Published', emoji: true },
              },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Title:*\n${title}` },
                  { type: 'mrkdwn', text: `*Slug:*\n/blog/${slug}` },
                  { type: 'mrkdwn', text: `*Time:*\n${formatTimestamp()}` },
                ],
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Slack] Webhook failed:', response.status, body);
    }
  } catch (error) {
    console.error('[Slack] Webhook error:', error);
  }
}
