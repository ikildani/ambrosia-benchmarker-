import { CalculationResult, formatCurrency, formatRange } from './calculations';

export function generatePDFReport(result: CalculationResult): void {
  const { terms, modifiers, labels } = result;

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
      <div class="meta-label">Report Date</div>
      <div class="meta-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    </div>
  </div>

  ${modifiers.length > 0 ? `
  <div class="section">
    <div class="section-title">Applied Adjustments</div>
    <div class="modifiers">
      ${modifiers.map(mod => `
        <div class="modifier ${mod.multiplier > 1 ? 'positive' : 'negative'}">
          ${mod.name} (${mod.multiplier > 1 ? '+' : ''}${Math.round((mod.multiplier - 1) * 100)}%)
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
        <div class="term-median">Median: <span>${formatCurrency(terms.upfront.median)}</span></div>
      </div>
      <div class="term-card highlight">
        <div class="term-label">Total Deal Value</div>
        <div class="term-range">${formatRange(terms.totalDealValue)}</div>
        <div class="term-median">Median: <span>${formatCurrency(terms.totalDealValue.median)}</span></div>
      </div>
      <div class="term-card">
        <div class="term-label">Development Milestones</div>
        <div class="term-range">${formatRange(terms.devMilestones)}</div>
        <div class="term-median">Median: <span>${formatCurrency(terms.devMilestones.median)}</span></div>
      </div>
      <div class="term-card">
        <div class="term-label">Regulatory Milestones</div>
        <div class="term-range">${formatRange(terms.regMilestones)}</div>
        <div class="term-median">Median: <span>${formatCurrency(terms.regMilestones.median)}</span></div>
      </div>
      <div class="term-card">
        <div class="term-label">Commercial Milestones</div>
        <div class="term-range">${formatRange(terms.commMilestones)}</div>
        <div class="term-median">Median: <span>${formatCurrency(terms.commMilestones.median)}</span></div>
      </div>
      <div class="term-card">
        <div class="term-label">Royalty Rate</div>
        <div class="term-range">${formatRange(terms.royalties, true)}</div>
        <div class="term-median">Median: <span>${terms.royalties.median}%</span></div>
      </div>
    </div>
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> These estimates are based on publicly available deal data and are intended for illustrative purposes only.
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
