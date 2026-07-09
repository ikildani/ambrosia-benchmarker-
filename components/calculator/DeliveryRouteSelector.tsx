'use client';

import { useMemo } from 'react';
import {
  deliveryRouteOptionsByTA,
  getRouteProfile,
  getDefaultRouteForModality,
  type DeliveryRoute,
} from '@/lib/financial/delivery-routes';

interface DeliveryRouteSelectorProps {
  therapeuticArea: string;
  modality: string;
  value: DeliveryRoute | '';
  onChange: (route: string) => void;
}

function impactBadge(mod: number): { label: string; color: string } | null {
  if (mod > 1.15) return { label: `+${((mod - 1) * 100).toFixed(0)}% peak`, color: 'teal' };
  if (mod > 1.05) return { label: `+${((mod - 1) * 100).toFixed(0)}% peak`, color: 'teal' };
  if (mod < 0.85) return { label: `${((mod - 1) * 100).toFixed(0)}% peak`, color: 'rose' };
  if (mod < 0.95) return { label: `${((mod - 1) * 100).toFixed(0)}% peak`, color: 'amber' };
  return null;
}

export function DeliveryRouteSelector({
  therapeuticArea,
  modality,
  value,
  onChange,
}: DeliveryRouteSelectorProps) {
  const options = useMemo(
    () => deliveryRouteOptionsByTA[therapeuticArea] ?? [],
    [therapeuticArea],
  );

  const defaultRoute = getDefaultRouteForModality(modality);
  const activeValue = value || defaultRoute || 'iv';
  const activeProfile = getRouteProfile(activeValue as DeliveryRoute);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Delivery Route
        </label>
        {value === '' && defaultRoute && (
          <span className="text-[10px] text-slate-600">
            Auto: {getRouteProfile(defaultRoute).displayName}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {options.map(opt => {
          const profile = getRouteProfile(opt.value);
          const isActive = activeValue === opt.value;
          const isDefault = opt.value === defaultRoute && value === '';
          const badge = impactBadge(profile.peakSalesModifier);

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`
                relative rounded-lg border px-2.5 py-2 text-left transition-all text-xs
                ${isActive
                  ? 'border-teal-500/50 bg-teal-500/10 text-teal-300 ring-1 ring-teal-500/20'
                  : isDefault
                    ? 'border-slate-600/50 bg-slate-800/50 text-slate-300'
                    : 'border-slate-700/40 bg-slate-800/30 text-slate-500 hover:border-slate-600/50 hover:text-slate-400'
                }
              `}
            >
              <div className="font-medium leading-tight">{opt.label}</div>
              {badge && (
                <div className={`mt-1 text-[10px] font-semibold ${
                  badge.color === 'teal' ? 'text-teal-500' :
                  badge.color === 'amber' ? 'text-amber-500' :
                  'text-rose-500'
                }`}>
                  {badge.label}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Active route detail strip */}
      {activeProfile && activeProfile.slug !== 'iv' && (
        <div className="mt-2 flex items-center gap-3 rounded-lg bg-slate-800/30 px-3 py-2 text-[11px] text-slate-500">
          {activeProfile.posModifier !== 1.0 && (
            <span>
              PoS: <span className={activeProfile.posModifier >= 1.0 ? 'text-teal-400' : 'text-amber-400'}>
                {activeProfile.posModifier >= 1.0 ? '+' : ''}{((activeProfile.posModifier - 1) * 100).toFixed(0)}%
              </span>
            </span>
          )}
          {activeProfile.dealPremium !== 0 && (
            <span>
              Premium: <span className={activeProfile.dealPremium >= 0 ? 'text-teal-400' : 'text-amber-400'}>
                {activeProfile.dealPremium >= 0 ? '+' : ''}{(activeProfile.dealPremium * 100).toFixed(0)}%
              </span>
            </span>
          )}
          {activeProfile.timelineModifier > 0 && (
            <span>
              Timeline: <span className="text-amber-400">+{activeProfile.timelineModifier}mo</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
