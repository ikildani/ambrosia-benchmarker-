import { Metadata } from 'next';
import Link from 'next/link';
import { blogPosts, type BlogPost } from '@/lib/blogPosts';
import { createServiceClient } from '@/lib/supabase/server';
import { generateBreadcrumbSchema } from '@/lib/seo/structured-data';
import { DEAL_STATS } from '@/lib/config/constants';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Life Sciences Deal Intelligence Blog | Ambrosia Ventures',
  description:
    'Expert analysis of biotech deal trends, pharma licensing insights, and negotiation strategies. Data-driven perspectives on biopharma M&A from the Ambrosia Ventures deal intelligence team.',
  keywords: [
    'biotech deal blog',
    'pharma licensing insights',
    'biopharma deal analysis',
    'life sciences M&A blog',
    'biotech negotiation strategies',
    'drug licensing trends',
    'ADC deal trends',
    'GLP-1 obesity deals',
  ],
  alternates: {
    canonical: `${BASE_URL}/blog`,
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
  openGraph: {
    title: 'Life Sciences Deal Intelligence Blog',
    description:
      'Expert analysis of biotech deal trends, pharma licensing insights, and negotiation strategies from the Ambrosia Ventures team.',
    type: 'website',
    url: `${BASE_URL}/blog`,
    siteName: 'Ambrosia Ventures',
    images: [
      {
        url: '/api/og?title=Deal%20Intelligence%20Blog&subtitle=Expert%20Biopharma%20Deal%20Analysis',
        width: 1200,
        height: 630,
        alt: 'Life Sciences Deal Intelligence Blog',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Life Sciences Deal Intelligence Blog',
    description:
      'Expert analysis of biotech deal trends, pharma licensing insights, and negotiation strategies.',
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Deal Analysis': 'bg-blue-500/15 text-blue-400',
  'Market Analysis': 'bg-emerald-500/15 text-emerald-400',
  'Deal Strategy': 'bg-purple-500/15 text-purple-400',
  'Negotiation Strategy': 'bg-amber-500/15 text-amber-400',
  'Industry Analysis': 'bg-cyan-500/15 text-cyan-400',
};

const CATEGORY_PILL_COLORS: Record<string, string> = {
  'Deal Analysis': 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  'Market Analysis': 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  'Deal Strategy': 'bg-purple-500/10 text-purple-400 ring-purple-500/20',
  'Negotiation Strategy': 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  'Industry Analysis': 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/20',
};

async function getAllPosts(): Promise<BlogPost[]> {
  const staticPosts = [...blogPosts];
  const staticSlugs = new Set(staticPosts.map(p => p.slug));

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, title, meta_description, excerpt, category, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    const dbPosts: BlogPost[] = (data || [])
      .filter(d => !staticSlugs.has(d.slug))
      .map(d => ({
        slug: d.slug,
        title: d.title,
        metaDescription: d.meta_description || '',
        excerpt: d.excerpt || d.meta_description || '',
        author: 'Ambrosia Ventures',
        publishedAt: d.published_at || '',
        category: (d.category || 'Deal Intelligence').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        readTime: '5 min read',
        content: '',
        faqs: [],
        relatedLinks: [],
      }));

    return [...staticPosts, ...dbPosts].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  } catch {
    return staticPosts;
  }
}

export default async function BlogPage() {
  const allPosts = await getAllPosts();
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Blog' },
  ]);

  const featuredPost = allPosts[0];
  const recentPosts = allPosts.slice(1);

  const categories = Array.from(new Set(allPosts.map(p => p.category)));

  return (
    <>
      <main className="min-h-screen bg-[#0a0f1a]">
        {/* Breadcrumb Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />

        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Radial teal glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0a0f1a] to-[#0d1420]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-teal-500/[0.07] rounded-full blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-blue-500/[0.04] rounded-full blur-[100px]" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12 sm:pb-16">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-xs font-medium text-teal-400 tracking-wide uppercase">
                  Deal Intelligence Blog
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-5">
                Insights for{' '}
                <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  Deal Professionals
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto mb-8">
                Data-driven analysis backed by {DEAL_STATS.TOTAL_DEALS}+ verified biopharma
                transactions. Licensing benchmarks, negotiation strategies, and market intelligence.
              </p>

              {/* Article count + Category pills */}
              <div className="flex flex-col items-center gap-4">
                <span className="text-sm text-slate-500">
                  {allPosts.length} article{allPosts.length !== 1 ? 's' : ''}
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {categories.map((cat) => (
                    <span
                      key={cat}
                      className={`text-xs font-medium px-3 py-1 rounded-full ring-1 ring-inset ${CATEGORY_PILL_COLORS[cat] || 'bg-slate-500/10 text-slate-400 ring-slate-500/20'}`}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Post */}
        {featuredPost && (
          <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <Link href={`/blog/${featuredPost.slug}`} className="group block">
              <article className="relative rounded-2xl border border-white/[0.06] bg-[#0d1420] p-8 sm:p-10 lg:p-12 overflow-hidden transition-all duration-300 hover:border-teal-500/30 hover:shadow-[0_0_40px_-12px_rgba(20,184,166,0.15)]">
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/[0.03] via-transparent to-blue-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-12">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">
                        Featured
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-600" />
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[featuredPost.category] || 'bg-slate-500/15 text-slate-400'}`}
                      >
                        {featuredPost.category}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4 group-hover:text-teal-300 transition-colors duration-300 leading-tight">
                      {featuredPost.title}
                    </h2>

                    <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-6 max-w-2xl">
                      {featuredPost.excerpt}
                    </p>

                    <div className="flex items-center gap-4">
                      <time
                        dateTime={featuredPost.publishedAt}
                        className="text-sm text-slate-500"
                      >
                        {new Date(featuredPost.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                      <span className="w-1 h-1 rounded-full bg-slate-600" />
                      <span className="text-sm text-slate-500">{featuredPost.readTime}</span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 lg:self-end">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 group-hover:gap-3 transition-all duration-300">
                      Read article
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          </section>
        )}

        {/* Recent Posts Grid */}
        {recentPosts.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-8">
              Recent Articles
            </h2>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recentPosts.map((post) => (
                <article
                  key={post.slug}
                  className="group flex flex-col rounded-2xl border border-white/[0.06] bg-[#0d1420] overflow-hidden transition-all duration-300 hover:border-teal-500/20 hover:shadow-[0_0_30px_-12px_rgba(20,184,166,0.1)]"
                >
                  <Link href={`/blog/${post.slug}`} className="flex flex-col flex-1 p-6 sm:p-7">
                    <div className="flex items-center gap-3 mb-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[post.category] || 'bg-slate-500/15 text-slate-400'}`}
                      >
                        {post.category}
                      </span>
                      <span className="text-xs text-slate-600">
                        {post.readTime}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-3 group-hover:text-teal-300 transition-colors duration-300 leading-snug">
                      {post.title}
                    </h3>

                    <p className="text-sm text-slate-400 leading-relaxed mb-5 flex-1">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/[0.04]">
                      <time
                        dateTime={post.publishedAt}
                        className="text-xs text-slate-500"
                      >
                        {new Date(post.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                      <span className="text-sm font-medium text-teal-400 inline-flex items-center gap-1 group-hover:gap-2 transition-all duration-300">
                        Read article
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#0d1420] via-[#111827] to-[#0d1420] p-10 sm:p-14 text-center overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-teal-500/[0.06] rounded-full blur-[100px]" />

            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Benchmark Your Next Deal
              </h2>
              <p className="text-slate-400 mb-8 max-w-xl mx-auto leading-relaxed">
                Get data-driven deal terms for any therapeutic area, modality, and clinical phase.
                Powered by {DEAL_STATS.TOTAL_DEALS}+ verified biopharma transactions.
              </p>
              <Link
                href="/calculator"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-teal-500 hover:bg-teal-400 text-[#0a0f1a] font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-teal-500/20 hover:shadow-teal-400/30"
              >
                Try Solidus
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
