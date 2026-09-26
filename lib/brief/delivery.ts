/**
 * Deal Intelligence Brief — delivery helpers shared by the generate route and
 * the data-room page.
 *
 * The brief is confidential. Files live in the private `reports` bucket and
 * are reached only through signed URLs minted on demand from the storage
 * paths kept on `benchmark_requests`. The data-room page mints a fresh pair
 * on every visit, so a link in an old email keeps working after the 30-day
 * signature in that email has expired.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { envelope, stepper, button, signature, p, esc } from '@/lib/email/brief-template';

export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SITE_URL = 'https://solidus.ambrosiaventures.co';

/** Columns the delivery layer reads from benchmark_requests. */
export const DELIVERY_COLUMNS = 'id,name,email,company,asset_name,indication,phase,modality,brief_token,pdf_storage_path,excel_storage_path,brief_page_count,delivered_at,status,mp_reviewer,mp_reviewed_at,walkthrough_scheduled_at,prediction_id';

export interface BriefDeliveryRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  asset_name: string | null;
  indication: string;
  phase: string;
  modality: string | null;
  brief_token: string | null;
  pdf_storage_path: string | null;
  excel_storage_path: string | null;
  brief_page_count: number | null;
  delivered_at: string | null;
  status: string;
  mp_reviewer: string | null;
  mp_reviewed_at: string | null;
  walkthrough_scheduled_at: string | null;
  /** Migration 133: the outcome-ledger row registered at generation. */
  prediction_id?: string | null;
}

export const DELIVERED_STATUSES = new Set(['delivered', 'walkthrough_scheduled', 'walkthrough_complete']);

export function dataRoomUrl(token: string): string {
  return `${SITE_URL}/brief/r/${token}`;
}

export interface BriefLinks {
  pdfUrl: string | null;
  excelUrl: string | null;
  expiresAt: string;
}

/** Mint signed URLs for the brief's files. Never throws; a missing file yields null. */
export async function mintBriefLinks(supabase: SupabaseClient, row: Pick<BriefDeliveryRow, 'pdf_storage_path' | 'excel_storage_path'>, ttlSeconds = SIGNED_URL_TTL_SECONDS): Promise<BriefLinks> {
  const sign = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    try {
      const { data, error } = await supabase.storage.from('reports').createSignedUrl(path, ttlSeconds);
      if (error || !data) return null;
      return data.signedUrl;
    } catch {
      return null;
    }
  };
  const [pdfUrl, excelUrl] = await Promise.all([sign(row.pdf_storage_path), sign(row.excel_storage_path)]);
  return { pdfUrl, excelUrl, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() };
}

export function briefSubjectLine(row: Pick<BriefDeliveryRow, 'asset_name' | 'indication' | 'phase'>): string {
  const what = row.asset_name ? `${row.asset_name} (${row.indication}, ${row.phase})` : `${row.indication} (${row.phase})`;
  return `Your Deal Intelligence Brief — ${what}`;
}

/**
 * The client delivery email. Plain, specific, signed. No booking widget is
 * wired yet, so the walkthrough is arranged by reply.
 */
export function buildDeliveryEmail(row: BriefDeliveryRow, links: BriefLinks): { subject: string; html: string } {
  const first = (row.name || '').trim().split(/\s+/)[0] || 'there';
  const what = row.asset_name ? `${row.asset_name} in ${row.indication}` : `your ${row.phase} ${row.indication} asset`;
  const room = row.brief_token ? dataRoomUrl(row.brief_token) : null;
  const pages = row.brief_page_count ? `${row.brief_page_count} pages` : null;

  const body = `
    ${p(`Hi ${esc(first)},`)}
    ${p(`The Deal Intelligence Brief for <strong>${esc(what)}</strong> is ready${pages ? ` (${pages})` : ''}. I have read it and signed the recommendation on page three.`)}
    ${room ? button('Open your data room', room) : ''}
    ${room ? p(`That link is your private data room. It holds the PDF, the Excel with the data behind every figure, and the status of the call as it is scored. It issues fresh download links each time you open it. Please keep it to the team that needs the number.`, { muted: true }) : ''}
    ${links.pdfUrl ? p(`Direct links, valid 30 days: <a href="${esc(links.pdfUrl)}" style="color:#0f766e;">PDF</a>${links.excelUrl ? ` · <a href="${esc(links.excelUrl)}" style="color:#0f766e;">Excel</a>` : ''}.`, { muted: true }) : ''}
    ${p(`<strong>How to read it.</strong> Start with page three: the recommendation, the ask, the floor and the walk-away, and who to open with. Page four says how that call will be scored. The valuation bridge and the cited comparable set show where the number comes from. The term sheet, buyer map, catalyst calendar, objections and diligence list follow. Every figure that appears on more than one page comes from one place, and the Excel opens on the same decision.`)}
    ${stepper([
      { title: 'Intake', body: 'Received.', done: true },
      { title: 'Invoice', body: 'Sent.', done: true },
      { title: 'Intake call', body: 'Done, with the draft in front of us.', done: true },
      { title: 'Brief delivered', body: 'Reviewed and signed by the Managing Partner; in your data room now.', done: true },
      { title: '30-minute walkthrough', body: 'Reply with two or three times that work this week or next. We go through the pages together and turn them into the position you take into the room.', now: true },
      { title: 'Scoring', body: 'The call is registered in the Solidus outcome ledger. You hear from us at day 45 and day 120, and whenever a catalyst, buyer move or new comparable touches the decision while it is live.' },
    ])}
    ${p(`The fee for this brief is credited in full against a subsequent advisory mandate.`, { muted: true })}
    ${signature()}`;

  const html = envelope({
    eyebrow: 'Deal Intelligence Brief · delivered',
    headline: `${row.asset_name ? `${row.asset_name}: ` : ''}the brief is ready`,
    sub: `${row.indication} · ${row.phase}${row.company ? ` · ${row.company}` : ''}`,
    body,
    preheader: `Your brief for ${what} is in your data room. Reply with times for the walkthrough.`,
  });

  return { subject: briefSubjectLine(row), html };
}
