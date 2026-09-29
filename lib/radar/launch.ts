/**
 * Search & Evaluation launch gate (client-safe, no server imports).
 *
 * Public: NEXT_PUBLIC_RADAR_ENABLED=true (or development with the flag unset).
 * Internal preview: before the flag is on, signed-in @ambrosiaventures.co
 * accounts and any address in NEXT_PUBLIC_RADAR_PREVIEW_EMAILS see the module
 * in production; everyone else gets a 404 and no marketing mentions.
 */

export const RADAR_PUBLIC =
  process.env.NEXT_PUBLIC_RADAR_ENABLED === 'true' ||
  (!process.env.NEXT_PUBLIC_RADAR_ENABLED && process.env.NODE_ENV === 'development');

export const RADAR_PREVIEW_DOMAIN = '@ambrosiaventures.co';

const PREVIEW_EMAILS: string[] = (process.env.NEXT_PUBLIC_RADAR_PREVIEW_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export function isRadarPreviewEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e.endsWith(RADAR_PREVIEW_DOMAIN) || PREVIEW_EMAILS.includes(e);
}

/** Whether this viewer may see the module (public launch, or internal preview). */
export function radarVisibleTo(email: string | null | undefined, isPublic = RADAR_PUBLIC): boolean {
  return isPublic || isRadarPreviewEmail(email);
}
