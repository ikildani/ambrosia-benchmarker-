import Link from 'next/link';
import Image from 'next/image';
import { BlogPost } from '@/types/content';
import { Calendar, Clock, ArrowRight } from 'lucide-react';

interface BlogCardProps {
  post: BlogPost;
}

// Estimate reading time based on word count
function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / 200); // ~200 words per minute
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Map category to display name
const categoryLabels: Record<string, string> = {
  'deal-trends': 'Deal Trends',
  'modality-insights': 'Modality Insights',
  'educational': 'Educational',
  'industry-analysis': 'Industry Analysis',
};

// Map modality to display name
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

export default function BlogCard({ post }: BlogCardProps) {
  const readingTime = estimateReadingTime(post.content);
  const publishDate = post.published_at ? formatDate(post.published_at) : null;

  return (
    <article className="group bg-white rounded-2xl border border-slate-200 hover:border-teal-300 transition-all duration-300 hover:shadow-lg hover:shadow-teal-100/50 overflow-hidden">
      {/* Featured Image */}
      {post.featured_image_url && (
        <Link href={`/blog/${post.slug}`}>
          <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-50 relative overflow-hidden">
            <Image
              src={post.featured_image_url}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        </Link>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Category & Modality Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {post.category && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
              {categoryLabels[post.category] || post.category}
            </span>
          )}
          {post.modality && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
              {modalityLabels[post.modality] || post.modality}
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={`/blog/${post.slug}`}>
          <h2 className="text-xl font-semibold text-slate-900 mb-2 group-hover:text-teal-600 transition-colors line-clamp-2">
            {post.title}
          </h2>
        </Link>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-slate-600 text-sm mb-4 line-clamp-3">
            {post.excerpt}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            {publishDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {publishDate}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {readingTime} min read
            </span>
          </div>

          <Link
            href={`/blog/${post.slug}`}
            className="flex items-center gap-1 text-teal-600 font-medium hover:text-teal-700 transition-colors"
          >
            Read more
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </article>
  );
}
