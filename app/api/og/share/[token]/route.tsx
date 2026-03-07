import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

// Currency formatter matching lib/calculations.ts
function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}B`;
  }
  return `$${value}M`;
}

// Derive risk level from deal recommendation rationale
function getRiskLevel(rationale: string): { label: string; color: string } {
  if (rationale.includes('De-risked') || rationale.includes('de-risked')) {
    return { label: 'Low Risk', color: '#14b8a6' }; // teal-500
  }
  if (rationale.includes('moderate risk') || rationale.includes('Moderate')) {
    return { label: 'Moderate Risk', color: '#f59e0b' }; // amber-500
  }
  if (rationale.includes('High-risk') || rationale.includes('high-risk')) {
    return { label: 'High Risk', color: '#ef4444' }; // red-500
  }
  if (rationale.includes('uncertainty') || rationale.includes('Earlier-stage')) {
    return { label: 'Elevated Risk', color: '#f97316' }; // orange-500
  }
  return { label: 'Assessed', color: '#14b8a6' };
}

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function renderFallbackImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1e42',
          padding: '60px',
        }}
      >
        {/* Teal accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'linear-gradient(to right, #14b8a6, #06b6d4)',
            display: 'flex',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          <div
            style={{
              fontSize: '42px',
              fontWeight: 700,
              color: '#ffffff',
              display: 'flex',
            }}
          >
            Ambrosia Ventures
          </div>
          <div
            style={{
              fontSize: '24px',
              color: '#14b8a6',
              fontWeight: 600,
              display: 'flex',
            }}
          >
            Biotech Deal Calculator
          </div>
          <div
            style={{
              fontSize: '20px',
              color: '#a3a3a3',
              marginTop: '16px',
              display: 'flex',
            }}
          >
            Shared Deal Analysis
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return renderFallbackImage();
    }

    const supabase = createSupabaseClient();

    // Fetch shared calculation (same query pattern as app/api/share/[token]/route.ts)
    const { data: shared, error } = await supabase
      .from('shared_calculations')
      .select('results, labels, inputs, expires_at')
      .eq('share_token', token)
      .eq('is_public', true)
      .single();

    if (error || !shared) {
      return renderFallbackImage();
    }

    // Check expiration if the field exists
    if ((shared as Record<string, unknown>).expires_at && new Date((shared as Record<string, unknown>).expires_at as string) < new Date()) {
      return renderFallbackImage();
    }

    const results = shared.results as {
      terms: {
        upfront: { low: number; median: number; high: number };
        totalDealValue: { low: number; median: number; high: number };
      };
      tieredRoyalties: {
        base: { low: number; high: number };
        highTier: { low: number; high: number };
      };
      dealRecommendation: {
        upfrontPercent: number;
        milestonePercent: number;
        rationale: string;
      };
    };

    const labels = shared.labels as {
      phase: string;
      modality: string;
      indication: string;
    };

    const { terms, tieredRoyalties, dealRecommendation } = results;
    const risk = getRiskLevel(dealRecommendation.rationale);

    // Royalty range: from base low to highTier high
    const royaltyLow = tieredRoyalties.base.low;
    const royaltyHigh = tieredRoyalties.highTier.high;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#1a1e42',
            padding: '0',
            position: 'relative',
          }}
        >
          {/* Teal accent bar at top */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '6px',
              background: 'linear-gradient(to right, #14b8a6, #06b6d4)',
              display: 'flex',
            }}
          />

          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '48px 56px 40px',
              flex: 1,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '36px',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '32px',
                    borderRadius: '4px',
                    background: 'linear-gradient(to bottom, #14b8a6, #06b6d4)',
                    display: 'flex',
                  }}
                />
                Ambrosia Ventures
              </div>
              {/* Risk badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 20px',
                  borderRadius: '24px',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: `2px solid ${risk.color}`,
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: risk.color,
                    display: 'flex',
                  }}
                />
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: risk.color,
                    display: 'flex',
                  }}
                >
                  {risk.label}
                </span>
              </div>
            </div>

            {/* Asset info line */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '40px',
              }}
            >
              <span
                style={{
                  fontSize: '22px',
                  color: '#14b8a6',
                  fontWeight: 600,
                  display: 'flex',
                }}
              >
                {labels.indication}
              </span>
              <span
                style={{
                  fontSize: '22px',
                  color: 'rgba(255,255,255,0.3)',
                  display: 'flex',
                }}
              >
                |
              </span>
              <span
                style={{
                  fontSize: '22px',
                  color: '#d4d4d4',
                  display: 'flex',
                }}
              >
                {labels.phase}
              </span>
              <span
                style={{
                  fontSize: '22px',
                  color: 'rgba(255,255,255,0.3)',
                  display: 'flex',
                }}
              >
                |
              </span>
              <span
                style={{
                  fontSize: '22px',
                  color: '#d4d4d4',
                  display: 'flex',
                }}
              >
                {labels.modality}
              </span>
            </div>

            {/* Metrics grid */}
            <div
              style={{
                display: 'flex',
                gap: '24px',
                flex: 1,
              }}
            >
              {/* Total Deal Value */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '28px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span
                  style={{
                    fontSize: '16px',
                    color: '#a3a3a3',
                    fontWeight: 500,
                    marginBottom: '12px',
                    display: 'flex',
                  }}
                >
                  Total Deal Value
                </span>
                <span
                  style={{
                    fontSize: '36px',
                    fontWeight: 700,
                    color: '#34d399',
                    display: 'flex',
                  }}
                >
                  {formatCurrency(terms.totalDealValue.low)} - {formatCurrency(terms.totalDealValue.high)}
                </span>
              </div>

              {/* Upfront Payment */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '28px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span
                  style={{
                    fontSize: '16px',
                    color: '#a3a3a3',
                    fontWeight: 500,
                    marginBottom: '12px',
                    display: 'flex',
                  }}
                >
                  Upfront Payment
                </span>
                <span
                  style={{
                    fontSize: '36px',
                    fontWeight: 700,
                    color: '#ffffff',
                    display: 'flex',
                  }}
                >
                  {formatCurrency(terms.upfront.median)}
                </span>
              </div>

              {/* Royalty Range */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '28px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span
                  style={{
                    fontSize: '16px',
                    color: '#a3a3a3',
                    fontWeight: 500,
                    marginBottom: '12px',
                    display: 'flex',
                  }}
                >
                  Royalty Range
                </span>
                <span
                  style={{
                    fontSize: '36px',
                    fontWeight: 700,
                    color: '#ffffff',
                    display: 'flex',
                  }}
                >
                  {royaltyLow}% - {royaltyHigh}%
                </span>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '32px',
              }}
            >
              <div
                style={{
                  fontSize: '18px',
                  color: 'rgba(255,255,255,0.4)',
                  display: 'flex',
                }}
              >
                calculator.ambrosiaventures.co
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#14b8a6',
                }}
              >
                View Full Analysis
                <span style={{ display: 'flex' }}>&#8594;</span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error('OG image generation error:', e);
    return renderFallbackImage();
  }
}
