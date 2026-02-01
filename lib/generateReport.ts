import { CalculationResult, formatCurrency, formatRange } from './calculations';

export function generatePDFReport(result: CalculationResult): void {
  const { terms, tieredRoyalties, dealRecommendation, negotiationInsight, modifiers, labels } = result;

  const reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Deal Terms Analysis Report - Ambrosia Ventures</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1a1e42;
      line-height: 1.6;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 2px solid #00c7c7;
      margin-bottom: 30px;
    }
    .logo-text {
      font-size: 28px;
      font-weight: bold;
      color: #1a1e42;
    }
    .logo-text span { color: #00c7c7; }
    .subtitle {
      color: #666;
      margin-top: 5px;
      font-size: 14px;
    }
    .report-title {
      font-size: 24px;
      font-weight: bold;
      margin-top: 20px;
      color: #1a1e42;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      background: #f5f5f5;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .meta-item {
      text-align: center;
    }
    .meta-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1e42;
      margin-top: 4px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1a1e42;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e5e5;
    }
    .recommendation-box {
      background: linear-gradient(135deg, #e6fafa 0%, #f0fdf4 100%);
      border: 1px solid #00c7c7;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .recommendation-title {
      font-size: 14px;
      font-weight: 600;
      color: #008989;
      margin-bottom: 8px;
    }
    .recommendation-value {
      font-size: 20px;
      font-weight: bold;
      color: #1a1e42;
      margin-bottom: 4px;
    }
    .recommendation-rationale {
      font-size: 13px;
      color: #666;
    }
    .insight-box {
      background: #fef3c7;
      border: 1px solid #d97706;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    .insight-title {
      font-size: 14px;
      font-weight: 600;
      color: #d97706;
      margin-bottom: 5px;
    }
    .insight-text {
      font-size: 13px;
      color: #92400e;
    }
    .terms-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .term-card {
      background: #f8f9fa;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 20px;
    }
    .term-card.highlight {
      background: linear-gradient(135deg, #e6fafa 0%, #f0fdf4 100%);
      border-color: #00c7c7;
    }
    .term-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .term-range {
      font-size: 20px;
      font-weight: bold;
      color: #1a1e42;
      margin-bottom: 4px;
    }
    .term-median {
      font-size: 14px;
      color: #666;
    }
    .term-median span {
      font-weight: 600;
      color: #00c7c7;
    }
    .royalty-tiers {
      margin-top: 10px;
    }
    .royalty-tier {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 13px;
    }
    .royalty-tier-label {
      color: #666;
    }
    .royalty-tier-value {
      font-weight: 600;
      color: #1a1e42;
    }
    .modifiers {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .modifier {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }
    .modifier.positive {
      background: #e6fafa;
      color: #008989;
    }
    .modifier.negative {
      background: #fef3c7;
      color: #d97706;
    }
    .modifier.neutral {
      background: #f5f5f5;
      color: #666;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 11px;
      color: #999;
      text-align: center;
    }
    .disclaimer {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      font-size: 11px;
      color: #666;
      margin-top: 30px;
    }
    @media print {
      body { padding: 20px; }
      .term-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-text">Ambrosia<span>Ventures</span></div>
    <div class="subtitle">Life Sciences Deal Intelligence</div>
    <div class="report-title">Deal Terms Analysis Report</div>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Development Phase</div>
      <div class="meta-value">${labels.phase}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Modality</div>
      <div class="meta-value">${labels.modality}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Indication</div>
      <div class="meta-value">${labels.indication}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Report Date</div>
      <div class="meta-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>

  <div class="section">
    <div class="recommendation-box">
      <div class="recommendation-title">Recommended Deal Structure</div>
      <div class="recommendation-value">${dealRecommendation.upfrontPercent}% Upfront / ${dealRecommendation.milestonePercent}% Milestones</div>
      <div class="recommendation-rationale">${dealRecommendation.rationale}</div>
    </div>
    <div class="insight-box">
      <div class="insight-title">Negotiation Insight</div>
      <div class="insight-text">${negotiationInsight}</div>
    </div>
  </div>

  ${modifiers.length > 0 ? `
  <div class="section">
    <div class="section-title">Applied Adjustments</div>
    <div class="modifiers">
      ${modifiers.map(mod => `
        <div class="modifier ${mod.multiplier > 1 ? 'positive' : mod.multiplier < 1 ? 'negative' : 'neutral'}">
          ${mod.name}${mod.multiplier !== 1 ? ` (${mod.multiplier > 1 ? '+' : ''}${Math.round((mod.multiplier - 1) * 100)}%)` : ''}
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Estimated Deal Terms</div>
    <div class="terms-grid">
      <div class="term-card highlight">
        <div class="term-label">Upfront Payment</div>
        <div class="term-range">${formatRange(terms.upfront)}</div>
        <div class="term-median">Expected: <span>${formatCurrency(terms.upfront.median)}</span></div>
      </div>
      <div class="term-card highlight">
        <div class="term-label">Total Deal Value</div>
        <div class="term-range">${formatRange(terms.totalDealValue)}</div>
        <div class="term-median">Expected: <span>${formatCurrency(terms.totalDealValue.median)}</span></div>
      </div>
      <div class="term-card">
        <div class="term-label">Development Milestones</div>
        <div class="term-range">${formatRange(terms.devMilestones)}</div>
        <div class="term-median">Expected: <span>${formatCurrency(terms.devMilestones.median)}</span></div>
      </div>
      <div class="term-card">
        <div class="term-label">Regulatory Milestones</div>
        <div class="term-range">${formatRange(terms.regMilestones)}</div>
        <div class="term-median">Expected: <span>${formatCurrency(terms.regMilestones.median)}</span></div>
      </div>
      <div class="term-card">
        <div class="term-label">Commercial Milestones</div>
        <div class="term-range">${formatRange(terms.commMilestones)}</div>
        <div class="term-median">Expected: <span>${formatCurrency(terms.commMilestones.median)}</span></div>
      </div>
      <div class="term-card">
        <div class="term-label">Tiered Royalties</div>
        <div class="royalty-tiers">
          <div class="royalty-tier">
            <span class="royalty-tier-label">Base (&lt;$500M)</span>
            <span class="royalty-tier-value">${tieredRoyalties.base.low}% - ${tieredRoyalties.base.high}%</span>
          </div>
          <div class="royalty-tier">
            <span class="royalty-tier-label">Mid ($500M-$1B)</span>
            <span class="royalty-tier-value">${tieredRoyalties.midTier.low}% - ${tieredRoyalties.midTier.high}%</span>
          </div>
          <div class="royalty-tier">
            <span class="royalty-tier-label">High (&gt;$1B)</span>
            <span class="royalty-tier-value">${tieredRoyalties.highTier.low}% - ${tieredRoyalties.highTier.high}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> These estimates are based on publicly available deal data and 2025 market benchmarks.
    Actual deal terms vary significantly based on asset-specific factors, market conditions, competitive dynamics, and negotiation outcomes.
    This tool does not constitute financial or legal advice. For detailed advisory services, please contact Ambrosia Ventures.
  </div>

  <div class="footer">
    <p>Generated by Ambrosia Ventures Deal Calculator</p>
    <p>© ${new Date().getFullYear()} Ambrosia Ventures. All rights reserved.</p>
    <p>www.ambrosiaventures.co | info@ambrosiaventures.co</p>
  </div>
</body>
</html>
  `;

  // Open in new window for printing/saving as PDF
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    // Auto-trigger print dialog after a short delay
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
