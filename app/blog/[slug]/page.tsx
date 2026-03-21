import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { blogPosts, getBlogPost, getAllBlogSlugs } from '@/lib/blogPosts';
import {
  generateArticleSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from '@/lib/seo/structured-data';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return { title: 'Post Not Found' };
  }

  return {
    title: post.title,
    description: post.metaDescription,
    authors: [{ name: post.author }],
    alternates: {
      canonical: `${BASE_URL}/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.metaDescription,
      type: 'article',
      url: `${BASE_URL}/blog/${post.slug}`,
      siteName: 'Ambrosia Ventures',
      publishedTime: post.publishedAt,
      authors: [post.author],
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(post.title)}&subtitle=${encodeURIComponent(post.category)}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.metaDescription,
      creator: '@AmbrosiaVC',
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const articleSchema = generateArticleSchema({
    title: post.title,
    description: post.metaDescription,
    slug: post.slug,
    publishedAt: post.publishedAt,
  });

  const faqSchema =
    post.faqs.length > 0 ? generateFAQSchema(post.faqs) : null;

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Blog', url: `${BASE_URL}/blog` },
    { name: post.title },
  ]);

  // Author schema
  const authorSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ambrosia Ventures',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description:
      'Life sciences deal intelligence platform providing licensing benchmarks and rNPV analysis for biopharma professionals.',
  };

  // Find related posts (other posts, excluding current)
  const relatedPosts = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        {/* Header */}
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link
                href="/"
                className="flex items-center text-lg font-bold text-slate-900 dark:text-white"
              >
                Ambrosia Ventures
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href="/blog"
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Blog
                </Link>
                <Link
                  href="/calculator"
                  className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                >
                  Calculator
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(authorSchema) }}
        />
        {faqSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
          />
        )}

        {/* Article */}
        <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/blog" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                  Blog
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px] sm:max-w-none">
                {post.title}
              </li>
            </ol>
          </nav>

          {/* Article Header */}
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                {post.category}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {post.readTime}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-slate-900 dark:text-white leading-tight mb-4">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>By {post.author}</span>
              <span aria-hidden="true">|</span>
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            </div>
          </header>

          {/* Article Body */}
          <div
            className="prose prose-slate dark:prose-invert prose-lg max-w-none
              prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white
              prose-a:text-teal-600 dark:prose-a:text-teal-400 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
              prose-strong:text-slate-800 dark:prose-strong:text-slate-200
              prose-li:marker:text-teal-500
              mb-12"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Related Links */}
          {post.relatedLinks.length > 0 && (
            <div className="mb-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Related Resources
              </h2>
              <div className="flex flex-wrap gap-3">
                {post.relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600 transition-colors"
                  >
                    {link.label}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* FAQs */}
          {post.faqs.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Frequently Asked Questions
              </h2>
              <div className="space-y-4">
                {post.faqs.map((faq, index) => (
                  <details
                    key={index}
                    className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer p-5 text-left font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      {faq.question}
                      <svg
                        className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-5 pb-5 text-slate-600 dark:text-slate-300 leading-relaxed">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                More from the Blog
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-md transition-all"
                  >
                    <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 mb-2 block">
                      {related.category}
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors mb-2">
                      {related.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                      {related.excerpt}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-900/20 dark:to-blue-900/20 rounded-2xl border border-teal-200/50 dark:border-teal-800/50 p-8 sm:p-10">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Ready to Benchmark Your Deal?
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-5 max-w-md mx-auto text-sm">
              Get instant, data-driven deal terms powered by 3,000+ verified biopharma transactions.
            </p>
            <Link
              href="/calculator"
              className="inline-flex items-center px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Open the Deal Calculator
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
