/**
 * Email template for the Deal Intelligence Brief: intake confirmation,
 * operator notice and delivery. One header (wordmark on navy), one body,
 * one signature, one footer, plus a numbered process stepper that states the
 * flow exactly as the product runs it.
 *
 * Table-based, inline-styled, no web fonts: renders the same in Gmail,
 * Outlook and Apple Mail. Every dynamic string passes through `esc`.
 */

const SITE = 'https://solidus.ambrosiaventures.co';
const LOGO = `${SITE}/logo-white.png`;

export const esc = (s: string | null | undefined): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface Step { title: string; body: string; done?: boolean; now?: boolean }

export function stepper(steps: Step[]): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse; margin: 8px 0 4px;">
    ${steps.map((s, i) => `<tr>
      <td style="width:36px; vertical-align:top; padding: 0 0 18px;">
        <div style="width:26px; height:26px; line-height:26px; border-radius:13px; text-align:center; font-family:${FONT}; font-size:12px; font-weight:700; ${s.done ? 'background:#0f766e; color:#ffffff;' : s.now ? 'background:#0b1220; color:#ffffff;' : 'background:#e2e8f0; color:#475569;'}">${s.done ? '&#10003;' : i + 1}</div>
      </td>
      <td style="vertical-align:top; padding: 2px 0 18px 10px; font-family:${FONT};">
        <div style="font-size:14px; font-weight:600; color:#0b1220;">${esc(s.title)}${s.now ? ' <span style="font-weight:500; color:#0f766e; font-size:12px;">· now</span>' : ''}</div>
        <div style="font-size:14px; line-height:1.55; color:#475569; margin-top:2px;">${s.body}</div>
      </td>
    </tr>`).join('')}
  </table>`;
}

export function button(text: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 22px 0;"><tr><td style="background:#0f766e; border-radius:6px;">
    <a href="${esc(href)}" style="display:inline-block; padding: 12px 24px; font-family:${FONT}; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none;">${esc(text)}</a>
  </td></tr></table>`;
}

export function factsTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse; margin: 6px 0 14px; font-family:${FONT}; font-size:13px;">
    ${rows.map(([k, v]) => `<tr>
      <td style="padding: 7px 10px 7px 0; color:#64748b; vertical-align:top; white-space:nowrap; border-bottom:1px solid #eef2f7; width: 160px;">${esc(k)}</td>
      <td style="padding: 7px 0; color:#0b1220; vertical-align:top; border-bottom:1px solid #eef2f7;">${v}</td>
    </tr>`).join('')}
  </table>`;
}

export function callout(html: string, tone: 'teal' | 'amber' = 'teal'): string {
  const bg = tone === 'amber' ? '#fffbeb' : '#f0fdfa';
  const bar = tone === 'amber' ? '#d97706' : '#0f766e';
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin: 16px 0;"><tr>
    <td style="width:3px; background:${bar}; border-radius: 2px;"></td>
    <td style="background:${bg}; padding: 12px 16px; font-family:${FONT}; font-size:14px; line-height:1.55; color:#1e293b;">${html}</td>
  </tr></table>`;
}

export function signature(): string {
  return `<p style="margin: 26px 0 0; font-family:${FONT}; font-size:14px; line-height:1.55; color:#1e293b;">
    Best,<br><strong>Issa Kildani</strong><br><span style="color:#475569;">Managing Partner, Ambrosia Ventures</span><br>
    <a href="mailto:ikildani@ambrosiaventures.co" style="color:#0f766e; text-decoration:none;">ikildani@ambrosiaventures.co</a>
  </p>`;
}

export interface Envelope {
  /** Small caps line above the headline, e.g. "Deal Intelligence Brief". */
  eyebrow: string;
  headline: string;
  /** One line under the headline, plain text. */
  sub?: string;
  /** Body HTML; paragraphs should use `p()`. */
  body: string;
  /** Preheader shown in the inbox preview. */
  preheader?: string;
}

export const p = (html: string, opts: { muted?: boolean } = {}) =>
  `<p style="margin: 0 0 14px; font-family:${FONT}; font-size:15px; line-height:1.6; color:${opts.muted ? '#64748b' : '#1e293b'};">${html}</p>`;

export function envelope(e: Envelope): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(e.headline)}</title></head>
<body style="margin:0; padding:0; background:#f1f5f9;">
  ${e.preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${esc(e.preheader)}</div>` : ''}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f1f5f9;"><tr><td align="center" style="padding: 28px 12px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:600px; max-width:100%;">
      <tr><td style="background:#0b1220; padding: 30px 36px 26px; border-radius: 10px 10px 0 0;">
        <img src="${LOGO}" alt="Ambrosia Ventures" width="190" style="display:block; width:190px; height:auto; border:0;">
        <div style="margin-top: 26px; font-family:${FONT}; font-size:11px; letter-spacing: 0.18em; text-transform: uppercase; color:#5eead4;">${esc(e.eyebrow)}</div>
        <div style="margin-top: 8px; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; line-height: 1.25; color:#ffffff;">${esc(e.headline)}</div>
        ${e.sub ? `<div style="margin-top: 8px; font-family:${FONT}; font-size:13px; color:#94a3b8;">${esc(e.sub)}</div>` : ''}
      </td></tr>
      <tr><td style="background:#ffffff; padding: 30px 36px 28px; border-left:1px solid #e2e8f0; border-right:1px solid #e2e8f0;">
        ${e.body}
      </td></tr>
      <tr><td style="background:#ffffff; padding: 18px 36px 24px; border: 1px solid #e2e8f0; border-top: 1px solid #eef2f7; border-radius: 0 0 10px 10px; font-family:${FONT}; font-size:12px; line-height:1.6; color:#64748b;">
        Solidus by Ambrosia Ventures · <a href="${SITE}" style="color:#0f766e; text-decoration:none;">solidus.ambrosiaventures.co</a> · <a href="https://ambrosiaventures.co" style="color:#0f766e; text-decoration:none;">ambrosiaventures.co</a><br>
        Ambrosia Ventures is a strategy and transaction advisory firm. This email and any brief it links to are confidential to the addressee.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
