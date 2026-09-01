'use client';

interface AdvisoryCTAProps {
  therapeuticArea?: string;
  indication?: string;
  userTier?: string;
}

export function AdvisoryCTA({ therapeuticArea, indication, userTier }: AdvisoryCTAProps) {
  // Don't show to portfolio-tier users — they already have a relationship
  if (userTier === 'portfolio') return null;

  const subject = encodeURIComponent(
    `Advisory Inquiry — ${indication || therapeuticArea || 'Deal Structuring'}`
  );

  return (
    <div
      style={{
        marginTop: '24px',
        padding: '20px 24px',
        background: 'rgba(20, 184, 166, 0.04)',
        border: '1px solid rgba(20, 184, 166, 0.12)',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary, #F1F5F9)',
            marginBottom: '4px',
          }}
        >
          Need this analysis for a live transaction?
        </div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary, #94A3B8)',
            lineHeight: 1.5,
          }}
        >
          Our advisory team structures licensing, M&A, and partnering deals for clinical-stage biotechs.
        </div>
      </div>
      <a
        href={`mailto:ikildani@ambrosiaventures.co?subject=${subject}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 20px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#14B8A6',
          background: 'rgba(20, 184, 166, 0.08)',
          border: '1px solid rgba(20, 184, 166, 0.2)',
          borderRadius: '6px',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          transition: 'background 0.15s',
        }}
        onMouseOver={(e) => {
          (e.target as HTMLElement).style.background = 'rgba(20, 184, 166, 0.15)';
        }}
        onMouseOut={(e) => {
          (e.target as HTMLElement).style.background = 'rgba(20, 184, 166, 0.08)';
        }}
      >
        Talk to us →
      </a>
    </div>
  );
}
