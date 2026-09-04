'use client';

interface DDProps {
  asset: Record<string, unknown>;
  signals: Record<string, unknown>[];
  competitors: { name: string; type: string; intensity: number }[];
  thesis: Record<string, unknown> | null;
  trials: Record<string, unknown>[];
}

interface DDItem {
  label: string;
  status: 'strong' | 'adequate' | 'weak' | 'unknown';
  detail: string;
}

interface DDCategory {
  title: string;
  icon: string;
  items: DDItem[];
}

function assessClinical(asset: Record<string, unknown>, trials: Record<string, unknown>[]): DDItem[] {
  const items: DDItem[] = [];
  const trialCount = Number(asset.trial_count || 0);
  const enrollment = Number(asset.enrollment_total || 0);
  const phase = String(asset.phase || '');
  const status = String(asset.trial_status || '');

  items.push({
    label: 'Development Stage',
    status: ['phase3', 'phase_3', 'phase2_phase3', 'phase_2_3', 'approved'].some(p => phase.toLowerCase().includes(p.replace('_', ''))) ? 'strong' : phase.includes('2') ? 'adequate' : 'weak',
    detail: phase ? formatLabel(phase) : 'Unknown phase',
  });

  items.push({
    label: 'Clinical Program Breadth',
    status: trialCount >= 5 ? 'strong' : trialCount >= 2 ? 'adequate' : 'weak',
    detail: `${trialCount} clinical trial${trialCount !== 1 ? 's' : ''} across indications`,
  });

  items.push({
    label: 'Enrollment Scale',
    status: enrollment >= 500 ? 'strong' : enrollment >= 100 ? 'adequate' : enrollment > 0 ? 'weak' : 'unknown',
    detail: enrollment > 0 ? `${enrollment.toLocaleString()} total enrolled patients` : 'No enrollment data',
  });

  items.push({
    label: 'Trial Activity',
    status: status === 'active' ? 'strong' : status === 'completed' ? 'adequate' : 'weak',
    detail: status === 'active' ? 'Actively recruiting or running' : status === 'completed' ? 'Completed — awaiting results or next steps' : 'Inactive or unknown status',
  });

  const hasCollaboration = trials.some(t => t.is_collaboration);
  items.push({
    label: 'Collaborative Validation',
    status: hasCollaboration ? 'strong' : 'unknown',
    detail: hasCollaboration ? 'Has collaborative trial(s) — external validation' : 'No collaborative trials detected',
  });

  return items;
}

function assessRegulatory(asset: Record<string, unknown>): DDItem[] {
  const items: DDItem[] = [];
  const designations = (asset.regulatory_designations as string[]) || [];

  items.push({
    label: 'Regulatory Designations',
    status: designations.length >= 2 ? 'strong' : designations.length === 1 ? 'adequate' : 'unknown',
    detail: designations.length > 0 ? designations.join(', ') : 'No special designations on record',
  });

  const phase = String(asset.phase || '').toLowerCase();
  items.push({
    label: 'Regulatory Path Clarity',
    status: phase.includes('3') || phase.includes('approved') ? 'strong' : phase.includes('2') ? 'adequate' : 'weak',
    detail: phase.includes('3') ? 'Late-stage — clear regulatory pathway' : phase.includes('2') ? 'Mid-stage — regulatory pathway forming' : 'Early-stage — regulatory path uncertain',
  });

  return items;
}

function assessCompetitive(asset: Record<string, unknown>, competitors: DDProps['competitors']): DDItem[] {
  const items: DDItem[] = [];
  const heat = Number(asset.competitive_heat || 0);

  items.push({
    label: 'Competitive Intensity',
    status: heat < 30 ? 'strong' : heat < 60 ? 'adequate' : 'weak',
    detail: heat >= 60 ? `High heat (${heat}/100) — crowded landscape, differentiation critical` : heat >= 30 ? `Moderate heat (${heat}/100) — competitive but manageable` : `Low heat (${heat}/100) — relatively open field`,
  });

  const uniqueCompetitors = new Set(competitors.map(c => c.name)).size;
  items.push({
    label: 'Named Competitors',
    status: uniqueCompetitors <= 3 ? 'strong' : uniqueCompetitors <= 8 ? 'adequate' : 'weak',
    detail: uniqueCompetitors > 0 ? `${uniqueCompetitors} identified competitor${uniqueCompetitors !== 1 ? 's' : ''} in this space` : 'No named competitors detected',
  });

  const dealCompetitors = competitors.filter(c => c.type === 'competitor_deal');
  items.push({
    label: 'Recent Competitor Deals',
    status: dealCompetitors.length === 0 ? 'strong' : dealCompetitors.length <= 3 ? 'adequate' : 'weak',
    detail: dealCompetitors.length > 0 ? `${dealCompetitors.length} competitor deal(s) in last 6 months — market is active` : 'No recent competitor deals — less urgency pressure',
  });

  return items;
}

function assessCommercial(asset: Record<string, unknown>, thesis: Record<string, unknown> | null): DDItem[] {
  const items: DDItem[] = [];
  const readiness = Number(asset.deal_readiness_score || 0);
  const partnership = String(asset.partnership_status || '');

  items.push({
    label: 'Deal Readiness',
    status: readiness >= 60 ? 'strong' : readiness >= 35 ? 'adequate' : 'weak',
    detail: `${readiness}/100 — ${readiness >= 60 ? 'high readiness, near-term actionable' : readiness >= 35 ? 'moderate readiness, building toward deal' : 'early readiness, needs development'}`,
  });

  items.push({
    label: 'Availability',
    status: partnership === 'unpartnered' ? 'strong' : partnership === 'partially_partnered' ? 'adequate' : 'weak',
    detail: partnership === 'unpartnered' ? 'Fully available — no existing partnerships' : partnership === 'partially_partnered' ? 'Partially available — some territories or rights committed' : 'Partnered — limited or no availability',
  });

  if (thesis) {
    const upfront = Number(thesis.predicted_upfront_mid || 0);
    const comps = Number(thesis.comp_count || 0);
    items.push({
      label: 'Deal Economics Basis',
      status: comps >= 10 ? 'strong' : comps >= 3 ? 'adequate' : comps > 0 ? 'weak' : 'unknown',
      detail: comps > 0 ? `${comps} comparable transactions — predicted upfront $${upfront}M` : 'Insufficient comps for deal economics',
    });
  } else {
    items.push({
      label: 'Deal Economics Basis',
      status: 'unknown',
      detail: 'No comparable transactions matched — economics unpredictable',
    });
  }

  return items;
}

function assessDataQuality(asset: Record<string, unknown>): DDItem[] {
  const confidence = Number(asset.confidence_score || 0);
  const sources = (asset.data_sources as string[]) || [];
  const nctCount = ((asset.nct_ids as string[]) || []).length;

  return [
    {
      label: 'Data Confidence',
      status: confidence >= 70 ? 'strong' : confidence >= 40 ? 'adequate' : 'weak',
      detail: `${confidence}/100 — ${confidence >= 70 ? 'high confidence, multiple data points' : confidence >= 40 ? 'moderate, core data available' : 'low, limited data points'}`,
    },
    {
      label: 'Source Coverage',
      status: sources.length >= 3 ? 'strong' : sources.length >= 1 ? 'adequate' : 'unknown',
      detail: sources.length > 0 ? `Sources: ${sources.join(', ')}` : 'Source data not tracked',
    },
    {
      label: 'Trial Registry Coverage',
      status: nctCount >= 3 ? 'strong' : nctCount >= 1 ? 'adequate' : 'weak',
      detail: `${nctCount} NCT ID${nctCount !== 1 ? 's' : ''} linked`,
    },
  ];
}

function formatLabel(raw: string): string {
  const LABELS: Record<string, string> = {
    phase_1: 'Phase 1', phase_2: 'Phase 2', phase_3: 'Phase 3', phase_4: 'Phase 4',
    phase1: 'Phase 1', phase2: 'Phase 2', phase3: 'Phase 3', phase4: 'Phase 4',
    early_phase1: 'Early Phase 1', phase_1_2: 'Phase 1/2', phase_2_3: 'Phase 2/3',
  };
  return LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const STATUS_CONFIG = {
  strong:  { label: 'Strong',   dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/10' },
  adequate:{ label: 'Adequate', dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/10' },
  weak:    { label: 'Weak',     dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/10' },
  unknown: { label: 'Unknown',  dot: 'bg-slate-400',   text: 'text-slate-500 dark:text-slate-400',     bg: 'bg-slate-50 dark:bg-slate-800/50' },
};

export function DueDiligencePanel({ asset, signals, competitors, thesis, trials }: DDProps) {
  const categories: DDCategory[] = [
    { title: 'Clinical Evidence', icon: '🔬', items: assessClinical(asset, trials) },
    { title: 'Regulatory Status', icon: '📋', items: assessRegulatory(asset) },
    { title: 'Competitive Landscape', icon: '🏟️', items: assessCompetitive(asset, competitors) },
    { title: 'Commercial Potential', icon: '💰', items: assessCommercial(asset, thesis) },
    { title: 'Data Quality', icon: '📊', items: assessDataQuality(asset) },
  ];

  const allItems = categories.flatMap(c => c.items);
  const strong = allItems.filter(i => i.status === 'strong').length;
  const adequate = allItems.filter(i => i.status === 'adequate').length;
  const weak = allItems.filter(i => i.status === 'weak').length;
  const unknown = allItems.filter(i => i.status === 'unknown').length;

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-slate-100 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/30">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Due Diligence Summary</span>
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />{strong} Strong
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" />{adequate} Adequate
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-500" />{weak} Weak
          </span>
          {unknown > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-400" />{unknown} Unknown
            </span>
          )}
        </div>
      </div>

      {/* Categories */}
      {categories.map(cat => (
        <div key={cat.title} className="rounded-xl border border-slate-100 dark:border-slate-700/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-700/30">
            <span className="text-sm">{cat.icon}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{cat.title}</span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
            {cat.items.map((item, i) => {
              const cfg = STATUS_CONFIG[item.status];
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
