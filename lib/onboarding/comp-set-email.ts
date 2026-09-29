/**
 * "Your comp set" email. A short personal note that links to the comp set
 * report (/comps/<token>, lib/onboarding/comp-set-report.ts): the report is
 * the deliverable, the email is the envelope. Three headline numbers give
 * the reader a reason to open it.
 */

import { envelope, p, button, factsTable, signature, esc } from '@/lib/email/brief-template';
import { SITE, fmtM, fmtPct, type CompSetReport } from '@/lib/onboarding/comp-set-report';

export type CompSetCta =
  | { kind: 'trial' }   // free user who can still start the 7-day trial
  | { kind: 'upgrade' } // free user whose trial is used
  | { kind: 'pro' };    // already on Pro (trialing or paid)

function firstName(name: string | null): string {
  const first = (name || '').trim().split(/\s+/)[0];
  return first && !first.includes('@') ? first : '';
}

export function buildCompSetEmail(input: {
  name: string | null;
  report: CompSetReport;
  reportUrl: string;
  cta: CompSetCta;
}): { subject: string; html: string } {
  const { report, reportUrl, cta } = input;
  const { program, headline } = report;
  const ind = program.indicationLabel;
  const n = report.rows.length;
  const same = report.sameIndicationCount;
  const programText = `${program.phaseLabel} ${program.modalityLabel ? `${program.modalityLabel} ` : ''}program in ${ind}`;
  const hi = firstName(input.name);

  const facts: Array<[string, string]> = [];
  if (headline.upfront) facts.push(['Median upfront', `<strong>${esc(fmtM(headline.upfront.p50))}</strong> <span style="color:#64748b;">(middle half ${esc(fmtM(headline.upfront.p25))} to ${esc(fmtM(headline.upfront.p75))})</span>`]);
  if (headline.total) facts.push(['Median total value', `<strong>${esc(fmtM(headline.total.p50))}</strong> <span style="color:#64748b;">(middle half ${esc(fmtM(headline.total.p25))} to ${esc(fmtM(headline.total.p75))})</span>`]);
  if (headline.royaltyMid) facts.push(['Median royalty', `<strong>${esc(fmtPct(headline.royaltyMid.p50))}</strong>`]);
  facts.push(['Comparable deals', `${n}${same ? `, ${same} in ${esc(ind)}` : ''}; every one verified and linked to its source`]);

  const next = cta.kind === 'trial'
    ? p(`When you want to go further (every valuation engine on your program, partner matching, and an alert the day a new ${esc(ind)} deal is signed), Pro is <a href="${SITE}/trial?ref=comp_set" style="color:#0f766e;">free for 7 days</a>.`, { muted: true })
    : cta.kind === 'upgrade'
      ? p(`When you want to go further, <a href="${SITE}/pro?ref=comp_set" style="color:#0f766e;">Pro</a> adds every valuation engine, partner matching and deal alerts for ${esc(ind)}.`, { muted: true })
      : p(`Set a deal alert for ${esc(ind)} in Solidus and you will hear about the next comparable deal the day it is announced.`, { muted: true });

  const body = [
    p(hi ? `Hi ${esc(hi)},` : 'Hi,'),
    p(`You benchmarked a ${esc(programText)} on Solidus. I have put together the comparable deals a buyer will price it against. Your comp set is here:`),
    button('Open your comp set', reportUrl),
    factsTable(facts),
    p('The link works without a login, so you can forward it to a colleague or your board, and it prints to PDF if you need a copy for a deck.', { muted: true }),
    next,
    p('If a comparable looks wrong, or there is a deal we have missed, reply to this email. It comes straight to me.'),
    signature(),
  ].join('\n');

  return {
    subject: `Your ${ind} comp set: ${n} comparable deals`,
    html: envelope({
      eyebrow: 'Your comp set',
      headline: `${n} deals like your ${program.phaseLabel} ${ind} program`,
      sub: headline.upfront ? `Median upfront ${fmtM(headline.upfront.p50)} · every deal verified and sourced` : 'Every deal verified and sourced',
      preheader: headline.upfront
        ? `Comparable ${ind} deals: median upfront ${fmtM(headline.upfront.p50)}${headline.total ? `, median total ${fmtM(headline.total.p50)}` : ''}. Open the full set.`
        : `The comparable deals behind your ${ind} benchmark.`,
      body,
    }),
  };
}
