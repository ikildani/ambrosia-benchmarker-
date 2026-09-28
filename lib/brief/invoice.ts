/**
 * Stripe invoice for a Deal Intelligence Brief.
 *
 * The intake promises "an invoice within one business day". Until now that
 * meant a hand-written one. This creates a Stripe-hosted invoice on the
 * account's own branding (logo, colours and business details are set once in
 * the Stripe dashboard), emails it to the billing contact with card and bank
 * payment, and lets Stripe chase it. The webhook marks the request paid when
 * invoice.payment_succeeded arrives with our metadata.
 *
 * One invoice per request: a second call returns the existing one.
 */
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BENCHMARK_PRICING } from '@/lib/config/constants';

export const BRIEF_INVOICE_DAYS_UNTIL_DUE = 14;
/**
 * Wire / ACH instructions printed in the invoice footer, from the environment
 * so bank details never live in the repository. Multi-line; use \n between
 * lines. Example: "Wire / ACH: Bank name · Account name: Ambrosia Ventures LLC
 * · Routing (ABA) 000000000 · Account 000000000 · SWIFT XXXXUS33 · Reference
 * the invoice number."
 */
export const WIRE_INSTRUCTIONS_ENV = 'BRIEF_WIRE_INSTRUCTIONS';
export const BRIEF_INVOICE_METADATA_KEY = 'brief_request_id';

interface RequestRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  asset_name: string | null;
  indication: string;
  phase: string;
  billing_entity: string | null;
  billing_email: string | null;
  billing_address: string | null;
  po_number: string | null;
  stripe_invoice_id: string | null;
  invoice_url: string | null;
  invoice_number: string | null;
}

export interface BriefInvoiceResult {
  invoiceId: string;
  number: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
  amountDue: number;
  customerId: string;
  alreadyExisted: boolean;
}

/** What the client sees on the line item and the invoice memo. Pure; exported for tests. */
export function briefInvoiceCopy(row: Pick<RequestRow, 'asset_name' | 'indication' | 'phase' | 'company' | 'po_number'>, wireInstructions: string | null = process.env[WIRE_INSTRUCTIONS_ENV] ?? null): { lineItem: string; description: string; footer: string; customFields: Array<{ name: string; value: string }> } {
  const asset = row.asset_name ? `${row.asset_name} (${row.indication}, ${row.phase})` : `${row.indication} (${row.phase})`;
  const wire = (wireInstructions ?? '').replace(/\\n/g, '\n').trim();
  return {
    lineItem: `Deal Intelligence Brief — ${asset}`,
    description: `One asset, one signed recommendation: the ask, the floor, the walk-away and the counterparties, delivered to a private data room within 24 hours of the intake call, with a 30-minute walkthrough.`,
    footer: [
      `Payable within ${BRIEF_INVOICE_DAYS_UNTIL_DUE} days by card or bank debit through this invoice, or by wire / ACH to the account below. Please reference the invoice number.`,
      wire || null,
      'This fee is credited in full against a subsequent advisory mandate with Ambrosia Ventures. Questions: ikildani@ambrosiaventures.co',
    ].filter(Boolean).join('\n\n').slice(0, 5000),
    customFields: row.po_number ? [{ name: 'PO number', value: row.po_number.slice(0, 30) }] : [],
  };
}

async function findOrCreateCustomer(stripe: Stripe, row: RequestRow): Promise<string> {
  const email = (row.billing_email || row.email).trim().toLowerCase();
  const name = (row.billing_entity || row.company || row.name).trim();
  const existing = await stripe.customers.list({ email, limit: 3 });
  const match = existing.data.find(c => !c.deleted) ?? null;
  if (match) {
    // Keep the billing entity current on the customer the invoice will name.
    if (name && match.name !== name) await stripe.customers.update(match.id, { name });
    return match.id;
  }
  const created = await stripe.customers.create({
    email,
    name,
    description: row.company && row.company !== name ? `${row.company} · ${row.name}` : row.name,
    metadata: { source: 'brief_intake', [BRIEF_INVOICE_METADATA_KEY]: row.id },
    ...(row.billing_address ? { address: { line1: row.billing_address.slice(0, 200) } } : {}),
  });
  return created.id;
}

export async function createBriefInvoice(stripe: Stripe, supabase: SupabaseClient, requestId: string): Promise<BriefInvoiceResult> {
  const { data, error } = await supabase
    .from('benchmark_requests')
    .select('id, name, email, company, asset_name, indication, phase, billing_entity, billing_email, billing_address, po_number, stripe_invoice_id, invoice_url, invoice_number')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw new Error(`load request: ${error.message}`);
  if (!data) throw new Error('request not found');
  const row = data as unknown as RequestRow;

  if (row.stripe_invoice_id) {
    const inv = await stripe.invoices.retrieve(row.stripe_invoice_id);
    return { invoiceId: inv.id, number: inv.number ?? row.invoice_number, hostedUrl: inv.hosted_invoice_url ?? row.invoice_url, pdfUrl: inv.invoice_pdf ?? null, amountDue: inv.amount_due, customerId: String(inv.customer), alreadyExisted: true };
  }

  const customerId = await findOrCreateCustomer(stripe, row);
  const copy = briefInvoiceCopy(row);

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: BRIEF_INVOICE_DAYS_UNTIL_DUE,
    description: copy.description,
    footer: copy.footer,
    custom_fields: copy.customFields.length ? copy.customFields : undefined,
    metadata: { [BRIEF_INVOICE_METADATA_KEY]: row.id, engagement: 'deal_intelligence_brief' },
    // Card and US bank debit through Stripe; wire / ACH details are in the footer for AP teams that pay directly.
    payment_settings: { payment_method_types: ['card', 'us_bank_account'] },
    auto_advance: false,
  });
  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    currency: 'usd',
    amount: BENCHMARK_PRICING.PRICE_NUM * 100,
    description: copy.lineItem,
  });
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  const sent = await stripe.invoices.sendInvoice(finalized.id);

  const now = new Date().toISOString();
  const { error: saveErr } = await supabase.from('benchmark_requests').update({
    stripe_invoice_id: sent.id,
    invoice_number: sent.number ?? null,
    invoice_url: sent.hosted_invoice_url ?? null,
    invoice_sent_at: now,
    payment_status: 'invoiced',
  }).eq('id', requestId);
  if (saveErr) throw new Error(`invoice sent (${sent.id}) but the row could not be updated: ${saveErr.message}`);

  return { invoiceId: sent.id, number: sent.number ?? null, hostedUrl: sent.hosted_invoice_url ?? null, pdfUrl: sent.invoice_pdf ?? null, amountDue: sent.amount_due, customerId, alreadyExisted: false };
}

/** Mark the request paid from a Stripe invoice event. Returns the request id when it was one of ours. */
export async function markBriefInvoicePaid(supabase: SupabaseClient, invoice: Pick<Stripe.Invoice, 'id' | 'metadata' | 'number' | 'hosted_invoice_url'>): Promise<string | null> {
  const requestId = invoice.metadata?.[BRIEF_INVOICE_METADATA_KEY];
  if (!requestId) return null;
  const { error } = await supabase.from('benchmark_requests').update({
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
    stripe_invoice_id: invoice.id,
    invoice_number: invoice.number ?? null,
    invoice_url: invoice.hosted_invoice_url ?? null,
  }).eq('id', requestId);
  if (error) throw new Error(`mark paid: ${error.message}`);
  return requestId;
}
