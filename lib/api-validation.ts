import { z } from 'zod';

/**
 * Zod schemas for API input validation.
 * Validates calculation parameters, email, and filenames.
 */

// Calculation request — validates the core fields that affect deal computation
export const calculationRequestSchema = z.object({
  modality: z.string().min(1, 'modality is required'),
  development_phase: z.string().min(1, 'development_phase is required'),
  therapeutic_area: z.string().optional().default('oncology'),
  indication_category: z.string().optional().nullable(),
  indication_specific: z.string().optional().nullable(),
  territory_scope: z.string().optional().nullable(),
  territories_included: z.array(z.string()).optional().nullable(),
  exclusivity_type: z.string().optional().nullable(),
  deal_type: z.string().optional().nullable(),
  includes_manufacturing: z.boolean().optional().default(false),
  includes_codev: z.boolean().optional().default(false),
  includes_copromote: z.boolean().optional().default(false),
  session_id: z.string().optional().nullable(),
  anonymous_id: z.string().optional().nullable(),
  outputs: z.object({
    upfront_low: z.number().optional().nullable(),
    upfront_mid: z.number().optional().nullable(),
    upfront_high: z.number().optional().nullable(),
    milestones_total: z.number().optional().nullable(),
    royalty_low: z.number().optional().nullable(),
    royalty_high: z.number().optional().nullable(),
    total_deal_value_low: z.number().optional().nullable(),
    total_deal_value_high: z.number().optional().nullable(),
  }).optional().nullable(),
}).strip(); // Silently strip extra fields for safety

// Report email request
export const reportEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  pdfBase64: z.string().min(1, 'PDF data is required').max(10_000_000, 'PDF too large (max ~7.5MB)'),
  fileName: z.string()
    .min(1, 'Filename is required')
    .transform(name => name.replace(/[^a-zA-Z0-9._\-() ]/g, '_')), // Sanitize
  indication: z.string().optional().default(''),
});

/**
 * Parse + clamp an integer query parameter.
 * Prevents DoS via ?limit=999999999 and ensures sane defaults.
 */
export function clampInt(value: string | null | undefined, min: number, max: number, fallback: number): number {
  if (value == null) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Hash an email for safe storage in analytics/events.
 * Uses Web Crypto API (available in Node 18+ and Edge Runtime).
 */
export async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Zod schemas for API routes ---

// Deals GET query params
export const dealsQuerySchema = z.object({
  therapeutic_area: z.string().optional(),
  modality: z.string().optional(),
  phase: z.string().optional(),
  indication: z.string().optional(),
  deal_type: z.string().optional(),
  min_upfront: z.string().regex(/^\d+$/, 'min_upfront must be a number').optional(),
  max_upfront: z.string().regex(/^\d+$/, 'max_upfront must be a number').optional(),
  year_from: z.string().regex(/^\d{4}$/, 'year_from must be a 4-digit year').optional(),
  year_to: z.string().regex(/^\d{4}$/, 'year_to must be a 4-digit year').optional(),
  terms_disclosed: z.enum(['true']).optional(),
  search: z.string().max(100, 'search must be at most 100 characters').optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sort_by: z.enum([
    'announced_date', 'upfront_usd', 'total_deal_value_usd',
    'licensor_name', 'licensee_name', 'asset_name', 'modality', 'phase_at_signing',
  ]).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
}).strip(); // Silently strip extra fields for safety

// Partners match POST body
export const partnerMatchSchema = z.object({
  modality: z.string().min(1, 'modality is required'),
  development_phase: z.string().min(1, 'development_phase is required'),
  indication_category: z.string().optional().nullable(),
  indication_specific: z.string().optional().nullable(),
  territory_scope: z.string().optional().nullable(),
  therapeutic_area: z.string().optional().nullable(),
  regulatory_designations: z.object({
    breakthrough: z.boolean().optional(),
    fastTrack: z.boolean().optional(),
    orphan: z.boolean().optional(),
    prime: z.boolean().optional(),
  }).optional().nullable(),
  // Desired deal structure (licensing, acquisition, codevelopment, option, collaboration).
  // Used to filter and weight partner matches by historical deal-type preference.
  dealType: z.string().optional().nullable(),
  user_id: z.string().optional().nullable(),
  user_email: z.string().optional().nullable(),
  calculation_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  anonymous_id: z.string().optional().nullable(),
  tier: z.string().optional(), // accepted but ignored (security)
}).strip();

// Pulse GET query params
export const pulseQuerySchema = z.object({
  history: z.enum(['true']).optional(),
  user_id: z.string().optional().nullable(),
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'week must be YYYY-MM-DD format').optional(),
}).strip();

// Content GET query params
export const contentQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
}).strip();

// Content POST body
export const contentPostSchema = z.object({
  title: z.string().min(1, 'title is required'),
  content: z.string().min(1, 'content is required'),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  meta_description: z.string().optional(),
  category: z.string().optional(),
  tags: z.unknown().optional(),
  modality: z.unknown().optional(),
  indication: z.unknown().optional(),
  ai_generated: z.boolean().optional(),
}).strip();

// Events POST body
export const eventSchema = z.object({
  event_type: z.string().min(1, 'event_type is required'),
  event_data: z.record(z.string(), z.unknown()).default({}),
  session_id: z.string().optional().nullable(),
  anonymous_id: z.string().optional().nullable(),
  user_id: z.string().optional().nullable(),
});

// Checkout POST body
export const checkoutSchema = z.object({
  email: z.string().email().optional(),
  purchaseType: z.enum(['subscription', 'report']).default('subscription'),
  billingInterval: z.enum(['monthly', 'annual']).default('monthly'),
  promoCode: z.string().optional(),
  shareToken: z.string().optional(),
  calculationData: z.object({
    inputs: z.record(z.string(), z.unknown()),
    results: z.record(z.string(), z.unknown()),
  }).optional(),
}).refine(
  (data) => data.purchaseType !== 'report' || data.calculationData,
  { message: 'calculationData is required for report purchases', path: ['calculationData'] }
);

// Deal memo POST body
export const dealMemoSchema = z.object({
  reportId: z.string().optional(),
  inputs: z.record(z.string(), z.unknown()),
  results: z.record(z.string(), z.unknown()),
  labels: z.object({
    phase: z.string(),
    modality: z.string(),
    indication: z.string(),
  }),
  email: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
});

// Playbook POST body
export const playbookSchema = z.object({
  inputs: z.object({
    modality: z.string().min(1, 'modality is required'),
    phase: z.string().min(1, 'phase is required'),
    indication: z.string().min(1, 'indication is required'),
    territory: z.string().min(1, 'territory is required'),
    therapeuticArea: z.string().optional(),
  }),
  results: z.object({
    terms: z.record(z.string(), z.unknown()),
    tieredRoyalties: z.record(z.string(), z.unknown()),
    dealRecommendation: z.record(z.string(), z.unknown()),
    negotiationInsight: z.string().optional(),
    modifiers: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
  labels: z.object({
    phase: z.string(),
    modality: z.string(),
    indication: z.string(),
  }),
  userId: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  reportId: z.string().optional().nullable(),
});

// Share POST body
export const shareSchema = z.object({
  email: z.string().optional().nullable(),
  inputs: z.record(z.string(), z.unknown()),
  results: z.record(z.string(), z.unknown()),
  labels: z.record(z.string(), z.unknown()).optional(),
  tier: z.string().optional(), // accepted but ignored (security)
  expiresIn: z.enum(['7d', '30d', '90d']).optional().nullable(),
});

// Session POST body
export const sessionCreateSchema = z.object({
  anonymous_id: z.string().min(1, 'anonymous_id is required'),
  user_id: z.string().optional().nullable(),
  device_type: z.enum(['desktop', 'tablet', 'mobile']).optional().nullable(),
  referrer_url: z.string().optional().nullable(),
  utm_source: z.string().optional().nullable(),
  utm_medium: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
});

// Session PATCH body
export const sessionUpdateSchema = z.object({
  session_id: z.string().min(1, 'session_id is required'),
  user_id: z.string().optional().nullable(),
  ended_at: z.string().optional().nullable(),
  duration_seconds: z.number().optional().nullable(),
  calculation_count: z.number().optional().nullable(),
  paywall_hits: z.number().optional().nullable(),
});

// Watchlist GET query params
export const watchlistQuerySchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
}).strip();

// Watchlist POST body
export const watchlistAddSchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  item_type: z.enum(['modality', 'indication', 'company', 'therapeutic_area']),
  item_value: z.string().min(1, 'item_value is required'),
  company_id: z.string().optional().nullable(),
});

// Watchlist DELETE query params
export const watchlistDeleteSchema = z.object({
  id: z.string().min(1, 'id is required'),
  user_id: z.string().min(1, 'user_id is required'),
}).strip();

// Scenarios POST body (email comes from authenticated session, not body)
export const scenarioCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  notes: z.string().optional().nullable(),
  inputs: z.record(z.string(), z.unknown()),
  results: z.record(z.string(), z.unknown()),
  labels: z.record(z.string(), z.unknown()).optional(),
}).strip();

// Newsletter POST body
export const newsletterSchema = z.object({
  email: z.string().email('Valid email is required'),
});

// Promo validate POST body
export const promoValidateSchema = z.object({
  code: z.string().min(1, 'Code is required'),
});

/** Format Zod validation errors into a concise string. */
export function formatZodErrors(error: z.ZodError): string {
  return error.issues.map(i =>
    i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message
  ).join('; ');
}

// Profile PATCH body
export const profileUpdateSchema = z.object({
  full_name: z.string().max(100, 'Name must be under 100 characters').optional(),
  company_name: z.string().max(200, 'Company name must be under 200 characters').optional(),
  job_title: z.string().max(100, 'Job title must be under 100 characters').optional(),
  phone_number: z.string()
    .max(30, 'Phone number too long')
    .regex(/^[\d\s\-+().]*$/, 'Invalid phone number format')
    .optional(),
  linkedin_url: z.string()
    .max(300, 'LinkedIn URL too long')
    .refine(
      (val) => !val || val.startsWith('https://linkedin.com/') || val.startsWith('https://www.linkedin.com/'),
      'Must be a valid LinkedIn URL'
    )
    .optional(),
  deal_role: z.string().max(50, 'Deal role too long').optional(),
  avatar_gradient: z.string().max(100, 'Gradient value too long').optional(),
}).strip();

// Email send POST body
export const emailSendSchema = z.object({
  email: z.string().email('Invalid email address'),
  type: z.enum(['welcome', 'calculation_receipt', 'upgrade_confirmation']),
  name: z.string().max(100, 'Name too long').optional().default('there'),
  data: z.object({
    modality: z.string().max(100).optional(),
    phase: z.string().max(100).optional(),
    indication: z.string().max(100).optional(),
    upfront: z.string().max(50).optional(),
    totalValue: z.string().max(50).optional(),
  }).optional(),
}).strip();

/**
 * Sanitize a number: returns fallback if NaN, Infinity, or -Infinity.
 * Use at system boundaries to guarantee clean numeric output.
 */
export function safeNumber(value: number, fallback: number = 0): number {
  return Number.isFinite(value) ? value : fallback;
}
