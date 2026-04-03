import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { blogPosts, getBlogPost, getAllBlogSlugs, type BlogPost } from '@/lib/blogPosts';
import { createServiceClient } from '@/lib/supabase/server';
import {
  generateArticleSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from '@/lib/seo/structured-data';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { DEAL_STATS } from '@/lib/config/constants';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Look up a blog post: static file first, then Supabase fallback for AI-generated posts */
async function resolvePost(slug: string): Promise<BlogPost | null> {
  const staticPost = getBlogPost(slug);
  if (staticPost) return staticPost;

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, title, meta_description, content, category, excerpt, published_at, tags')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (!data) return null;

    return {
      slug: data.slug,
      title: data.title,
      metaDescription: data.meta_description || data.excerpt || '',
      excerpt: data.excerpt || data.meta_description || '',
      author: 'Ambrosia Ventures',
      publishedAt: data.published_at || new Date().toISOString(),
      category: formatCategory(data.category),
      readTime: `${Math.max(3, Math.ceil((data.content?.length || 0) / 1500))} min read`,
      content: data.content || '',
      faqs: [],
      relatedLinks: [],
    };
  } catch {
    return null;
  }
}

/** Fetch related posts from both static and DB sources */
async function getRelatedPosts(currentSlug: string, category: string): Promise<BlogPost[]> {
  // Static related posts
  const staticRelated = blogPosts
    .filter((p) => p.slug !== currentSlug)
    .slice(0, 2);

  // DB related posts
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, title, meta_description, excerpt, category, published_at')
      .eq('status', 'published')
      .neq('slug', currentSlug)
      .order('published_at', { ascending: false })
      .limit(4);

    const dbPosts: BlogPost[] = (data || []).map((d) => ({
      slug: d.slug,
      title: d.title,
      metaDescription: d.meta_description || '',
      excerpt: d.excerpt || d.meta_description || '',
      author: 'Ambrosia Ventures',
      publishedAt: d.published_at || '',
      category: formatCategory(d.category),
      readTime: '5 min read',
      content: '',
      faqs: [],
      relatedLinks: [],
    }));

    // Merge, deduplicate, prefer same category
    const allPosts = [...staticRelated, ...dbPosts];
    const seen = new Set<string>();
    const unique = allPosts.filter((p) => {
      if (seen.has(p.slug)) return false;
      seen.add(p.slug);
      return true;
    });

    // Sort: same category first
    unique.sort((a, b) => {
      const aMatch = a.category === category ? 0 : 1;
      const bMatch = b.category === category ? 0 : 1;
      return aMatch - bMatch;
    });

    return unique.slice(0, 3);
  } catch {
    return staticRelated;
  }
}

function formatCategory(cat: string | null): string {
  if (!cat) return 'Deal Intelligence';
  return cat
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert markdown content to HTML (basic conversion for DB posts) */
function markdownToHtml(content: string): string {
  if (content.includes('<p>') || content.includes('<h2>')) return content; // Already HTML

  return content
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>') // Treat H1 as H2 (page already has H1)
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs (lines not already wrapped)
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');
}

/** Extract a table of contents from HTML content */
function extractTOC(html: string): { id: string; text: string; level: number }[] {
  const headingRegex = /<h([23])[^>]*>([^<]+)<\/h[23]>/g;
  const toc: { id: string; text: string; level: number }[] = [];
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    toc.push({ id, text, level: parseInt(match[1]) });
  }
  return toc;
}

/** Add IDs to headings in HTML for anchor linking */
function addHeadingIds(html: string): string {
  return html.replace(/<h([23])([^>]*)>([^<]+)<\/h[23]>/g, (_match, level, attrs, text) => {
    const id = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `<h${level}${attrs} id="${id}">${text}</h${level}>`;
  });
}

/* ─── Category styling ─────────────────────────────────────────────── */

const CATEGORY_STYLES: Record<string, { badge: string; accent: string; gradient: string }> = {
  'Deal Analysis':        { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',       accent: 'text-blue-600 dark:text-blue-400',    gradient: 'from-blue-500/10 via-transparent to-transparent' },
  'Market Analysis':      { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', accent: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500/10 via-transparent to-transparent' },
  'Deal Strategy':        { badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',   accent: 'text-purple-600 dark:text-purple-400',  gradient: 'from-purple-500/10 via-transparent to-transparent' },
  'Negotiation Strategy': { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',     accent: 'text-amber-600 dark:text-amber-400',   gradient: 'from-amber-500/10 via-transparent to-transparent' },
  'Deal Trends':          { badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',       accent: 'text-cyan-600 dark:text-cyan-400',    gradient: 'from-cyan-500/10 via-transparent to-transparent' },
  'Educational':          { badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',   accent: 'text-violet-600 dark:text-violet-400',  gradient: 'from-violet-500/10 via-transparent to-transparent' },
  'Industry Analysis':    { badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',       accent: 'text-rose-600 dark:text-rose-400',    gradient: 'from-rose-500/10 via-transparent to-transparent' },
};

const DEFAULT_STYLE = { badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300', accent: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500/10 via-transparent to-transparent' };

/* ─── Static params + metadata ─────────────────────────────────────── */

export async function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await resolvePost(slug);

  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.title} | Ambrosia Ventures`,
    description: post.metaDescription,
    authors: [{ name: post.author }],
    alternates: { canonical: `${BASE_URL}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.metaDescription,
      type: 'article',
      url: `${BASE_URL}/blog/${post.slug}`,
      siteName: 'Ambrosia Ventures',
      publishedTime: post.publishedAt,
      authors: [post.author],
      images: [{ url: `/api/og?title=${encodeURIComponent(post.title)}&subtitle=${encodeURIComponent(post.category)}`, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.metaDescription,
      creator: '@AmbrosiaVC',
    },
  };
}

/* ─── Page ─────────────────────────────────────────────────────────── */

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await resolvePost(slug);

  if (!post) notFound();

  const htmlContent = addHeadingIds(markdownToHtml(post.content));
  const toc = extractTOC(htmlContent);
  const relatedPosts = await getRelatedPosts(slug, post.category);
  const style = CATEGORY_STYLES[post.category] || DEFAULT_STYLE;

  const articleSchema = generateArticleSchema({
    title: post.title,
    description: post.metaDescription,
    slug: post.slug,
    publishedAt: post.publishedAt,
  });
  const faqSchema = post.faqs.length > 0 ? generateFAQSchema(post.faqs) : null;
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Blog', url: `${BASE_URL}/blog` },
    { name: post.title },
  ]);

  const publishedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <main className="min-h-screen bg-white dark:bg-slate-900">
        {/* ━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="flex items-center text-base font-bold text-slate-900 dark:text-white">
                Ambrosia Ventures
              </Link>
              <div className="flex items-center gap-5">
                <Link href="/blog" className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Blog</Link>
                <Link href="/calculator" className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 transition-colors">Calculator</Link>
                <Link href="/report" className="hidden sm:inline-flex text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors">Get Report</Link>
              </div>
            </div>
          </div>
        </header>

        {/* Structured Data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org', '@type': 'Organization', name: 'Ambrosia Ventures',
          url: BASE_URL, logo: `${BASE_URL}/logo.png`,
          description: 'Life sciences deal intelligence platform providing licensing benchmarks and rNPV analysis for biopharma professionals.',
        }) }} />
        {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}

        {/* ━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className={`relative bg-gradient-to-b ${style.gradient} to-white dark:to-slate-900`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100/50 via-transparent to-transparent dark:from-slate-800/50 pointer-events-none" />

          <article className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-8">
              <ol className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                <li><Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Home</Link></li>
                <li aria-hidden="true" className="text-slate-300 dark:text-slate-600">/</li>
                <li><Link href="/blog" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Blog</Link></li>
                <li aria-hidden="true" className="text-slate-300 dark:text-slate-600">/</li>
                <li className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[220px] sm:max-w-none">{post.title}</li>
              </ol>
            </nav>

            {/* Article header */}
            <header className="mb-10 sm:mb-14">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${style.badge}`}>
                  {post.category}
                </span>
                <span className="text-sm text-slate-400 dark:text-slate-500">{post.readTime}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-slate-900 dark:text-white leading-[1.12] tracking-tight mb-5">
                {post.title}
              </h1>

              <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mb-6">
                {post.excerpt}
              </p>

              <div className="flex items-center gap-4 pb-8 border-b border-slate-200/80 dark:border-slate-700/80">
                {/* Author avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  AV
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{post.author}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <time dateTime={post.publishedAt}>{publishedDate}</time>
                    <span>&middot;</span>
                    <span>Based on {DEAL_STATS.TOTAL_DEALS} transactions</span>
                  </div>
                </div>
              </div>
            </header>

            {/* ━━━ TABLE OF CONTENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {toc.length >= 3 && (
              <nav className="mb-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/50 p-5 sm:p-6">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">In this article</p>
                <ul className="space-y-2">
                  {toc.map((item) => (
                    <li key={item.id} className={item.level === 3 ? 'ml-4' : ''}>
                      <a
                        href={`#${item.id}`}
                        className="text-sm text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors leading-relaxed"
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {/* ━━━ ARTICLE BODY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div
              className="prose prose-slate dark:prose-invert prose-lg max-w-none
                prose-headings:font-extrabold prose-headings:tracking-tight
                prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-slate-900 dark:prose-h2:text-white prose-h2:border-b prose-h2:border-slate-100 dark:prose-h2:border-slate-800 prose-h2:pb-3
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:leading-[1.8] prose-p:text-slate-600 dark:prose-p:text-slate-300
                prose-a:text-teal-600 dark:prose-a:text-teal-400 prose-a:font-semibold prose-a:no-underline prose-a:border-b prose-a:border-teal-200 dark:prose-a:border-teal-800 hover:prose-a:border-teal-500 prose-a:transition-colors
                prose-strong:text-slate-800 dark:prose-strong:text-slate-200 prose-strong:font-bold
                prose-li:marker:text-teal-500 prose-li:leading-relaxed
                prose-blockquote:border-l-teal-500 prose-blockquote:bg-slate-50 dark:prose-blockquote:bg-slate-800/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:not-italic
                prose-code:text-teal-700 dark:prose-code:text-teal-300 prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm
                prose-table:text-sm prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:font-bold prose-th:text-slate-700 dark:prose-th:text-slate-300
                prose-img:rounded-xl prose-img:shadow-lg
                mb-16"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

            {/* ━━━ RELATED LINKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {post.relatedLinks.length > 0 && (
              <div className="mb-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/50 p-6 sm:p-8">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Related Resources</h2>
                <div className="flex flex-wrap gap-3">
                  {post.relatedLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600 transition-colors"
                    >
                      {link.label}
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* ━━━ FAQs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {post.faqs.length > 0 && (
              <section className="mb-12">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">Frequently Asked Questions</h2>
                <div className="space-y-3">
                  {post.faqs.map((faq, i) => (
                    <details key={i} className="group bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/50 overflow-hidden">
                      <summary className="flex items-center justify-between cursor-pointer p-5 text-left font-semibold text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        {faq.question}
                        <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </summary>
                      <div className="px-5 pb-5 text-slate-600 dark:text-slate-300 leading-relaxed">{faq.answer}</div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* ━━━ RELATED POSTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {relatedPosts.length > 0 && (
              <section className="mb-12">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">More from the Blog</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedPosts.map((related) => {
                    const rs = CATEGORY_STYLES[related.category] || DEFAULT_STYLE;
                    return (
                      <Link
                        key={related.slug}
                        href={`/blog/${related.slug}`}
                        className="group bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/50 p-5 hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-md transition-all"
                      >
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${rs.accent} mb-2 block`}>
                          {related.category}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors mb-2 leading-snug">
                          {related.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {related.excerpt}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ━━━ CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="mb-16 relative overflow-hidden bg-gradient-to-r from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-900/20 dark:via-cyan-900/15 dark:to-blue-900/20 rounded-2xl border border-teal-200/50 dark:border-teal-800/30 p-8 sm:p-10 text-center">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
              <div className="relative">
                <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 tracking-[0.15em] uppercase mb-3">Deal Intelligence</p>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3">
                  Ready to Benchmark Your Deal?
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
                  Get instant, data-driven deal terms powered by {DEAL_STATS.TOTAL_DEALS} verified
                  biopharma transactions across 12 therapeutic areas.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/calculator"
                    className="inline-flex items-center px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors text-sm shadow-sm"
                  >
                    Open the Deal Calculator
                  </Link>
                  <Link
                    href="/report"
                    className="inline-flex items-center px-6 py-3 bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-400 font-semibold rounded-xl border border-teal-200 dark:border-teal-800 hover:border-teal-400 transition-colors text-sm"
                  >
                    Get a Full Report — $499
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
