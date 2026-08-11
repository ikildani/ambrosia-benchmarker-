/**
 * DealStructureBadge — surfaces the engine's deal-structure classification
 * on the calculator results page.
 *
 * For every prediction, the engine routes the deal to one of six pricing
 * regimes (classic_license, option_style, platform_collab, regional_license,
 * biosimilar_license, strategic_acquisition). This badge tells the BD user
 * which regime was picked, how confident the engine is, and WHY
 * (human-readable signals) — so they can explain the number to a
 * counterparty and override the routing if their domain knowledge says
 * the classifier got it wrong.
 *
 * Design note: treats the classification as a prominent part of the
 * results header, not a buried debug field. The regime materially
 * changes the predicted upfront (~5% vs ~22% of NPV), so users deserve
 * a clear explanation.
 */

import type { RNPVResult } from '@/lib/financial/types';

interface Props {
  classification: NonNullable<RNPVResult['dealStructureClassification']>;
}

type StructureStyle = {
  label: string;
  description: string;
  tone: 'teal' | 'cyan' | 'indigo' | 'purple' | 'slate' | 'amber';
};

const STRUCTURE_STYLES: Record<
  NonNullable<RNPVResult['dealStructureClassification']>['structure'],
  StructureStyle
> = {
  classic_license: {
    label: 'Classic License',
    description: 'DCF-anchored upfront, 15-30% of total deal value.',
    tone: 'teal',
  },
  option_style: {
    label: 'Option-Style',
    description: 'Small upfront (~5-10%) + milestone-heavy back-end. Buyer pays for strategic optionality rather than intrinsic NPV.',
    tone: 'cyan',
  },
  platform_collab: {
    label: 'Platform Collaboration',
    description: 'Research funding + FTE + milestones. Mid-range upfront (~15-22%) with heavier back-loading than classic licensing.',
    tone: 'indigo',
  },
  regional_license: {
    label: 'Regional License',
    description: 'Territorial rights package. Upfront scales with territory revenue share, not global NPV.',
    tone: 'purple',
  },
  biosimilar_license: {
    label: 'Biosimilar License',
    description: 'Prices at ~20-40% of branded-drug economics due to commoditized competitive dynamics.',
    tone: 'slate',
  },
  strategic_acquisition: {
    label: 'Strategic Acquisition',
    description: 'Bidding-war premium 2-5× intrinsic NPV. Most value paid upfront (70-95%).',
    tone: 'amber',
  },
  reformulation_license: {
    label: 'Reformulation / 505(b)(2)',
    description: 'Abbreviated development pathway. Higher upfront % (20-45%) reflecting lower risk and established safety profile.',
    tone: 'teal',
  },
};

const TONE_CLASSES: Record<StructureStyle['tone'], string> = {
  teal: 'bg-teal-500/10 text-teal-300 border-teal-500/40',
  cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40',
  indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/40',
  purple: 'bg-purple-500/10 text-purple-300 border-purple-500/40',
  slate: 'bg-slate-500/10 text-slate-300 border-slate-500/40',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
};

function confidenceLabel(c: number): { text: string; tone: 'high' | 'medium' | 'low' } {
  if (c >= 0.9) return { text: 'High confidence', tone: 'high' };
  if (c >= 0.75) return { text: 'Medium confidence', tone: 'medium' };
  return { text: 'Low confidence (blended with classic license)', tone: 'low' };
}

export function DealStructureBadge({ classification }: Props) {
  const style = STRUCTURE_STYLES[classification.structure];
  const conf = confidenceLabel(classification.confidence);
  const confDot =
    conf.tone === 'high'
      ? 'bg-teal-400'
      : conf.tone === 'medium'
        ? 'bg-amber-400'
        : 'bg-slate-500';

  return (
    <div
      className={`rounded-lg border p-4 ${TONE_CLASSES[style.tone]} bg-opacity-100 dark:bg-opacity-10`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Deal Structure
            </span>
            <span className="text-base font-semibold">{style.label}</span>
          </div>
          <p className="mt-1 max-w-2xl text-xs opacity-80">{style.description}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${confDot}`} />
          <span className="opacity-80">
            {conf.text} ({(classification.confidence * 100).toFixed(0)}%)
          </span>
        </div>
      </div>

      {classification.signals.length > 0 && (
        <div className="mt-3 border-t border-current/20 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
            Why this structure
          </div>
          <ul className="mt-1 space-y-0.5">
            {classification.signals.map((signal, i) => (
              <li key={i} className="text-xs opacity-80">
                • {signal}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
