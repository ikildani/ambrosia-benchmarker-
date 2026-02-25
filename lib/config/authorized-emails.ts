/**
 * Centralized configuration for authorized email lists.
 * All email lists are loaded from environment variables to avoid hardcoding.
 */

// Admin emails - users with full admin access to content management, etc.
export const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(e => e.length > 0);

// Pro emails - users who get pro tier access regardless of subscription status
// (e.g., team members, beta testers)
// Check both PRO_EMAILS (server-only) and NEXT_PUBLIC_PRO_EMAILS (shared) to avoid env var mismatch
export const PRO_EMAILS: string[] = [
  ...new Set([
    ...(process.env.PRO_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0),
    ...(process.env.NEXT_PUBLIC_PRO_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0),
  ])
];

/**
 * Check if an email has admin access
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/**
 * Check if an email has pro access via the PRO_EMAILS list
 */
export function isProEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return PRO_EMAILS.includes(email.toLowerCase().trim());
}
