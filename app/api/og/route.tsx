import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const subtitle = searchParams.get('subtitle');
  const type = searchParams.get('type') || 'default';

  // If custom title provided, use dynamic template
  if (title) {
    const colors = {
      default: { bg: '#0f172a', accent: '#14b8a6' },
      blog: { bg: '#1e293b', accent: '#06b6d4' },
      landing: { bg: '#0f172a', accent: '#14b8a6' },
    };
    const scheme = colors[type as keyof typeof colors] || colors.default;

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
            backgroundColor: scheme.bg,
            padding: '60px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '600px',
              height: '600px',
              background: `radial-gradient(circle, ${scheme.accent}20 0%, transparent 70%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '60px',
              left: '60px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: scheme.accent,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                color: 'white',
                fontWeight: 'bold',
              }}
            >
              A
            </div>
            <span style={{ color: 'white', fontSize: '24px', fontWeight: 600 }}>
              Ambrosia Ventures
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
            <h1
              style={{
                fontSize: title.length > 50 ? '48px' : '56px',
                fontWeight: 'bold',
                color: 'white',
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: '24px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                {subtitle}
              </p>
            )}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '8px',
              background: `linear-gradient(90deg, ${scheme.accent}, #06b6d4)`,
            }}
          />
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Default OG image (existing code)
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
          backgroundColor: '#1a1e42',
          backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(20, 184, 166, 0.15) 0%, transparent 50%)',
        }}
      >
        {/* Logo area with DNA/gear icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <svg
            width="120"
            height="120"
            viewBox="0 0 64 64"
            fill="none"
          >
            {/* DNA Helix */}
            <path
              d="M16 8C16 8 24 16 32 16C40 16 48 8 48 8"
              stroke="#14b8a6"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M16 20C16 20 24 28 32 28C40 28 48 20 48 20"
              stroke="#14b8a6"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M16 32C16 32 24 40 32 40C40 40 48 32 48 32"
              stroke="#06b6d4"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M16 8V32"
              stroke="#14b8a6"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M48 8V32"
              stroke="#06b6d4"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Gear */}
            <circle cx="40" cy="44" r="10" stroke="#64748b" strokeWidth="2.5" fill="none" />
            <circle cx="40" cy="44" r="4" fill="#64748b" />
            <path
              d="M40 32V36M40 52V56M28 44H32M48 44H52M32.3 36.3L35.1 39.1M44.9 48.9L47.7 51.7M47.7 36.3L44.9 39.1M35.1 48.9L32.3 51.7"
              stroke="#64748b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Arrow */}
            <path
              d="M24 48L20 44L24 40"
              stroke="#14b8a6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M20 44H30" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: 'white',
              textAlign: 'center',
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            Life Sciences
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: '#14b8a6',
              textAlign: 'center',
              lineHeight: 1.1,
              marginBottom: 32,
            }}
          >
            Deal Calculator
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          Data-driven estimates for oncology licensing deals
        </div>

        {/* Ambrosia Ventures branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 20,
              color: '#64748b',
            }}
          >
            Powered by
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: '#94a3b8',
            }}
          >
            Ambrosia Ventures
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
