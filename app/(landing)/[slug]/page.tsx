import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { LandingPage, LandingPageSection } from '@/types/content';
import { JsonLd } from '@/components/seo/JsonLd';
import { Calculator, CheckCircle, ArrowRight, ChevronDown } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getLandingPage(slug: string): Promise<LandingPage | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching landing page:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPage(slug);

  if (!page) {
    return { title: 'Not Found' };
  }

  const ogImageUrl = `/api/og?title=${encodeURIComponent(page.hero_title || page.title)}&subtitle=${encodeURIComponent(page.meta_description || 'Calculate licensing deal values')}&type=landing`;

  return {
    title: page.title,
    description: page.meta_description || undefined,
    alternates: {
      canonical: `https://calculator.ambrosiaventures.co/${page.slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.meta_description || undefined,
      type: 'website',
      url: `https://calculator.ambrosiaventures.co/${page.slug}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.meta_description || undefined,
      images: [ogImageUrl],
    },
  };
}

// ISR: regenerate landing pages every 2 hours
export const revalidate = 7200;

export async function generateStaticParams() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('landing_pages')
      .select('slug')
      .eq('status', 'published');

    return data?.map((page) => ({ slug: page.slug })) || [];
  } catch {
    return [];
  }
}

export default async function LandingPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = await getLandingPage(slug);

  if (!page) {
    notFound();
  }

  // Build calculator URL with prefill
  const calculatorParams = new URLSearchParams();
  if (page.prefill_modality) calculatorParams.set('modality', page.prefill_modality);
  if (page.prefill_indication) calculatorParams.set('indication', page.prefill_indication);
  if (page.prefill_phase) calculatorParams.set('phase', page.prefill_phase);
  const calculatorUrl = `/calculator${calculatorParams.toString() ? `?${calculatorParams.toString()}` : ''}`;

  const sections = (page.sections || {}) as {
    value_props?: Array<{ title: string; description: string }>;
    how_it_works?: Array<{ step: number; title: string; description: string }>;
    stats?: Array<{ value: string; label: string }>;
    faqs?: Array<{ question: string; answer: string }>;
  };

  return (
    <>
      <JsonLd type="SoftwareApplication" />

      <main className="min-h-screen">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold text-white">
              Ambrosia Ventures
            </Link>
            <Link
              href={calculatorUrl}
              className="px-4 py-2 bg-white/10 backdrop-blur text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              Try Calculator
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-32 pb-20 px-4 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,199,199,0.15),rgba(255,255,255,0))]" />
            <div className="absolute top-20 right-[10%] w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-[5%] w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-300 text-sm mb-8">
              <Calculator className="w-4 h-4" />
              Free Deal Calculator
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {page.hero_title || page.title}
            </h1>

            {page.hero_subtitle && (
              <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
                {page.hero_subtitle}
              </p>
            )}

            <Link
              href={calculatorUrl}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
            >
              {page.hero_cta_text || 'Try Calculator'}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-6 h-6 text-slate-400" />
          </div>
        </section>

        {/* Value Props */}
        {sections.value_props && sections.value_props.length > 0 && (
          <section className="py-20 px-4 bg-white">
            <div className="max-w-6xl mx-auto">
              <div className="grid gap-8 md:grid-cols-3">
                {sections.value_props.map((prop, i) => (
                  <div key={i} className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-teal-100 rounded-xl mb-4">
                      <CheckCircle className="w-6 h-6 text-teal-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {prop.title}
                    </h3>
                    <p className="text-slate-600">{prop.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Stats */}
        {sections.stats && sections.stats.length > 0 && (
          <section className="py-16 px-4 bg-slate-50">
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-8 md:grid-cols-4">
                {sections.stats.map((stat, i) => (
                  <div key={i} className="text-center">
                    <p className="text-3xl font-bold text-teal-600 mb-1">
                      {stat.value}
                    </p>
                    <p className="text-slate-600 text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* How It Works */}
        {sections.how_it_works && sections.how_it_works.length > 0 && (
          <section className="py-20 px-4 bg-white">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
                How It Works
              </h2>
              <div className="grid gap-8 md:grid-cols-3">
                {sections.how_it_works.map((step) => (
                  <div key={step.step} className="relative">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="flex items-center justify-center w-10 h-10 bg-teal-100 text-teal-700 font-bold rounded-full">
                        {step.step}
                      </span>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-slate-600 ml-14">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        {sections.faqs && sections.faqs.length > 0 && (
          <section className="py-20 px-4 bg-slate-50">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                {sections.faqs.map((faq, i) => (
                  <details
                    key={i}
                    className="group bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <summary className="flex items-center justify-between p-6 cursor-pointer">
                      <span className="font-medium text-slate-900">
                        {faq.question}
                      </span>
                      <ChevronDown className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="px-6 pb-6 text-slate-600">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>

              {/* FAQ Schema */}
              <JsonLd type="FAQ" data={{ faqs: sections.faqs }} />
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Calculate Your Deal Terms?
            </h2>
            <p className="text-slate-300 mb-8">
              Get instant benchmarks based on real market data from recent biotech licensing deals.
            </p>
            <Link
              href={calculatorUrl}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
            >
              Start Calculating
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 bg-slate-900 border-t border-slate-800">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <p className="text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} Ambrosia Ventures
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/calculator" className="hover:text-white transition-colors">
                Calculator
              </Link>
              <Link href="/blog" className="hover:text-white transition-colors">
                Blog
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
