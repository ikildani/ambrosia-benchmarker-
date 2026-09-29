/**
 * Emails for the card-required Pro trial (2026-09-29).
 *
 * Two messages, both sent from the Stripe webhook:
 *   - trial started: what Pro gives them this week, and exactly when and how
 *     much the card is charged;
 *   - trial ending (customer.subscription.trial_will_end, 3 days out): the
 *     charge date again and a one-click way to cancel.
 *
 * Stating the charge up front is what keeps a card trial from turning into a
 * refund request or a chargeback.
 */

import { envelope, p, button, factsTable, callout, signature, esc } from '@/lib/email/brief-template';
import { DEAL_STATS } from '@/lib/config/constants';

const SITE = 'https://solidus.ambrosiaventures.co';
export const MANAGE_BILLING_URL = `${SITE}/dashboard?tab=settings`;

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "$299.00 per month" from a Stripe price amount in cents. */
export function formatPlanAmount(amountCents: number | null | undefined, interval: string | null | undefined, currency = 'usd'): string {
  if (amountCents == null) return 'the Pro plan price';
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amountCents / 100);
  return interval === 'year' ? `${money} per year` : `${money} per month`;
}

function firstName(name: string | null | undefined): string {
  const first = (name || '').trim().split(/\s+/)[0];
  return first && !first.includes('@') ? first : 'there';
}

export function buildCardTrialStartedEmail(opts: {
  name?: string | null;
  chargesOn: Date;
  amountLabel: string;
}): { subject: string; html: string } {
  const body = [
    p(`Hi ${esc(firstName(opts.name))},`),
    p(`Your 7-day Pro trial is on. Everything in Solidus is open to you: all ${esc(DEAL_STATS.TOTAL_DEALS)} deal comparables with their sources, the full calculator, partner matching, and deal alerts.`),
    factsTable([
      ['Charged today', '$0.00'],
      ['Trial ends', esc(fmtDate(opts.chargesOn))],
      ['Then', esc(opts.amountLabel)],
      ['Reminder', 'We email you 3 days before the first charge'],
    ]),
    p('<strong>Three things worth doing this week:</strong>'),
    p(`1. Benchmark the asset you are working on. You get upfront, milestone and royalty ranges from comparable deals, each linked to its source.<br>
2. Set a deal alert for your indication, so you hear about the next comparable deal the day it is announced.<br>
3. Open the comparables behind your numbers and export them for your deal memo.`),
    button('Benchmark your asset', `${SITE}/calculator`),
    callout(`Not for you? Cancel any time before ${esc(fmtDate(opts.chargesOn))} from <a href="${MANAGE_BILLING_URL}" style="color:#0f766e;">your account settings</a> and you will not be charged.`),
    signature(),
  ].join('\n');

  return {
    subject: 'Your Solidus Pro trial is on',
    html: envelope({
      eyebrow: 'Solidus Pro trial',
      headline: 'Your 7-day Pro trial is on',
      sub: `Nothing is charged until ${fmtDate(opts.chargesOn)}.`,
      preheader: `$0 today. Your trial runs until ${fmtDate(opts.chargesOn)}; we remind you 3 days before.`,
      body,
    }),
  };
}

export function buildTrialEndingEmail(opts: {
  name?: string | null;
  chargesOn: Date;
  amountLabel: string;
}): { subject: string; html: string } {
  const body = [
    p(`Hi ${esc(firstName(opts.name))},`),
    p(`A reminder, as promised: your Solidus Pro trial ends on <strong>${esc(fmtDate(opts.chargesOn))}</strong>, and the card on file will then be charged ${esc(opts.amountLabel)}.`),
    p('If you want to keep Pro, there is nothing to do. Your comparables, saved analyses and deal alerts carry on as they are.'),
    button('Keep using Solidus', `${SITE}/calculator`),
    callout(`Want to stop? Cancel from <a href="${MANAGE_BILLING_URL}" style="color:#0f766e;">your account settings</a> before ${esc(fmtDate(opts.chargesOn))} and you will not be charged. Or reply to this email and I will cancel it for you.`),
    signature(),
  ].join('\n');

  return {
    subject: `Your Solidus Pro trial ends ${fmtDate(opts.chargesOn)}`,
    html: envelope({
      eyebrow: 'Solidus Pro trial',
      headline: 'Your trial ends in 3 days',
      sub: `First charge: ${opts.amountLabel}, on ${fmtDate(opts.chargesOn)}.`,
      preheader: `Your card is charged ${opts.amountLabel} on ${fmtDate(opts.chargesOn)} unless you cancel.`,
      body,
    }),
  };
}
