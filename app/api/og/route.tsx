import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
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
            width="80"
            height="80"
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
              background: 'linear-gradient(90deg, #14b8a6 0%, #06b6d4 100%)',
              backgroundClip: 'text',
              color: 'transparent',
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
