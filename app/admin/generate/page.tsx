'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileText, Layout, Loader2, CheckCircle } from 'lucide-react';

// Modality options from calculations.ts
const modalityOptions = [
  { value: 'smallMolecule', label: 'Small Molecule' },
  { value: 'mab', label: 'Monoclonal Antibody' },
  { value: 'adc', label: 'ADC' },
  { value: 'bispecific', label: 'Bispecific Antibody' },
  { value: 'tCellEngager', label: 'T-cell Engager' },
  { value: 'carT_heme', label: 'CAR-T (Hematologic)' },
  { value: 'carT_solid', label: 'CAR-T (Solid Tumor)' },
  { value: 'cellTherapy', label: 'Cell Therapy' },
  { value: 'geneTherapy', label: 'Gene Therapy' },
  { value: 'radiopharmaceutical', label: 'Radiopharmaceutical' },
  { value: 'mrna', label: 'mRNA' },
  { value: 'rnai', label: 'RNAi' },
  { value: 'protac', label: 'PROTAC' },
  { value: 'molecularGlue', label: 'Molecular Glue' },
  { value: 'peptide', label: 'Peptide' },
  { value: 'therapeuticVaccine', label: 'Therapeutic Vaccine' },
  { value: 'oncolyticVirus', label: 'Oncolytic Virus' },
];

const categoryOptions = [
  { value: 'deal-trends', label: 'Deal Trends' },
  { value: 'modality-insights', label: 'Modality Insights' },
  { value: 'educational', label: 'Educational' },
  { value: 'industry-analysis', label: 'Industry Analysis' },
];

type ContentType = 'blog_post' | 'landing_page';

interface GenerationResult {
  post_id?: string;
  page_id?: string;
  content: {
    title: string;
    meta_description: string;
    slug: string;
  };
}

export default function GeneratePage() {
  const router = useRouter();
  const [contentType, setContentType] = useState<ContentType>('blog_post');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [modality, setModality] = useState('');
  const [category, setCategory] = useState('modality-insights');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!targetKeyword.trim()) {
      setError('Please enter a target keyword');
      return;
    }

    setGenerating(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_type: contentType,
          target_keyword: targetKeyword,
          parameters: {
            modality: modality || undefined,
            category: contentType === 'blog_post' ? category : undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const suggestedKeywords = [
    'ADC licensing deal trends 2025',
    'radiopharmaceutical licensing valuation',
    'bispecific antibody deal structure',
    'CAR-T solid tumor licensing terms',
    'oncology milestone payments explained',
    'biotech royalty rates benchmarks',
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Generate Content</h1>
        <p className="text-slate-600">
          Use AI to create SEO-optimized content for your site
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Generation Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Content Settings
          </h2>

          {/* Content Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Content Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setContentType('blog_post')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  contentType === 'blog_post'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileText
                  className={`w-5 h-5 ${
                    contentType === 'blog_post' ? 'text-teal-600' : 'text-slate-400'
                  }`}
                />
                <div className="text-left">
                  <p className="font-medium text-slate-900">Blog Post</p>
                  <p className="text-xs text-slate-500">Long-form content</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setContentType('landing_page')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  contentType === 'landing_page'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Layout
                  className={`w-5 h-5 ${
                    contentType === 'landing_page' ? 'text-teal-600' : 'text-slate-400'
                  }`}
                />
                <div className="text-left">
                  <p className="font-medium text-slate-900">Landing Page</p>
                  <p className="text-xs text-slate-500">Conversion-focused</p>
                </div>
              </button>
            </div>
          </div>

          {/* Target Keyword */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Target Keyword / Topic
            </label>
            <input
              type="text"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g., ADC licensing deal trends 2025"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestedKeywords.slice(0, 3).map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => setTargetKeyword(keyword)}
                  className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>

          {/* Modality */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Modality Focus (Optional)
            </label>
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">All Modalities</option>
              {modalityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category (Blog only) */}
          {contentType === 'blog_post' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !targetKeyword.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Content
              </>
            )}
          </button>
        </div>

        {/* Result Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Generated Content
          </h2>

          {!result && !generating && (
            <div className="text-center py-12 text-slate-500">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Configure settings and click Generate to create content</p>
            </div>
          )}

          {generating && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-teal-500 animate-spin" />
              <p className="text-slate-600">Generating content with AI...</p>
              <p className="text-sm text-slate-400 mt-2">This may take 30-60 seconds</p>
            </div>
          )}

          {result && (
            <div>
              <div className="flex items-center gap-2 mb-4 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Content generated successfully!</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Title
                  </label>
                  <p className="text-slate-900 font-medium">{result.content.title}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Meta Description
                  </label>
                  <p className="text-slate-700 text-sm">{result.content.meta_description}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    URL Slug
                  </label>
                  <p className="text-slate-600 text-sm font-mono">
                    /{contentType === 'blog_post' ? 'blog/' : ''}{result.content.slug}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() =>
                    router.push(
                      `/admin/content/${result.post_id || result.page_id}`
                    )
                  }
                  className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                >
                  Edit Content
                </button>
                <button
                  onClick={() => {
                    setResult(null);
                    setTargetKeyword('');
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Generate Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
