import React from 'react';

const HeroProductPreview = React.memo(function HeroProductPreview() {
  return (
    <div className="hidden lg:block relative" aria-hidden="true">
      {/* Ambient glow */}
      <div className="absolute -inset-8 bg-gradient-to-br from-teal-500/8 via-blue-500/5 to-purple-500/4 rounded-3xl blur-3xl" />

      <div
        className="relative"
        style={{ transform: 'perspective(1200px) rotateY(-4deg) rotateX(2deg)' }}
      >
        <div className="w-[400px] xl:w-[440px] rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0f172a, #1e293b)',
            border: '1px solid rgba(100,116,139,0.2)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(100,116,139,0.1)',
          }}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(100,116,139,0.15)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f87171' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#fbbf24' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#34d399' }} />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-medium"
                style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(100,116,139,0.15)', color: '#94a3b8' }}>
                <svg className="w-2.5 h-2.5" style={{ color: '#34d399' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                calculator.ambrosiaventures.co
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Status bar */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Analysis Complete
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>Phase 2</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>Oncology</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>ADC</span>
            </div>

            {/* Primary metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-4" style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(100,116,139,0.1)' }}>
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: '#475569' }}>Upfront Payment</div>
                <div className="text-2xl font-bold" style={{ color: '#f0f4f8', fontFamily: 'var(--font-mono, monospace)' }}>$85M</div>
                <div className="text-[9px] mt-1" style={{ color: '#475569' }}>$47M — $612M range</div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(0,201,167,0.15)' }}>
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: '#475569' }}>Total Deal Value</div>
                <div className="text-2xl font-bold" style={{ color: '#00c9a7', fontFamily: 'var(--font-mono, monospace)' }}>$450M</div>
                <div className="text-[9px] mt-1" style={{ color: '#475569' }}>$280M — $1.2B range</div>
              </div>
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center rounded-lg p-3" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(100,116,139,0.08)' }}>
                <div className="text-[8px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#475569' }}>Milestones</div>
                <div className="text-sm font-bold mt-1" style={{ color: '#f0f4f8', fontFamily: 'var(--font-mono, monospace)' }}>$120M</div>
              </div>
              <div className="text-center rounded-lg p-3" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(100,116,139,0.08)' }}>
                <div className="text-[8px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#475569' }}>Royalties</div>
                <div className="text-sm font-bold mt-1" style={{ color: '#f0f4f8', fontFamily: 'var(--font-mono, monospace)' }}>8–12%</div>
              </div>
              <div className="text-center rounded-lg p-3" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(100,116,139,0.08)' }}>
                <div className="text-[8px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#475569' }}>rNPV</div>
                <div className="text-sm font-bold mt-1" style={{ color: '#60a5fa', fontFamily: 'var(--font-mono, monospace)' }}>$312M</div>
              </div>
            </div>

            {/* Deal structure */}
            <div className="rounded-lg p-3" style={{ background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(100,116,139,0.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#475569' }}>Deal Structure</span>
                <span className="text-[9px] font-medium" style={{ color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>25% Upfront / 75% Milestones</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'rgba(100,116,139,0.1)' }}>
                <div className="h-full rounded-l-full" style={{ width: '25%', background: 'linear-gradient(90deg, #00c9a7, #00e4bf)' }} />
                <div className="h-full rounded-r-full" style={{ width: '75%', background: 'linear-gradient(90deg, #60a5fa, #9499d1)' }} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[9px]" style={{ color: '#334155' }}>Based on 47 comparable ADC deals</span>
              <span className="text-[9px] font-medium" style={{ color: '#5fd4e3' }}>View comps →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default HeroProductPreview;
