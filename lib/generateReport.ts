import { CalculationResult, formatCurrency, formatRange } from './calculations';
import { markPDFGenerated, getHistory } from './history';

export interface PartnerForPDF {
  company_name: string;
  match_score: number;
  match_reasons: { reason: string; strength: string }[];
  deals_last_12mo: number;
  hq_country: string | null;
}

export function generatePDFReport(
  result: CalculationResult,
  historyId?: string,
  partnerMatches?: PartnerForPDF[]
): void {
  const { terms, tieredRoyalties, dealRecommendation, negotiationInsight, modifiers, labels } = result;

  // Calculate percentages for visual charts
  const totalValue = terms.totalDealValue.median;
  const upfrontPct = Math.round((terms.upfront.median / totalValue) * 100);
  const devPct = Math.round((terms.devMilestones.median / totalValue) * 100);
  const regPct = Math.round((terms.regMilestones.median / totalValue) * 100);
  const commPct = Math.round((terms.commMilestones.median / totalValue) * 100);

  // Get the origin for logo URL
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = `${origin}/logo.png`;

  // Generate unique report ID
  const reportId = `AV-${Date.now().toString(36).toUpperCase()}`;
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const reportTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Deal Terms Analysis Report - Ambrosia Ventures</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="preload" as="image" href="${logoUrl}">
  <style>

    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --navy: #1a1e42;
      --navy-light: #272d63;
      --teal: #00c7c7;
      --teal-dark: #008989;
      --teal-light: #e6fafa;
      --cyan: #00bcd4;
      --amber: #d97706;
      --amber-light: #fef3c7;
      --success: #10b981;
      --success-light: #d1fae5;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-500: #6b7280;
      --gray-600: #4b5563;
      --gray-700: #374151;
      --gray-800: #1f2937;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: var(--gray-800);
      line-height: 1.6;
      background: white;
      font-size: 11pt;
    }

    /* Cover Page */
    .cover-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: white;
      color: var(--gray-800);
      padding: 0;
      position: relative;
      overflow: hidden;
    }

    .cover-top-bar {
      height: 8px;
      background: linear-gradient(90deg, var(--navy) 0%, var(--teal) 50%, var(--cyan) 100%);
    }

    .cover-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 60px 80px;
    }

    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 80px;
    }

    .cover-logo {
      display: flex;
      align-items: center;
    }

    .cover-logo img {
      height: 120px;
      width: auto;
    }

    .cover-badge {
      background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 30px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 2px;
      box-shadow: 0 4px 14px rgba(26, 30, 66, 0.3);
    }

    .cover-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .cover-subtitle {
      font-size: 14px;
      font-weight: 600;
      color: var(--teal);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 20px;
    }

    .cover-title {
      font-size: 56px;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 16px;
      letter-spacing: -2px;
      color: var(--navy);
    }

    .cover-title-highlight {
      background: linear-gradient(135deg, var(--teal) 0%, var(--cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
      margin-top: 60px;
      padding: 32px;
      background: var(--gray-50);
      border-radius: 16px;
      border: 1px solid var(--gray-200);
    }

    .cover-meta-item {
      text-align: center;
    }

    .cover-meta-item label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--gray-500);
      margin-bottom: 8px;
    }

    .cover-meta-item span {
      font-size: 18px;
      font-weight: 700;
      color: var(--navy);
    }

    .cover-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 40px;
      border-top: 1px solid var(--gray-200);
      margin-top: auto;
    }

    .cover-report-id {
      font-size: 12px;
      color: var(--gray-400);
      font-weight: 500;
    }

    .cover-date {
      text-align: right;
      font-size: 13px;
      color: var(--gray-600);
      font-weight: 500;
    }

    /* Content Pages */
    .content-page {
      padding: 50px 60px;
      min-height: 100vh;
      position: relative;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      margin-bottom: 30px;
      border-bottom: 2px solid var(--gray-100);
    }

    .page-logo {
      display: flex;
      align-items: center;
    }

    .page-logo img {
      height: 56px;
      width: auto;
    }

    .page-info {
      font-size: 10px;
      color: var(--gray-500);
      text-align: right;
    }

    /* Executive Summary */
    .executive-summary {
      background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
      color: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 32px;
      position: relative;
      overflow: hidden;
    }

    .executive-summary::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(0, 199, 199, 0.2) 0%, transparent 70%);
    }

    .executive-summary h2 {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--teal);
      margin-bottom: 16px;
      position: relative;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      position: relative;
    }

    .summary-stat {
      text-align: center;
      padding: 20px;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .summary-stat-value {
      font-size: 32px;
      font-weight: 800;
      color: white;
      margin-bottom: 4px;
    }

    .summary-stat-value.highlight {
      color: var(--teal);
    }

    .summary-stat-label {
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Section Styling */
    .section {
      margin-bottom: 32px;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }

    .section-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, var(--teal) 0%, var(--cyan) 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .section-icon svg {
      width: 20px;
      height: 20px;
      fill: white;
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--navy);
    }

    /* Recommendation Box */
    .recommendation-card {
      background: linear-gradient(135deg, var(--teal-light) 0%, #f0fdfa 100%);
      border: 1px solid var(--teal);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
    }

    .recommendation-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .recommendation-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--teal-dark);
    }

    .recommendation-badge {
      background: var(--teal);
      color: white;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .recommendation-value {
      font-size: 28px;
      font-weight: 800;
      color: var(--navy);
      margin-bottom: 8px;
    }

    .recommendation-rationale {
      font-size: 13px;
      color: var(--gray-600);
      line-height: 1.6;
    }

    /* Insight Box */
    .insight-card {
      background: var(--amber-light);
      border: 1px solid var(--amber);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      gap: 16px;
    }

    .insight-icon {
      width: 40px;
      height: 40px;
      background: var(--amber);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .insight-icon svg {
      width: 22px;
      height: 22px;
      fill: white;
    }

    .insight-content h4 {
      font-size: 13px;
      font-weight: 700;
      color: var(--amber);
      margin-bottom: 4px;
    }

    .insight-content p {
      font-size: 13px;
      color: #92400e;
      line-height: 1.5;
    }

    /* Deal Visualization */
    .deal-visual {
      background: var(--gray-50);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .deal-visual-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--gray-500);
      margin-bottom: 16px;
    }

    .deal-bar-container {
      height: 48px;
      background: var(--gray-200);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      margin-bottom: 16px;
    }

    .deal-bar-segment {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: white;
      min-width: 40px;
    }

    .deal-bar-segment.upfront { background: var(--teal); }
    .deal-bar-segment.dev { background: var(--cyan); }
    .deal-bar-segment.reg { background: #6366f1; }
    .deal-bar-segment.comm { background: var(--navy); }

    .deal-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--gray-600);
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .legend-dot.upfront { background: var(--teal); }
    .legend-dot.dev { background: var(--cyan); }
    .legend-dot.reg { background: #6366f1; }
    .legend-dot.comm { background: var(--navy); }

    /* Terms Grid */
    .terms-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .term-card {
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: 12px;
      padding: 20px;
      transition: all 0.2s;
    }

    .term-card.primary {
      background: linear-gradient(135deg, var(--teal-light) 0%, #f0fdfa 100%);
      border-color: var(--teal);
    }

    .term-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .term-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--gray-500);
    }

    .term-card.primary .term-label {
      color: var(--teal-dark);
    }

    .term-icon {
      width: 28px;
      height: 28px;
      background: var(--gray-100);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .term-card.primary .term-icon {
      background: var(--teal);
    }

    .term-icon svg {
      width: 16px;
      height: 16px;
      fill: var(--gray-500);
    }

    .term-card.primary .term-icon svg {
      fill: white;
    }

    .term-range {
      font-size: 22px;
      font-weight: 800;
      color: var(--navy);
      margin-bottom: 4px;
    }

    .term-median {
      font-size: 13px;
      color: var(--gray-500);
    }

    .term-median strong {
      color: var(--teal-dark);
      font-weight: 700;
    }

    /* Royalties Card */
    .royalties-card {
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: 12px;
      padding: 20px;
    }

    .royalty-tiers {
      margin-top: 12px;
    }

    .royalty-tier {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--gray-100);
    }

    .royalty-tier:last-child {
      border-bottom: none;
    }

    .royalty-tier-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .tier-indicator {
      width: 8px;
      height: 24px;
      border-radius: 4px;
    }

    .tier-indicator.base { background: var(--teal); }
    .tier-indicator.mid { background: var(--cyan); }
    .tier-indicator.high { background: var(--navy); }

    .royalty-tier-label {
      font-size: 13px;
      color: var(--gray-600);
    }

    .royalty-tier-threshold {
      font-size: 11px;
      color: var(--gray-400);
    }

    .royalty-tier-value {
      font-size: 15px;
      font-weight: 700;
      color: var(--navy);
    }

    /* Modifiers */
    .modifiers-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .modifier-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .modifier-tag.positive {
      background: var(--success-light);
      color: #065f46;
    }

    .modifier-tag.negative {
      background: #fee2e2;
      color: #991b1b;
    }

    .modifier-tag.neutral {
      background: var(--gray-100);
      color: var(--gray-600);
    }

    .modifier-arrow {
      font-size: 10px;
    }

    /* Partner Matching */
    .partners-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .partner-card {
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: 12px;
      padding: 16px;
    }

    .partner-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .partner-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--navy);
    }

    .partner-location {
      font-size: 11px;
      color: var(--gray-500);
    }

    .partner-score {
      background: linear-gradient(135deg, var(--teal) 0%, var(--cyan) 100%);
      color: white;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
    }

    .partner-reasons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .partner-reason {
      background: var(--gray-100);
      color: var(--gray-600);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 10px;
    }

    .partner-reason.strong {
      background: var(--teal-light);
      color: var(--teal-dark);
    }

    .partner-activity {
      margin-top: 10px;
      font-size: 11px;
      color: var(--gray-500);
    }

    /* Disclaimer */
    .disclaimer {
      background: var(--gray-50);
      border: 1px solid var(--gray-200);
      border-radius: 12px;
      padding: 20px;
      margin-top: 32px;
    }

    .disclaimer-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--gray-500);
      margin-bottom: 8px;
    }

    .disclaimer-text {
      font-size: 11px;
      color: var(--gray-500);
      line-height: 1.6;
    }

    /* Footer */
    .page-footer {
      position: absolute;
      bottom: 40px;
      left: 60px;
      right: 60px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 20px;
      border-top: 1px solid var(--gray-200);
      font-size: 10px;
      color: var(--gray-400);
    }

    .footer-brand {
      display: flex;
      align-items: center;
    }

    .footer-brand img {
      height: 36px;
      width: auto;
    }

    /* Print Optimization */
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .cover-page {
        page-break-after: always;
      }

      .content-page {
        page-break-inside: avoid;
      }

      .term-card, .recommendation-card, .insight-card {
        break-inside: avoid;
      }

      .no-print {
        display: none !important;
      }
    }

    @page {
      size: A4;
      margin: 0;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    <div class="cover-top-bar"></div>
    <div class="cover-main">
      <div class="cover-header">
        <div class="cover-logo"><img src="${logoUrl}" alt="Ambrosia Ventures" /></div>
        <div class="cover-badge">Confidential</div>
      </div>

      <div class="cover-content">
        <div class="cover-subtitle">Life Sciences Deal Intelligence</div>
        <h1 class="cover-title">Deal Terms<br/><span class="cover-title-highlight">Analysis Report</span></h1>

        <div class="cover-meta-grid">
          <div class="cover-meta-item">
            <label>Development Phase</label>
            <span>${labels.phase}</span>
          </div>
          <div class="cover-meta-item">
            <label>Modality</label>
            <span>${labels.modality}</span>
          </div>
          <div class="cover-meta-item">
            <label>Indication</label>
            <span>${labels.indication}</span>
          </div>
        </div>
      </div>

      <div class="cover-footer">
        <div class="cover-report-id">Report ID: ${reportId}</div>
        <div class="cover-date">${reportDate} • ${reportTime}</div>
      </div>
    </div>
  </div>

  <!-- Content Page -->
  <div class="content-page">
    <div class="page-header">
      <div class="page-logo"><img src="${logoUrl}" alt="Ambrosia Ventures" /></div>
      <div class="page-info">
        Report ID: ${reportId}<br/>
        ${reportDate}
      </div>
    </div>

    <!-- Executive Summary -->
    <div class="executive-summary">
      <h2>Executive Summary</h2>
      <div class="summary-grid">
        <div class="summary-stat">
          <div class="summary-stat-value">${formatCurrency(terms.upfront.median)}</div>
          <div class="summary-stat-label">Upfront Payment</div>
        </div>
        <div class="summary-stat">
          <div class="summary-stat-value highlight">${formatCurrency(terms.totalDealValue.median)}</div>
          <div class="summary-stat-label">Total Deal Value</div>
        </div>
      </div>
    </div>

    <!-- Recommendation -->
    <div class="section">
      <div class="recommendation-card">
        <div class="recommendation-header">
          <div class="recommendation-label">Recommended Deal Structure</div>
          <div class="recommendation-badge">AI Optimized</div>
        </div>
        <div class="recommendation-value">${dealRecommendation.upfrontPercent}% Upfront / ${dealRecommendation.milestonePercent}% Milestones</div>
        <div class="recommendation-rationale">${dealRecommendation.rationale}</div>
      </div>

      <div class="insight-card">
        <div class="insight-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
        </div>
        <div class="insight-content">
          <h4>Negotiation Insight</h4>
          <p>${negotiationInsight}</p>
        </div>
      </div>
    </div>

    <!-- Deal Value Breakdown -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
        </div>
        <h3 class="section-title">Deal Value Breakdown</h3>
      </div>

      <div class="deal-visual">
        <div class="deal-visual-title">Value Distribution</div>
        <div class="deal-bar-container">
          <div class="deal-bar-segment upfront" style="width: ${upfrontPct}%">${upfrontPct}%</div>
          <div class="deal-bar-segment dev" style="width: ${devPct}%">${devPct}%</div>
          <div class="deal-bar-segment reg" style="width: ${regPct}%">${regPct}%</div>
          <div class="deal-bar-segment comm" style="width: ${commPct}%">${commPct}%</div>
        </div>
        <div class="deal-legend">
          <div class="legend-item"><div class="legend-dot upfront"></div>Upfront (${formatCurrency(terms.upfront.median)})</div>
          <div class="legend-item"><div class="legend-dot dev"></div>Development (${formatCurrency(terms.devMilestones.median)})</div>
          <div class="legend-item"><div class="legend-dot reg"></div>Regulatory (${formatCurrency(terms.regMilestones.median)})</div>
          <div class="legend-item"><div class="legend-dot comm"></div>Commercial (${formatCurrency(terms.commMilestones.median)})</div>
        </div>
      </div>
    </div>

    <!-- Estimated Deal Terms -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
        </div>
        <h3 class="section-title">Estimated Deal Terms</h3>
      </div>

      <div class="terms-grid">
        <div class="term-card primary">
          <div class="term-card-header">
            <div class="term-label">Upfront Payment</div>
            <div class="term-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>
            </div>
          </div>
          <div class="term-range">${formatRange(terms.upfront)}</div>
          <div class="term-median">Expected: <strong>${formatCurrency(terms.upfront.median)}</strong></div>
        </div>

        <div class="term-card primary">
          <div class="term-card-header">
            <div class="term-label">Total Deal Value</div>
            <div class="term-icon">
              <svg viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
            </div>
          </div>
          <div class="term-range">${formatRange(terms.totalDealValue)}</div>
          <div class="term-median">Expected: <strong>${formatCurrency(terms.totalDealValue.median)}</strong></div>
        </div>

        <div class="term-card">
          <div class="term-card-header">
            <div class="term-label">Development Milestones</div>
            <div class="term-icon">
              <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
            </div>
          </div>
          <div class="term-range">${formatRange(terms.devMilestones)}</div>
          <div class="term-median">Expected: <strong>${formatCurrency(terms.devMilestones.median)}</strong></div>
        </div>

        <div class="term-card">
          <div class="term-card-header">
            <div class="term-label">Regulatory Milestones</div>
            <div class="term-icon">
              <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
            </div>
          </div>
          <div class="term-range">${formatRange(terms.regMilestones)}</div>
          <div class="term-median">Expected: <strong>${formatCurrency(terms.regMilestones.median)}</strong></div>
        </div>

        <div class="term-card">
          <div class="term-card-header">
            <div class="term-label">Commercial Milestones</div>
            <div class="term-icon">
              <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
            </div>
          </div>
          <div class="term-range">${formatRange(terms.commMilestones)}</div>
          <div class="term-median">Expected: <strong>${formatCurrency(terms.commMilestones.median)}</strong></div>
        </div>

        <div class="royalties-card">
          <div class="term-card-header">
            <div class="term-label">Tiered Royalties</div>
            <div class="term-icon">
              <svg viewBox="0 0 24 24"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/></svg>
            </div>
          </div>
          <div class="royalty-tiers">
            <div class="royalty-tier">
              <div class="royalty-tier-info">
                <div class="tier-indicator base"></div>
                <div>
                  <div class="royalty-tier-label">Base Tier</div>
                  <div class="royalty-tier-threshold">&lt;$500M net sales</div>
                </div>
              </div>
              <div class="royalty-tier-value">${tieredRoyalties.base.low}% - ${tieredRoyalties.base.high}%</div>
            </div>
            <div class="royalty-tier">
              <div class="royalty-tier-info">
                <div class="tier-indicator mid"></div>
                <div>
                  <div class="royalty-tier-label">Mid Tier</div>
                  <div class="royalty-tier-threshold">$500M - $1B net sales</div>
                </div>
              </div>
              <div class="royalty-tier-value">${tieredRoyalties.midTier.low}% - ${tieredRoyalties.midTier.high}%</div>
            </div>
            <div class="royalty-tier">
              <div class="royalty-tier-info">
                <div class="tier-indicator high"></div>
                <div>
                  <div class="royalty-tier-label">High Tier</div>
                  <div class="royalty-tier-threshold">&gt;$1B net sales</div>
                </div>
              </div>
              <div class="royalty-tier-value">${tieredRoyalties.highTier.low}% - ${tieredRoyalties.highTier.high}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    ${modifiers.length > 0 ? `
    <!-- Applied Adjustments -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
        </div>
        <h3 class="section-title">Applied Adjustments</h3>
      </div>
      <div class="modifiers-grid">
        ${modifiers.map(mod => `
          <div class="modifier-tag ${mod.multiplier > 1 ? 'positive' : mod.multiplier < 1 ? 'negative' : 'neutral'}">
            ${mod.multiplier > 1 ? '<span class="modifier-arrow">▲</span>' : mod.multiplier < 1 ? '<span class="modifier-arrow">▼</span>' : ''}
            ${mod.name}${mod.multiplier !== 1 ? ` (${mod.multiplier > 1 ? '+' : ''}${Math.round((mod.multiplier - 1) * 100)}%)` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${partnerMatches && partnerMatches.length > 0 ? `
    <!-- Partner Matching -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        </div>
        <h3 class="section-title">Potential Partners</h3>
      </div>
      <div class="partners-grid">
        ${partnerMatches.slice(0, 4).map(partner => `
          <div class="partner-card">
            <div class="partner-header">
              <div>
                <div class="partner-name">${partner.company_name}</div>
                ${partner.hq_country ? `<div class="partner-location">${partner.hq_country}</div>` : ''}
              </div>
              <div class="partner-score">${partner.match_score}%</div>
            </div>
            <div class="partner-reasons">
              ${partner.match_reasons.slice(0, 2).map(r => `
                <span class="partner-reason ${r.strength === 'strong' ? 'strong' : ''}">${r.reason}</span>
              `).join('')}
            </div>
            ${partner.deals_last_12mo > 0 ? `
              <div class="partner-activity">${partner.deals_last_12mo} deal${partner.deals_last_12mo > 1 ? 's' : ''} in last 12 months</div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Disclaimer -->
    <div class="disclaimer">
      <div class="disclaimer-title">Important Disclaimer</div>
      <div class="disclaimer-text">
        These estimates are based on publicly available deal data and current market benchmarks. Actual deal terms vary significantly based on asset-specific factors including clinical data quality, competitive landscape, intellectual property position, manufacturing considerations, and negotiation dynamics. This analysis does not constitute financial, legal, or investment advice. For comprehensive deal advisory services, please contact Ambrosia Ventures directly.
      </div>
    </div>

    <div class="page-footer">
      <div class="footer-brand"><img src="${logoUrl}" alt="Ambrosia Ventures" /></div>
      <div>www.ambrosiaventures.co</div>
      <div>© ${new Date().getFullYear()} Ambrosia Ventures. All rights reserved.</div>
    </div>
  </div>
</body>
</html>
  `;

  // Mark PDF as generated in history if historyId provided
  if (historyId) {
    markPDFGenerated(historyId);
  }

  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(reportHTML);
    printWindow.document.close();

    // Wait for images and fonts to load before printing
    const logoImg = printWindow.document.querySelector('.cover-logo img') as HTMLImageElement;
    if (logoImg && !logoImg.complete) {
      logoImg.onload = () => printWindow.print();
      logoImg.onerror = () => printWindow.print();
    } else {
      // Image already loaded or no image, print after fonts load
      printWindow.document.fonts?.ready?.then(() => {
        printWindow.print();
      }).catch(() => {
        printWindow.print();
      });
    }
  }
}
