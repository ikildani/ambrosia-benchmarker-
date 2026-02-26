'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BlogPost as BlogPostType } from '@/types/content';
import { JsonLd } from '@/components/seo/JsonLd';
import { Calendar, Clock, ArrowLeft, Share2, Linkedin, Twitter, ExternalLink, BookOpen } from 'lucide-react';

interface BlogPostProps {
  post: BlogPostType;
}

// Estimate reading time
function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / 200);
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Category labels
const categoryLabels: Record<string, string> = {
  'deal-trends': 'Deal Trends',
  'modality-insights': 'Modality Insights',
  'educational': 'Educational',
  'industry-analysis': 'Industry Analysis',
};

// Modality labels
const modalityLabels: Record<string, string> = {
  smallMolecule: 'Small Molecule',
  mab: 'Monoclonal Antibody',
  adc: 'ADC',
  bispecific: 'Bispecific',
  tCellEngager: 'T-cell Engager',
  carT_heme: 'CAR-T (Heme)',
  carT_solid: 'CAR-T (Solid)',
  cellTherapy: 'Cell Therapy',
  geneTherapy: 'Gene Therapy',
  radiopharmaceutical: 'Radiopharmaceutical',
  mrna: 'mRNA',
  rnai: 'RNAi',
  protac: 'PROTAC',
  molecularGlue: 'Molecular Glue',
  peptide: 'Peptide',
  therapeuticVaccine: 'Therapeutic Vaccine',
  oncolyticVirus: 'Oncolytic Virus',
};

// Validate URL to prevent XSS via javascript:, data:, vbscript: protocols
function isSafeUrl(url: string): boolean {
  const trimmedUrl = url.trim().toLowerCase();
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  return !dangerousProtocols.some(protocol => trimmedUrl.startsWith(protocol));
}

// Simple HTML escape for text content
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Simple markdown to HTML converter for basic formatting
// Content is already validated through controlled regex patterns and URL validation
function renderContent(content: string): string {
  // First escape any HTML in the raw content to prevent XSS
  const escapedContent = escapeHtml(content);

  const html = escapedContent
    // Headers (using escaped content, so &lt; and &gt; won't interfere)
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-slate-900 mt-8 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold text-slate-900 mt-10 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-slate-900 mt-12 mb-6">$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Links - with URL protocol validation (URL was already escaped)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      // Unescape the URL for validation, then re-escape for output
      const unescapedUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
      if (isSafeUrl(unescapedUrl)) {
        return `<a href="${url}" class="text-teal-600 hover:text-teal-700 underline" rel="noopener noreferrer">${text}</a>`;
      }
      return text; // Strip dangerous links, keep text only
    })
    // Bullet lists
    .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-4 text-slate-700 leading-relaxed">')
    // Line breaks
    .replace(/\n/g, '<br />');

  return html;
}

export default function BlogPostComponent({ post }: BlogPostProps) {
  const readingTime = estimateReadingTime(post.content);
  const publishDate = post.published_at ? formatDate(post.published_at) : null;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt || post.meta_description || '',
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    }
  };

  return (
    <>
      {/* Structured Data */}
      <JsonLd
        type="Article"
        data={{
          title: post.title,
          description: post.meta_description || post.excerpt || '',
          slug: post.slug,
          publishedAt: post.published_at || post.created_at,
          updatedAt: post.updated_at,
          image: post.featured_image_url || undefined,
        }}
      />

      <article className="max-w-3xl mx-auto">
        {/* Back Link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        {/* Header */}
        <header className="mb-8">
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {post.category && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-50 text-teal-700">
                {categoryLabels[post.category] || post.category}
              </span>
            )}
            {post.modality && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600">
                {modalityLabels[post.modality] || post.modality}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
            {publishDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {publishDate}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {readingTime} min read
            </span>
          </div>

          {/* Featured Image */}
          {post.featured_image_url && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-slate-100 mb-8 relative">
              <Image
                src={post.featured_image_url}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          )}
        </header>

        {/* Content */}
        <div
          className="prose prose-slate max-w-none mb-12"
          dangerouslySetInnerHTML={{
            __html: `<p class="mb-4 text-slate-700 leading-relaxed">${renderContent(post.content)}</p>`,
          }}
        />

        {/* CTA Section */}
        {post.modality && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-center mb-12">
            <h3 className="text-xl font-semibold text-white mb-3">
              Calculate Your {modalityLabels[post.modality] || post.modality} Deal Terms
            </h3>
            <p className="text-slate-300 mb-6">
              Get instant benchmarks for upfront payments, milestones, and royalties.
            </p>
            <Link
              href={`/calculator?modality=${post.modality}${post.indication ? `&indication=${post.indication}` : ''}`}
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
            >
              Try the Calculator
            </Link>
          </div>
        )}

        {/* Sources Section */}
        {post.sources && post.sources.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-6 mb-12">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">Sources & References</h3>
            </div>
            <ul className="space-y-3">
              {post.sources.map((source, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-slate-400 font-medium min-w-[1.5rem]">{index + 1}.</span>
                  <div className="flex-1">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 hover:text-teal-700 hover:underline inline-flex items-center gap-1"
                      >
                        {source.title}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-700">{source.title}</span>
                    )}
                    {(source.publication || source.date) && (
                      <span className="text-slate-500 ml-1">
                        {source.publication && `— ${source.publication}`}
                        {source.date && ` (${source.date})`}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500 border-t border-slate-200 pt-4">
              Data and insights in this article are compiled from public sources, SEC filings, and industry reports.
              Always verify specific deal terms through official company disclosures.
            </p>
          </div>
        )}

        {/* Share Section */}
        <div className="border-t border-slate-200 pt-8">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Share this article</span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleShare}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-600 hover:bg-teal-100 hover:text-teal-600 transition-colors"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-500 transition-colors"
                title="Share on Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                title="Share on LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
