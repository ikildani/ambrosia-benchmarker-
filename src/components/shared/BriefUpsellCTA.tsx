'use client';

interface BriefUpsellCTAProps {
  therapeuticArea?: string;
  indication?: string;
  userTier?: string;
}

export function BriefUpsellCTA({ therapeuticArea, indication, userTier }: BriefUpsellCTAProps) {
  // Only show to Pro/Report users (free users see Pro nudge, portfolio users have a relationship)
  if (!userTier || userTier === 'free' || userTier === 'portfolio') return null;

  const label = indication || therapeuticArea || 'your indication';
  const taParam = encodeURIComponent(therapeuticArea || '');

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '16px 20px',
        background: 'rgba(139, 92, 246, 0.04)',
        border: '1px solid rgba(139, 92, 246, 0.12)',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9', marginBottom: '2px' }}>
          Want every deal structure for {label}?
        </div>
        <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: '1.5' }}>
          Our Deal Intelligence Brief covers 52 calculations across 13 modalities, with AI negotiation playbook and partner matching. $2,500, delivered in 24 hours.
        </div>
      </div>
      <a
        href={`/benchmark${taParam ? `?ta=${taParam}` : ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#A78BFA',
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '4px',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Learn more →
      </a>
    </div>
  );
}
