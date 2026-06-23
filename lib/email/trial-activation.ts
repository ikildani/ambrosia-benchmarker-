import { sendEmail } from './client';

const LOGO_URL = 'https://calculator.ambrosiaventures.co/logo.png';
const APP_URL = 'https://calculator.ambrosiaventures.co';

function header(title: string, subtitle?: string): string {
  return `
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 40px 24px; border-radius: 16px 16px 0 0; text-align: center;">
      <img src="${LOGO_URL}" alt="Ambrosia Ventures" style="height: 36px; margin-bottom: 20px;" />
      <h1 style="color: #fff; margin: 0; font-size: 26px; font-weight: 700;">${title}</h1>
      ${subtitle ? `<p style="color: #94a3b8; margin: 10px 0 0; font-size: 14px;">${subtitle}</p>` : ''}
    </div>`;
}

function cta(text: string, href: string): string {
  return `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${href}" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
        ${text}
      </a>
    </div>`;
}

function footer(): string {
  return `
    <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
      <p style="margin: 0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6;">ambrosiaventures.co</a></p>
    </div>`;
}

function wrap(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 16px;">
      ${content}
    </body></html>`;
}

function body(html: string): string {
  return `<div style="background: #fff; padding: 32px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">${html}</div>`;
}

export async function sendTrialWelcome(to: string, name: string, ta?: string) {
  const taLine = ta ? `Based on your interest in <strong>${ta}</strong>, here are 3 calculations to try:` : 'Here are 3 calculations to get you started:';
  const html = wrap(`
    ${header('Welcome to Pro', 'Your 7-day trial is active')}
    ${body(`
      <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
      <p style="font-size: 15px; color: #334155;">Your Pro trial is live. You now have full access to all 14 engines — rNPV, Monte Carlo, partner matching, deal memos, and more.</p>
      <p style="font-size: 15px; color: #334155;">${taLine}</p>
      <ol style="font-size: 14px; color: #334155; padding-left: 20px;">
        <li style="margin-bottom: 8px;"><strong>Run a deal benchmark</strong> — enter your asset's phase, modality, and indication to get instant deal terms</li>
        <li style="margin-bottom: 8px;"><strong>Generate a deal memo</strong> — AI-written institutional-quality memo for your board or IC</li>
        <li style="margin-bottom: 8px;"><strong>Match with partners</strong> — see which of 850+ companies are the best fit for your asset</li>
      </ol>
      ${cta('Run Your First Calculation', `${APP_URL}/calculator`)}
      <p style="font-size: 14px; color: #64748b;">Questions? Reply to this email — we respond within 24 hours.</p>
    `)}
    ${footer()}
  `);
  return sendEmail({ to, subject: 'Your Pro trial is active — run your first deal analysis', html });
}

export async function sendTrialDay2(to: string, name: string, calcCount: number) {
  const hasCalcs = calcCount > 0;
  const html = wrap(`
    ${header(hasCalcs ? 'Your Deal Analysis is Ready' : 'Day 2 — Have You Tried This?', 'Pro Trial')}
    ${body(`
      <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
      ${hasCalcs
        ? `<p style="font-size: 15px; color: #334155;">You've run <strong>${calcCount} calculation${calcCount > 1 ? 's' : ''}</strong> so far. Here's what else you can do with Pro:</p>
           <ul style="font-size: 14px; color: #334155; padding-left: 20px;">
             <li style="margin-bottom: 6px;">Download a <strong>branded PDF report</strong> for your board deck</li>
             <li style="margin-bottom: 6px;">Compare <strong>bear/base/bull scenarios</strong> side by side</li>
             <li style="margin-bottom: 6px;">See <strong>buyer-specific valuations</strong> — what would AbbVie vs Pfizer pay?</li>
           </ul>`
        : `<p style="font-size: 15px; color: #334155;">You haven't run your first Pro calculation yet. It takes 2 minutes and gives you institutional-grade deal benchmarks.</p>
           <p style="font-size: 15px; color: #334155;">Here's a quick walkthrough:</p>
           <ol style="font-size: 14px; color: #334155; padding-left: 20px;">
             <li style="margin-bottom: 6px;">Select your modality, phase, and therapeutic area</li>
             <li style="margin-bottom: 6px;">Click "Calculate" — results appear instantly</li>
             <li style="margin-bottom: 6px;">Scroll down to see partner matches, deal memo, and competitive landscape</li>
           </ol>`
      }
      ${cta(hasCalcs ? 'Explore More Pro Features' : 'Run Your First Calculation', `${APP_URL}/calculator`)}
    `)}
    ${footer()}
  `);
  return sendEmail({ to, subject: hasCalcs ? 'Your deal analysis is ready' : 'Your Pro trial — day 2 checklist', html });
}

export async function sendTrialDay5(to: string, name: string, calcCount: number) {
  const html = wrap(`
    ${header('2 Days Left on Your Trial', 'Act now to keep full access')}
    ${body(`
      <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
      <p style="font-size: 15px; color: #334155;">Your Pro trial ends in <strong>2 days</strong>. ${calcCount > 0 ? `You've run ${calcCount} calculation${calcCount > 1 ? 's' : ''} — here's what you'll lose:` : "Here's what you'll lose:"}</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p style="font-size: 14px; color: #991b1b; margin: 0; font-weight: 600;">When your trial expires, you lose access to:</p>
        <ul style="font-size: 13px; color: #991b1b; padding-left: 18px; margin-bottom: 0;">
          <li>rNPV modeling & Monte Carlo simulation</li>
          <li>Partner matching (850+ companies)</li>
          <li>AI deal memos & negotiation playbooks</li>
          <li>PDF report exports</li>
          <li>Scenario comparison & sensitivity analysis</li>
        </ul>
      </div>
      <p style="font-size: 15px; color: #334155;">Lock in Pro now and keep everything:</p>
      ${cta('Upgrade to Pro — $199/mo annual', `${APP_URL}/pro`)}
      <p style="font-size: 13px; color: #64748b; text-align: center;">Cancel anytime. No long-term commitment.</p>
    `)}
    ${footer()}
  `);
  return sendEmail({ to, subject: '2 days left on your Pro trial', html });
}

export async function sendTrialExpired(to: string, name: string, calcCount: number) {
  const html = wrap(`
    ${header('Your Pro Access Has Expired', 'Reactivate anytime')}
    ${body(`
      <p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
      <p style="font-size: 15px; color: #334155;">Your 7-day Pro trial has ended.${calcCount > 0 ? ` During your trial, you ran ${calcCount} calculation${calcCount > 1 ? 's' : ''}.` : ''}</p>
      <p style="font-size: 15px; color: #334155;">You can still use the basic calculator, but partner matching, deal memos, PDF exports, and advanced analytics are now locked.</p>
      <p style="font-size: 15px; color: #334155; font-weight: 600;">Pick up where you left off:</p>
      ${cta('Reactivate Pro', `${APP_URL}/pro`)}
      <p style="font-size: 13px; color: #64748b; text-align: center;">$299/mo or $199/mo annual — cancel anytime.</p>
    `)}
    ${footer()}
  `);
  return sendEmail({ to, subject: 'Your Pro access has expired — reactivate now', html });
}
