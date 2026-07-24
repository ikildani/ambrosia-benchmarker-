import { NextRequest, NextResponse } from 'next/server';
import { renderChartSVG } from '@/lib/seo/embed-chart-renderer';
import type { ChartRenderParams } from '@/lib/seo/embed-chart-renderer';

export const dynamic = 'force-dynamic';

const VALID_TYPES: ChartRenderParams['type'][] = [
  'phase-upfront',
  'ta-comparison',
  'modality-premium',
  'territory-split',
];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const rawType = searchParams.get('type') || 'phase-upfront';
  const ta = searchParams.get('ta') || 'oncology';
  const theme = (searchParams.get('theme') || 'light') as 'light' | 'dark';

  // Validate chart type
  if (!VALID_TYPES.includes(rawType as ChartRenderParams['type'])) {
    return NextResponse.json(
      { error: `Invalid chart type. Must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const type = rawType as ChartRenderParams['type'];

  // Validate theme
  if (theme !== 'light' && theme !== 'dark') {
    return NextResponse.json(
      { error: 'Invalid theme. Must be "light" or "dark".' },
      { status: 400 }
    );
  }

  const svg = renderChartSVG({ type, ta, theme });

  const bgColor = theme === 'dark' ? '#111827' : '#ffffff';
  const textColor = theme === 'dark' ? '#e5e7eb' : '#374151';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Ambrosia Ventures — Biopharma Deal Benchmark Chart</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;background:${bgColor};overflow:hidden}
    .chart-container{
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      width:100%;
      height:100%;
      padding:8px;
    }
    .chart-container svg{
      width:100%;
      max-width:600px;
      height:auto;
    }
    .attribution{
      margin-top:6px;
      text-align:center;
    }
    .attribution a{
      font-family:system-ui,-apple-system,sans-serif;
      font-size:11px;
      color:${textColor};
      text-decoration:none;
      opacity:0.7;
    }
    .attribution a:hover{
      opacity:1;
      text-decoration:underline;
    }
  </style>
</head>
<body>
  <div class="chart-container">
    ${svg}
    <div class="attribution">
      <a href="https://solidus.ambrosiaventures.co" target="_blank" rel="noopener">
        Powered by Ambrosia Ventures &mdash; Biopharma Deal Benchmarks
      </a>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Frame-Options': 'ALLOWALL',
      'Access-Control-Allow-Origin': 'https://solidus.ambrosiaventures.co',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://solidus.ambrosiaventures.co',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
