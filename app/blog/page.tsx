import { Metadata } from 'next';
import Link from 'next/link';
import { blogPosts, type BlogPost } from '@/lib/blogPosts';
import { createServiceClient } from '@/lib/supabase/server';
import { generateBreadcrumbSchema } from '@/lib/seo/structured-data';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

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
  'Deal Analysis': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'Market Analysis': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Deal Strategy': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'Negotiation Strategy': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
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

  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        {/* Header */}
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center text-lg font-bold text-slate-900 dark:text-white">
                Ambrosia Ventures
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href="/calculator"
                  className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                >
                  Calculator
                </Link>
                <Link
                  href="/"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Home
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Breadcrumb Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />

        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          {/* Page Header */}
          <div className="mb-10 sm:mb-14">
            <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-3">
              Deal Intelligence Blog
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Insights for Life Sciences Deal Professionals
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl">
              Data-driven analysis of biotech deal trends, licensing benchmarks, and negotiation
              strategies from the team behind the Ambrosia Ventures deal intelligence platform.
            </p>
          </div>

          {/* Blog Post Grid */}
          <div className="grid gap-8 md:grid-cols-2">
            {allPosts.map((post) => (
              <article
                key={post.slug}
                className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-lg transition-all duration-200"
              >
                <Link href={`/blog/${post.slug}`} className="block p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[post.category] || 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}
                    >
                      {post.category}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {post.readTime}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <time
                      dateTime={post.publishedAt}
                      className="text-xs text-slate-500 dark:text-slate-400"
                    >
                      {new Date(post.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                    <span className="text-sm font-medium text-teal-600 dark:text-teal-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      Read article
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-16 text-center bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 rounded-2xl border border-teal-200/50 dark:border-teal-800/50 p-8 sm:p-12">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
              Benchmark Your Next Deal
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-xl mx-auto">
              Get data-driven deal terms for any therapeutic area, modality, and clinical phase.
              Powered by 3,000+ verified biopharma transactions.
            </p>
            <Link
              href="/calculator"
              className="inline-flex items-center px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors"
            >
              Try the Deal Calculator
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
