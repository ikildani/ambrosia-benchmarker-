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

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 600px; color: #1e293b; line-height: 1.6;">
      <p>Hi ${esc(first)},</p>
      <p>The Deal Intelligence Brief for ${esc(what)} is ready${pages ? ` (${pages})` : ''}. I have read it and signed the recommendation on page three.</p>
      ${room ? `<p><a href="${esc(room)}" style="display: inline-block; background: #0f766e; color: #fff; padding: 10px 22px; border-radius: 4px; text-decoration: none; font-weight: 600;">Open the brief</a></p>
      <p style="font-size: 13px; color: #64748b;">That link is your private data room; it issues a fresh download link each time you open it. Please do not forward it outside the team that needs the number.</p>` : ''}
      ${links.pdfUrl ? `<p style="font-size: 13px; color: #64748b;">Direct PDF link (valid 30 days): <a href="${esc(links.pdfUrl)}">download</a>${links.excelUrl ? ` · Excel data export: <a href="${esc(links.excelUrl)}">download</a>` : ''}</p>` : ''}
      <p><strong>How to read it.</strong> Start with page three: the recommendation, the ask, the floor and the walk-away, and who to open with. Pages five and eight show where the number comes from (the valuation bridge and the cited comparable set). The buyer map, the catalyst calendar, the objections and the diligence list follow. Every figure that appears on more than one page comes from one place.</p>
      <p><strong>Walkthrough.</strong> Reply with two or three times that work for you this week or next and we will go through the pages together and turn them into the position you take into the room.</p>
      <p>The fee for this brief is credited in full against any advisory mandate that follows.</p>
      <p style="margin-top: 24px;">Best,<br><strong>Issa Kildani</strong><br>Managing Partner, Ambrosia Ventures<br>ikildani@ambrosiaventures.co</p>
    </div>`;

  return { subject: briefSubjectLine(row), html };
}
