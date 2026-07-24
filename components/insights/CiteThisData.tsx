'use client';

import { useState } from 'react';
import { DEAL_STATS } from '@/lib/config/constants';

interface CiteThisDataProps {
  title: string;
  pageUrl: string;
  embedType?: string;
  embedTA?: string;
}

export function CiteThisData({ title, pageUrl, embedType = 'phase-upfront', embedTA = 'oncology' }: CiteThisDataProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const fullUrl = pageUrl.startsWith('http') ? pageUrl : `https://solidus.ambrosiaventures.co${pageUrl}`;
  const embedUrl = `https://solidus.ambrosiaventures.co/api/embed/chart?type=${embedType}&ta=${embedTA}&theme=light`;

  const apaText = `Ambrosia Ventures. (2026). ${title}. Retrieved from ${fullUrl}`;
  const htmlText = `<a href="${fullUrl}">${title}</a> — Ambrosia Ventures (2026)`;
  const embedText = `<iframe src="${embedUrl}" width="600" height="400" frameborder="0" style="border:1px solid #e2e8f0;border-radius:12px;"></iframe>`;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const CopyButton = ({ text, label }: { text: string; label: string }) => (
    <button
      onClick={() => copy(text, label)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
    >
      {copied === label ? (
        <>
          <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy {label}
        </>
      )}
    </button>
  );

  return (
    <div className="my-10 border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-700">Cite This Data</h3>
        </div>
      </div>

      <div className="p-5 space-y-4 text-sm">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">APA</span>
            <CopyButton text={apaText} label="APA" />
          </div>
          <p className="text-slate-600 font-mono text-xs bg-slate-50 rounded-lg p-3 leading-relaxed">{apaText}</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">HTML</span>
            <CopyButton text={htmlText} label="HTML" />
          </div>
          <p className="text-slate-600 font-mono text-xs bg-slate-50 rounded-lg p-3 leading-relaxed break-all">{htmlText}</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Embed Chart</span>
            <CopyButton text={embedText} label="Embed" />
          </div>
          <p className="text-slate-600 font-mono text-xs bg-slate-50 rounded-lg p-3 leading-relaxed break-all">{embedText}</p>
        </div>
      </div>

      <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-200">
        <p className="text-xs text-slate-400">Data sourced from {DEAL_STATS.TOTAL_DEALS} verified biopharma transactions. Updated monthly.</p>
      </div>
    </div>
  );
}
