import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { DEAL_STATS } from '@/lib/config/constants';

export const runtime = 'edge';

// Brand colors
const COLORS = {
  bgDark: '#0c0e1f',
  bgMid: '#141732',
  teal: '#0EA5A5',
  tealBright: '#34c2c2',
  tealDim: '#0c8e8e',
  white: '#ffffff',
  slate: '#94a3b8',
  slateLight: '#cbd5e1',
  slateDark: '#475569',
  amber: '#f59e0b',
  cyan: '#06b6d4',
};

// Shared Solidus — Ambrosia Ventures branding block — uses the real logo wordmark
// The logo is fetched from production at render time so preview deployments
// share the same canonical asset.
function AmbrosiaBranding({ host }: { host: string }) {
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const logoUrl = `${protocol}://${host}/logo-white.png`;
  return (
    <div
      style={{
        position: 'absolute',
        top: '48px',
        left: '60px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt="Ambrosia Ventures"
        width={240}
        height={50}
        style={{ objectFit: 'contain' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '16px' }}>
        <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontSize: '18px', fontWeight: 500, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.02em' }}>Solidus</span>
      </div>
    </div>
  );
}

// Bottom accent bar
function AccentBar({ from = COLORS.tealBright, to = COLORS.tealDim }: { from?: string; to?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '6px',
        background: `linear-gradient(90deg, ${from}, ${to})`,
      }}
    />
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const subtitle = searchParams.get('subtitle');
  const type = searchParams.get('type') || 'default';
  const stat = searchParams.get('stat');

  // Resolve host so the logo image can be fetched from the right deployment
  const host = request.headers.get('host') || 'solidus.ambrosiaventures.co';

  // --- Insight type: bold stat + title (for LinkedIn sharing) ---
  if (type === 'insight' && stat) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: COLORS.bgDark,
            padding: '60px',
            position: 'relative',
          }}
        >
          {/* Ambient glow */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '800px',
              height: '800px',
              background: `radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 60%)`,
            }}
          />
          <AmbrosiaBranding host={host} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' }}>
            <div
              style={{
                fontSize: '96px',
                fontWeight: 900,
                color: COLORS.amber,
                lineHeight: 1,
                textAlign: 'center',
              }}
            >
              {stat}
            </div>
            <div
              style={{
                fontSize: '36px',
                fontWeight: 600,
                color: COLORS.white,
                textAlign: 'center',
                lineHeight: 1.3,
                maxWidth: '900px',
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: '22px', color: COLORS.slate, textAlign: 'center' }}>
                {subtitle}
              </div>
            )}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              color: COLORS.slateDark,
              fontSize: '18px',
            }}
          >
            solidus.ambrosiaventures.co
          </div>
          <AccentBar from={COLORS.amber} to={COLORS.teal} />
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // --- Dynamic template (when ?title= is provided) ---
  if (title) {
    const schemes = {
      default: { accent: COLORS.teal, highlight: COLORS.tealBright },
      blog: { accent: COLORS.cyan, highlight: '#22d3ee' },
      landing: { accent: COLORS.teal, highlight: COLORS.tealBright },
      insight: { accent: COLORS.amber, highlight: '#fbbf24' },
    };
    const scheme = schemes[type as keyof typeof schemes] || schemes.default;

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            backgroundColor: COLORS.bgDark,
            padding: '60px',
            position: 'relative',
          }}
        >
          {/* Ambient glow */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '600px',
              height: '600px',
              background: `radial-gradient(circle, ${scheme.accent}18 0%, transparent 70%)`,
            }}
          />
          <AmbrosiaBranding host={host} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
            <h1
              style={{
                fontSize: title.length > 50 ? '46px' : '56px',
                fontWeight: 800,
                color: COLORS.white,
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: '24px', color: COLORS.slate, margin: 0, lineHeight: 1.4 }}>
                {subtitle}
              </p>
            )}
          </div>
          <AccentBar from={scheme.highlight} to={scheme.accent} />
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // --- Default OG image (main site link preview) ---
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: COLORS.bgDark,
          backgroundImage: `radial-gradient(circle at 80% 15%, rgba(14,165,165,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 85%, rgba(14,165,165,0.04) 0%, transparent 40%)`,
          padding: '60px 60px 60px 80px',
          position: 'relative',
        }}
      >
        <AmbrosiaBranding host={host} />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
            marginTop: '60px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 500,
                color: COLORS.tealBright,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
                marginBottom: '12px',
              }}
            >
              Solidus
            </div>
            <div
              style={{
                fontSize: '58px',
                fontWeight: 800,
                color: COLORS.white,
                lineHeight: 1.1,
                letterSpacing: '-1px',
              }}
            >
              Life Sciences Deal
            </div>
            <div
              style={{
                fontSize: '58px',
                fontWeight: 800,
                color: COLORS.white,
                lineHeight: 1.1,
                letterSpacing: '-1px',
              }}
            >
              Intelligence
            </div>
          </div>

          <div
            style={{
              fontSize: '24px',
              color: COLORS.slate,
              lineHeight: 1.5,
              maxWidth: '700px',
            }}
          >
            Benchmarks, deal structures, and valuation engines across {DEAL_STATS.TOTAL_DEALS} verified biopharma transactions
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '32px',
              marginTop: '4px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.tealBright }}>
                {DEAL_STATS.TOTAL_DEALS}
              </div>
              <div style={{ fontSize: '14px', color: COLORS.slateDark, letterSpacing: '0.04em' }}>
                Verified Deals
              </div>
            </div>
            <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.tealBright }}>
                21
              </div>
              <div style={{ fontSize: '14px', color: COLORS.slateDark, letterSpacing: '0.04em' }}>
                Engines
              </div>
            </div>
            <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.tealBright }}>
                12
              </div>
              <div style={{ fontSize: '14px', color: COLORS.slateDark, letterSpacing: '0.04em' }}>
                Therapeutic Areas
              </div>
            </div>
            <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.tealBright }}>
                23+
              </div>
              <div style={{ fontSize: '14px', color: COLORS.slateDark, letterSpacing: '0.04em' }}>
                Modalities
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '60px',
            fontSize: '18px',
            color: COLORS.slateDark,
          }}
        >
          solidus.ambrosiaventures.co
        </div>

        <AccentBar />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
