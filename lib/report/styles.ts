// All CSS for the PDF report — print rules, page styling, typography
// Consulting-grade output: bold color blocking, navy headers, accent elements

export function getReportStyles(): string {
  return `
    @page {
      size: A4;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11px;
      line-height: 1.55;
      letter-spacing: -0.005em;
    }

    .report-page {
      width: 210mm;
      min-height: 297mm;
      page-break-after: always;
      page-break-inside: avoid;
      padding: 40px 48px 52px 48px;
      position: relative;
      background: white;
    }

    .report-page:last-child {
      page-break-after: auto;
    }

    .cover-page {
      padding: 0;
    }

    /* ========================================
       TYPOGRAPHY — Bold hierarchy
       ======================================== */

    .section-title {
      font-size: 9px;
      font-weight: 700;
      color: #0d9488;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #ccfbf1;
    }

    .section-title-lg {
      font-size: 20px;
      font-weight: 800;
      color: #1a1e42;
      margin-bottom: 16px;
      letter-spacing: -0.03em;
      line-height: 1.15;
      padding-left: 12px;
      border-left: 4px solid #0d9488;
    }

    .text-sm { font-size: 10px; }
    .text-xs { font-size: 9px; }
    .text-xxs { font-size: 8px; }
    .text-lg { font-size: 15px; }
    .text-xl { font-size: 19px; }
    .text-2xl { font-size: 22px; }

    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }

    .text-navy { color: #1a1e42; }
    .text-teal { color: #0d9488; }
    .text-gray { color: #64748b; }
    .text-gray-light { color: #94a3b8; }
    .text-white { color: #ffffff; }
    .text-amber { color: #d97706; }
    .text-rose { color: #e11d48; }

    /* ========================================
       LAYOUT
       ======================================== */

    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-2 { gap: 8px; }
    .gap-3 { gap: 12px; }
    .gap-4 { gap: 16px; }
    .gap-6 { gap: 24px; }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }

    .grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 10px;
    }

    /* ========================================
       CARDS — Elevated with accents
       ======================================== */

    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .card-sm {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 10px 14px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }

    .card-highlight {
      background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);
      border: 1px solid #99f6e4;
      border-left: 4px solid #0d9488;
      border-radius: 6px;
      padding: 16px;
      box-shadow: 0 1px 4px rgba(13,148,136,0.08);
    }

    .card-amber {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      border-radius: 6px;
      padding: 16px;
    }

    .card-navy {
      background: linear-gradient(145deg, #1a1e42 0%, #252a5e 100%);
      border: none;
      border-radius: 6px;
      padding: 18px;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(26,30,66,0.15);
    }

    /* ========================================
       KPI CARDS — Bold with top accent
       ======================================== */

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-top: 3px solid #0d9488;
      border-radius: 6px;
      padding: 16px 14px;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 800;
      color: #0d9488;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }

    .kpi-label {
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-top: 6px;
    }

    .kpi-sub {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 3px;
    }

    /* ========================================
       TABLES — Navy headers, professional
       ======================================== */

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .data-table th {
      background: #1a1e42;
      color: #ffffff;
      border-bottom: none;
      padding: 9px 12px;
      text-align: left;
      font-weight: 700;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .data-table th:first-child {
      border-radius: 4px 0 0 0;
    }

    .data-table th:last-child {
      border-radius: 0 4px 0 0;
    }

    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }

    .data-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .data-table tr:hover td {
      background: #f0fdfa;
    }

    .data-table .value-cell {
      font-weight: 700;
      color: #0d9488;
      text-align: right;
    }

    /* ========================================
       BADGES — Compact, bold
       ======================================== */

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .badge-teal {
      background: #ccfbf1;
      color: #0d9488;
    }

    .badge-amber {
      background: #fef3c7;
      color: #b45309;
    }

    .badge-rose {
      background: #ffe4e6;
      color: #be123c;
    }

    .badge-blue {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .badge-gray {
      background: #f1f5f9;
      color: #475569;
    }

    .badge-navy {
      background: #1a1e42;
      color: #ffffff;
    }

    /* Impact level badges */
    .impact-very-high { background: #fee2e2; color: #b91c1c; }
    .impact-high { background: #fef3c7; color: #b45309; }
    .impact-medium { background: #dbeafe; color: #1d4ed8; }
    .impact-low { background: #dcfce7; color: #15803d; }

    /* ========================================
       SCORE BARS — Taller, more visible
       ======================================== */

    .score-bar {
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }

    .score-bar-fill {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(90deg, #0d9488, #06b6d4);
    }

    /* ========================================
       CALLOUT BOXES — Strong accents
       ======================================== */

    .callout {
      background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);
      border-left: 4px solid #0d9488;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
      font-size: 10px;
      color: #134e4a;
      line-height: 1.6;
      box-shadow: 0 1px 3px rgba(13,148,136,0.06);
    }

    .callout-amber {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
      font-size: 10px;
      color: #78350f;
      line-height: 1.6;
    }

    /* ========================================
       BULLET LISTS
       ======================================== */

    .bullet-list {
      padding-left: 16px;
      font-size: 10px;
      color: #334155;
    }

    .bullet-list li {
      margin-bottom: 3px;
      line-height: 1.5;
    }

    /* ========================================
       DIVIDERS
       ======================================== */

    .divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 12px 0;
    }

    .divider-thick {
      border: none;
      border-top: 2.5px solid #1a1e42;
      margin: 16px 0;
    }

    /* ========================================
       CHART CONTAINERS
       ======================================== */

    .chart-container {
      width: 100%;
      display: flex;
      justify-content: center;
      margin: 6px 0;
      overflow: hidden;
    }

    .chart-container svg {
      max-width: 100%;
      height: auto;
    }

    /* ========================================
       AI BADGE — Premium look
       ======================================== */

    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      background: linear-gradient(135deg, #1a1e42, #312e81);
      color: #c4b5fd;
      border-radius: 4px;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      box-shadow: 0 1px 3px rgba(26,30,66,0.2);
    }

    /* ========================================
       DISCLAIMER
       ======================================== */

    .disclaimer-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #94a3b8;
      border-radius: 0 4px 4px 0;
      padding: 14px 18px;
      font-size: 8px;
      color: #64748b;
      line-height: 1.7;
    }

    /* ========================================
       PRINT & SCREEN
       ======================================== */

    /* ========================================
       PAGE BREAK CONTROL — Prevent mid-element breaks
       ======================================== */

    .card, .card-sm, .card-highlight, .card-amber, .card-navy,
    .kpi-card, .callout, .callout-amber, .disclaimer-box {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .data-table {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .grid-2, .grid-3, .grid-4 {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .section-title, .section-title-lg {
      page-break-after: avoid;
      break-after: avoid;
    }

    .chart-container {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Keep section titles attached to their content */
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
      break-after: avoid;
      orphans: 3;
      widows: 3;
    }

    /* Prevent single orphan lines */
    p {
      orphans: 2;
      widows: 2;
    }

    @media print {
      body { background: white; }
      .report-page { box-shadow: none; }
      .no-print { display: none !important; }
    }

    @media screen {
      body {
        background: #475569;
        padding: 16px 0;
      }
      .report-page {
        margin: 16px auto;
        box-shadow: 0 4px 24px rgba(0,0,0,0.2);
      }
    }
  `;
}
