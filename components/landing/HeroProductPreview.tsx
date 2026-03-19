import React from 'react';

const HeroProductPreview = React.memo(function HeroProductPreview() {
  return (
    <div className="hidden lg:block relative" aria-hidden="true">
      {/* Ambient glow */}
      <div className="absolute -inset-8 rounded-3xl blur-3xl"
        style={{ background: 'radial-gradient(ellipse at 40% 30%, rgba(0,201,167,0.12), transparent 65%)' }}
      />

      <div className="relative">
        <div className="w-[420px] xl:w-[460px] rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #0e1a2e 0%, #0a1220 100%)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(100,116,139,0.1), 0 0 60px rgba(0,201,167,0.04)',
          }}
        >
          <div className="p-7 space-y-6">
            {/* Status bar */}
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Analysis Complete
              </span>
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-md" style={{ color: '#94a3b8', background: 'rgba(100,116,139,0.1)' }}>Phase 2</span>
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-md" style={{ color: '#94a3b8', background: 'rgba(100,116,139,0.1)' }}>Oncology · ADC</span>
            </div>

            {/* Primary metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-5" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(100,116,139,0.06)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: '#64748b' }}>Upfront Payment</div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '28px', fontWeight: 700, color: '#e2e8f0', lineHeight: 1, letterSpacing: '-0.02em' }}>$85M</div>
                <div className="mt-3 h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(100,116,139,0.1)' }}>
                  <div className="h-full rounded-full" style={{ width: '35%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                </div>
                <div className="text-[10px] mt-2.5" style={{ color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>$47M — $612M range</div>
              </div>
              <div className="rounded-xl p-5" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(0,201,167,0.08)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: '#64748b' }}>Total Deal Value</div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '28px', fontWeight: 700, color: '#00c9a7', lineHeight: 1, letterSpacing: '-0.02em' }}>$450M</div>
                <div className="mt-3 h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(100,116,139,0.1)' }}>
                  <div className="h-full rounded-full" style={{ width: '55%', background: 'linear-gradient(90deg, #00c9a7, #00e4bf)' }} />
                </div>
                <div className="text-[10px] mt-2.5" style={{ color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>$280M — $1.2B range</div>
              </div>
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Milestones', value: '$120M', color: '#e2e8f0' },
                { label: 'Royalties', value: '8–12%', color: '#e2e8f0' },
                { label: 'rNPV', value: '$312M', color: '#60a5fa' },
              ].map(m => (
                <div key={m.label} className="text-center rounded-lg py-3.5 px-2" style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(100,116,139,0.05)' }}>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#64748b' }}>{m.label}</div>
                  <div className="mt-1.5" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '16px', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Deal structure */}
            <div className="rounded-lg px-5 py-4" style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(100,116,139,0.05)' }}>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#64748b' }}>Deal Structure</span>
                <span className="text-[10px]" style={{ color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>25% Upfront / 75% Milestones</span>
              </div>
              <div className="h-[7px] rounded-full overflow-hidden flex gap-[2px]" style={{ background: 'rgba(100,116,139,0.06)' }}>
                <div className="h-full rounded-l-full" style={{ width: '25%', background: '#00c9a7' }} />
                <div className="h-full rounded-r-full" style={{ width: '75%', background: '#3b82f6' }} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px]" style={{ color: '#475569' }}>Based on 47 comparable ADC deals</span>
              <span className="text-[10px] font-semibold" style={{ color: '#00c9a7' }}>View comps →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default HeroProductPreview;
