'use client';

import { useState } from 'react';
import { FileBarChart, Download, Palette, Clock, Lock, ArrowUpRight, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isScalePlus } from '@/lib/portfolio/feature-gates';

export default function ReportsPage() {
  const { portfolioSubTier } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAccess = isScalePlus(portfolioSubTier);

  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/10 mb-6">
          <Lock className="w-8 h-8 text-teal-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">White-Label Reports</h1>
        <p className="text-slate-400 mb-6">
          Fund-branded report generation is available on the Scale and Enterprise tiers. Upgrade to generate deal reports with your fund&apos;s logo, colors, and disclaimer.
        </p>
        <a
          href="mailto:issa@ambrosiaventures.co?subject=Portfolio%20License%20Upgrade%20%E2%80%94%20Scale%20Tier"
          className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
        >
          Upgrade to Scale <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  const handleGenerateSample = async () => {
    setGenerating(true);
    setError(null);

    try {
      // Sample report data for white-label preview
      const sampleReportData = {
        result: {
          upfrontPayment: { min: 25_000_000, max: 75_000_000, median: 50_000_000, label: '$50M' },
          totalDealValue: { min: 200_000_000, max: 600_000_000, median: 400_000_000, label: '$400M' },
          milestones: { regulatory: '$80M', commercial: '$120M', development: '$100M' },
          royaltyRange: { min: 8, max: 15, median: 12 },
          labels: { indication: 'Sample Oncology Asset', modality: 'Small Molecule', phase: 'Phase 2' },
          confidence: 0.82,
          dealType: 'licensing',
        },
        inputs: {
          therapeuticArea: 'oncology',
          modality: 'small_molecule',
          phase: 'phase_2',
          indication: 'non_small_cell_lung_cancer',
          dealType: 'licensing',
        },
        sensitivityData: {
          parameters: [],
          baseValue: 400_000_000,
        },
        riskScore: 65,
        comparableDeals: [],
      };

      const res = await fetch('/api/portfolio/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData: sampleReportData }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Report generation failed (${res.status})`);
      }

      // Download the PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sample-white-label-report.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <FileBarChart className="w-6 h-6 text-teal-400" />
        White-Label Reports
      </h1>

      <p className="text-sm text-slate-400">
        Generate deal reports branded with your fund&apos;s logo, colors, and disclaimer. Reports are identical to standard Ambrosia reports but carry your branding.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-5 h-5 text-teal-400" />
            <h2 className="text-sm font-medium text-white">Brand Configuration</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Your branding is configured in Settings. Reports will automatically use your fund&apos;s logo, colors, and disclaimer text.
          </p>
          <a
            href="/portfolio/admin/settings"
            className="text-sm text-teal-400 hover:text-teal-300 font-medium"
          >
            Configure Branding &rarr;
          </a>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-medium text-white">Quarterly Portfolio Report</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Comprehensive quarterly benchmarking report covering your portfolio companies&apos; deal landscape, comps, and market positioning.
          </p>
          <span className="text-xs text-slate-500 italic">
            Assembled by your Ambrosia analyst — delivered quarterly
          </span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-teal-400" />
          Generate On-Demand Report
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Run a benchmark in the calculator, then generate a white-label PDF with your fund branding applied. The report includes all Pro-tier sections with your logo and disclaimer.
        </p>
        <button
          onClick={handleGenerateSample}
          disabled={generating}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          {generating ? 'Generating...' : 'Generate Sample Report'}
        </button>
        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-8 text-center">
        <p className="text-sm text-slate-500">
          Report generation history will appear here once you generate your first white-label report.
        </p>
      </div>
    </div>
  );
}
