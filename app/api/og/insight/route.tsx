/**
 * Insight card OG image — optimized for LinkedIn / Twitter sharing.
 *
 * Differs from /api/og?type=insight (stats-only) and /api/og/share/[token]
 * (share-page preview): this route renders a standalone bold card suitable
 * for LinkedIn post image asset. Query params:
 *
 *   /api/og/insight?
 *     headline=Phase+2+oncology+ADC
 *     primary=%242.1B+%E2%80%93+%243.4B     (primary fair value range)
 *     label=Fair+Total+Deal+Value
 *     secondary=75th+percentile+vs+28+comparable+deals
 *     attribution=Phase+2+%E2%80%A2+Breast+HER2+%E2%80%A2+ADC
 *
 * Ambrosia branding block + teal accent bar. Edge runtime.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

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
      <img src={logoUrl} alt="Ambrosia Ventures" width={260} height={54} style={{ objectFit: 'contain' }} />
    </div>
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const headline = searchParams.get('headline') || 'Biopharma Deal Intelligence';
  const primary = searchParams.get('primary') || '';
  const label = searchParams.get('label') || 'Fair Value';
  const secondary = searchParams.get('secondary') || '';
  const attribution = searchParams.get('attribution') || '';

  const host = request.headers.get('host') || 'solidus.ambrosiaventures.co';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: COLORS.bgDark,
          padding: '60px',
          position: 'relative',
          fontFamily: 'system-ui',
        }}
      >
        {/* Ambient teal glow top-right */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            right: '-200px',
            width: '700px',
            height: '700px',
            background: `radial-gradient(circle, rgba(14,165,165,0.18) 0%, transparent 60%)`,
          }}
        />
        {/* Ambient amber glow bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-200px',
            left: '-200px',
            width: '600px',
            height: '600px',
            background: `radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 60%)`,
          }}
        />

        <AmbrosiaBranding host={host} />

        {/* Card body — centered vertical stack */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: '160px',
            gap: '20px',
          }}
        >
          {/* Attribution (stage / TA / modality line) */}
          {attribution && (
            <div
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: COLORS.tealBright,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              {attribution}
            </div>
          )}

          {/* Headline */}
          <div
            style={{
              fontSize: '52px',
              fontWeight: 700,
              color: COLORS.white,
              lineHeight: 1.15,
              maxWidth: '1000px',
            }}
          >
            {headline}
          </div>

          {/* Primary number */}
          {primary && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '12px' }}>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  color: COLORS.slate,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: '104px',
                  fontWeight: 900,
                  color: COLORS.tealBright,
                  lineHeight: 1,
                  marginTop: '4px',
                }}
              >
                {primary}
              </div>
            </div>
          )}

          {/* Secondary context bullet */}
          {secondary && (
            <div
              style={{
                fontSize: '26px',
                fontWeight: 500,
                color: COLORS.slateLight,
                marginTop: '8px',
                maxWidth: '1050px',
                lineHeight: 1.3,
              }}
            >
              {secondary}
            </div>
          )}
        </div>

        {/* Footer — URL + tagline */}
        <div
          style={{
            position: 'absolute',
            bottom: '50px',
            left: '60px',
            right: '60px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '18px', color: COLORS.slateDark }}>
            solidus.ambrosiaventures.co
          </div>
          <div style={{ fontSize: '14px', color: COLORS.slateDark, letterSpacing: '0.05em' }}>
            Institutional biopharma deal intelligence
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: `linear-gradient(90deg, ${COLORS.tealBright}, ${COLORS.cyan}, ${COLORS.amber})`,
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
