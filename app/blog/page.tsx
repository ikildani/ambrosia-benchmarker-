import { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import BlogList from '@/components/blog/BlogList';
import { BlogPost } from '@/types/content';
import { ArrowLeft, TrendingUp, Microscope, BookOpen, BarChart3 } from 'lucide-react';
import { NewsletterSignup } from '@/components/blog/NewsletterSignup';

export const metadata: Metadata = {
  title: 'Biotech Licensing Insights | Ambrosia Ventures Blog',
  description: 'Expert analysis of biotech licensing deals, modality trends, and negotiation strategies for life sciences professionals.',
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/blog',
  },
  openGraph: {
    title: 'Biotech Licensing Insights | Ambrosia Ventures Blog',
    description: 'Expert analysis of biotech licensing deals, modality trends, and negotiation strategies.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/blog',
    images: [
      {
        url: '/api/og?title=Biotech%20Licensing%20Insights&subtitle=Expert%20Deal%20Analysis%20%26%20Trends',
        width: 1200,
        height: 630,
        alt: 'Ambrosia Ventures Blog',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biotech Licensing Insights | Ambrosia Ventures Blog',
    description: 'Expert analysis of biotech licensing deals, modality trends, and negotiation strategies.',
  },
};

// Category filter options
const categories = [
  { value: 'all', label: 'All Posts' },
  { value: 'deal-trends', label: 'Deal Trends' },
  { value: 'modality-insights', label: 'Modality Insights' },
  { value: 'educational', label: 'Educational' },
  { value: 'industry-analysis', label: 'Industry Analysis' },
];

async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching blog posts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    // Table might not exist yet
    console.log('Blog posts table not available yet');
    return [];
  }
}

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Calculator
          </Link>
          <Link href="/" className="font-semibold text-slate-900">
            Ambrosia Ventures
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-16 pb-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
            Biotech Licensing Insights
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Data-driven analysis of deal trends, modality valuations, and negotiation strategies for life sciences professionals.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          {posts.length > 0 ? (
            <BlogList posts={posts} />
          ) : (
            <div className="max-w-2xl mx-auto">
              {/* Coming Soon Hero */}
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 px-8 mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-full mb-6">
                  <svg className="w-10 h-10 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-3">
                  Launching Soon
                </h2>
                <p className="text-slate-600 mb-8 max-w-md mx-auto">
                  We&apos;re building a library of data-driven insights for life sciences dealmakers. Be the first to know when we publish.
                </p>

                {/* Upcoming Topics */}
                <div className="grid sm:grid-cols-2 gap-3 text-left mb-8">
                  {[
                    { icon: TrendingUp, label: 'Deal Trends', desc: 'Market shifts in licensing valuations' },
                    { icon: Microscope, label: 'Modality Insights', desc: 'ADC, gene therapy, and mRNA deal benchmarks' },
                    { icon: BookOpen, label: 'Educational', desc: 'Guides to structuring biotech deals' },
                    { icon: BarChart3, label: 'Industry Analysis', desc: 'Quarterly deal activity and forecasts' },
                  ].map((topic) => (
                    <div key={topic.label} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <topic.icon className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{topic.label}</p>
                        <p className="text-xs text-slate-500">{topic.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/calculator"
                  className="inline-flex items-center justify-center px-6 py-3 text-teal-600 font-medium hover:text-teal-700 transition-colors"
                >
                  Try the Calculator &rarr;
                </Link>
              </div>

              {/* Newsletter Signup */}
              <NewsletterSignup />
            </div>
          )}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Benchmark Your Deal?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Get instant estimates for upfront payments, milestones, and royalties based on real market data.
          </p>
          <Link
            href="/calculator"
            className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
          >
            Calculate Deal Terms
          </Link>
        </div>
      </section>
    </main>
  );
}
