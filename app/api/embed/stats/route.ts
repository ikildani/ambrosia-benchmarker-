import { NextRequest, NextResponse } from 'next/server';
import { LIVE_DEAL_COUNT } from '@/lib/config/constants';

// Embeddable stats widget - generates backlinks when sites embed it
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'json';
  const theme = searchParams.get('theme') || 'light';

  // Live stats from benchmark data
  const stats = {
    total_deals: LIVE_DEAL_COUNT,
    therapeutic_areas: 12,
    company_profiles: 850,
    avg_upfront_oncology_phase2: 95,
    avg_upfront_immunology_phase2: 120,
    avg_upfront_metabolic_phase2: 150,
    adc_premium: '1.50x',
    modalities_covered: 25,
    last_updated: '2026-03',
    source: 'Ambrosia Ventures',
    source_url: 'https://calculator.ambrosiaventures.co',
  };

  if (format === 'html') {
    // Return embeddable HTML widget
    const bgColor = theme === 'dark' ? '#1e293b' : '#ffffff';
    const textColor = theme === 'dark' ? '#f1f5f9' : '#1e293b';
    const mutedColor = theme === 'dark' ? '#94a3b8' : '#64748b';
    const accentColor = '#14b8a6';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    .av-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      border: 1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'};
      border-radius: 12px;
      padding: 16px;
      max-width: 300px;
    }
    .av-widget-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .av-widget-logo {
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #14b8a6, #06b6d4);
      border-radius: 4px;
    }
    .av-widget-title {
      font-size: 12px;
      font-weight: 600;
      color: ${mutedColor};
    }
    .av-widget-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .av-widget-stat {
      text-align: center;
    }
    .av-widget-stat-value {
      font-size: 24px;
      font-weight: 700;
      color: ${accentColor};
    }
    .av-widget-stat-label {
      font-size: 11px;
      color: ${mutedColor};
    }
    .av-widget-footer {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'};
      text-align: center;
    }
    .av-widget-link {
      font-size: 11px;
      color: ${accentColor};
      text-decoration: none;
    }
    .av-widget-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body style="margin:0;padding:0;">
  <div class="av-widget">
    <div class="av-widget-header">
      <div class="av-widget-logo"></div>
      <span class="av-widget-title">BIOPHARMA DEAL DATA</span>
    </div>
    <div class="av-widget-stats">
      <div class="av-widget-stat">
        <div class="av-widget-stat-value">${stats.total_deals}+</div>
        <div class="av-widget-stat-label">Deals Analyzed</div>
      </div>
      <div class="av-widget-stat">
        <div class="av-widget-stat-value">$${stats.avg_upfront_oncology_phase2}M</div>
        <div class="av-widget-stat-label">Ph2 Oncology Upfront</div>
      </div>
      <div class="av-widget-stat">
        <div class="av-widget-stat-value">${stats.therapeutic_areas}</div>
        <div class="av-widget-stat-label">Therapeutic Areas</div>
      </div>
      <div class="av-widget-stat">
        <div class="av-widget-stat-value">${stats.adc_premium}</div>
        <div class="av-widget-stat-label">ADC Premium</div>
      </div>
    </div>
    <div class="av-widget-footer">
      <a class="av-widget-link" href="${stats.source_url}" target="_blank" rel="noopener">
        Powered by Ambrosia Ventures
      </a>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  }

  // Default: return JSON
  return NextResponse.json(stats, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
