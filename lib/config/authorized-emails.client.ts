/**
 * Client-side configuration for authorized email lists.
 * Uses NEXT_PUBLIC_ env vars which are exposed to the browser.
 *
 * SECURITY NOTE: This is for UI display purposes only.
 * All Pro features MUST be verified server-side against the database.
 */

// Pro emails for client-side UI hints only
// Server-side verification is the source of truth
const PRO_EMAILS_CLIENT: string[] = (process.env.NEXT_PUBLIC_PRO_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(e => e.length > 0);

/**
 * Check if an email should show pro UI hints
 * IMPORTANT: This is for UI only - server must always verify tier
 */
export function isProEmailClient(email: string | null | undefined): boolean {
  if (!email) return false;
  return PRO_EMAILS_CLIENT.includes(email.toLowerCase().trim());
}
