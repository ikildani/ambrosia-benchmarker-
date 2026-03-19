import React from 'react';

const HeroProductPreview = React.memo(function HeroProductPreview() {
  return (
    <div className="hidden lg:block relative" aria-hidden="true">
      {/* Ambient glow */}
      <div className="absolute -inset-6 rounded-3xl blur-3xl opacity-40"
        style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(0,201,167,0.08), transparent 60%)' }}
      />

      <div className="relative">
        <div className="w-[400px] xl:w-[440px] rounded-2xl overflow-hidden"
          style={{
            background: '#0c1525',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(100,116,139,0.08)',
          }}
        >
          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Status bar */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Analysis Complete
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ color: '#64748b', background: 'rgba(100,116,139,0.08)' }}>Phase 2</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ color: '#64748b', background: 'rgba(100,116,139,0.08)' }}>Oncology · ADC</span>
            </div>

            {/* Primary metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-4" style={{ background: 'rgba(15,23,42,0.6)' }}>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] mb-2.5" style={{ color: '#475569' }}>Upfront Payment</div>
                <div style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '26px', fontWeight: 700, color: '#f0f4f8', lineHeight: 1 }}>$85M</div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(100,116,139,0.08)' }}>
                  <div className="h-full rounded-full" style={{ width: '35%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                </div>
                <div className="text-[9px] mt-2" style={{ color: '#334155' }}>$47M — $612M range</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(15,23,42,0.6)' }}>
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] mb-2.5" style={{ color: '#475569' }}>Total Deal Value</div>
                <div style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '26px', fontWeight: 700, color: '#00c9a7', lineHeight: 1 }}>$450M</div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(100,116,139,0.08)' }}>
                  <div className="h-full rounded-full" style={{ width: '55%', background: 'linear-gradient(90deg, #00c9a7, #00e4bf)' }} />
                </div>
                <div className="text-[9px] mt-2" style={{ color: '#334155' }}>$280M — $1.2B range</div>
              </div>
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Milestones', value: '$120M', color: '#f0f4f8' },
                { label: 'Royalties', value: '8–12%', color: '#f0f4f8' },
                { label: 'rNPV', value: '$312M', color: '#60a5fa' },
              ].map(m => (
                <div key={m.label} className="text-center rounded-lg py-3" style={{ background: 'rgba(15,23,42,0.5)' }}>
                  <div className="text-[8px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#334155' }}>{m.label}</div>
                  <div className="mt-1" style={{ fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '15px', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Deal structure */}
            <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(15,23,42,0.5)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#334155' }}>Deal Structure</span>
                <span className="text-[9px]" style={{ color: '#475569', fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>25% Upfront / 75% Milestones</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(100,116,139,0.06)' }}>
                <div className="h-full rounded-l-full" style={{ width: '25%', background: '#00c9a7' }} />
                <div className="h-full rounded-r-full" style={{ width: '75%', background: '#3b82f6' }} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <span className="text-[9px]" style={{ color: '#1e293b' }}>Based on 47 comparable ADC deals</span>
              <span className="text-[9px] font-medium" style={{ color: '#00c9a7' }}>View comps →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default HeroProductPreview;
