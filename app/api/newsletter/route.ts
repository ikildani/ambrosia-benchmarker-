import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { newsletterSchema, formatZodErrors } from '@/lib/api-validation';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limiting — prevent spam signups
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'newsletter', { limit: 5, windowSeconds: 60 });

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many requests', 429, getRateLimitHeaders(rateLimitResult));
  }

  try {
    const body = await request.json();
    const parsed = newsletterSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { email } = parsed.data;
    const source = body.source || 'blog';
    const calculationContext = body.calculation_context || null;

    const supabase = createServiceClient();

    // Check if already subscribed
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      // Update with latest context even if already subscribed
      if (calculationContext) {
        await supabase
          .from('newsletter_subscribers')
          .update({
            metadata: calculationContext,
            source: source,
          })
          .eq('email', email.toLowerCase());
      }
      return apiSuccess({ message: 'Already subscribed' });
    }

    // Insert new subscriber with full context for AlaricAI pipeline
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: email.toLowerCase(),
        source: source,
        subscribed_at: new Date().toISOString(),
        metadata: calculationContext,
        drip_day0_sent: true,
        drip_day3_sent: false,
        drip_day5_sent: false,
        drip_completed: false,
      });

    // Send Day 0 drip email immediately (fire and forget)
    if (!error) {
      import('@/lib/email/drip-sequences').then(({ buildDay0Email }) => {
        import('@/lib/email/client').then(({ sendEmail: send }) => {
          const { subject, html } = buildDay0Email(email, calculationContext);
          send({ to: email.toLowerCase(), subject, html }).catch(() => {});
        });
      }).catch(() => {});
    }

    if (error) {
      console.error('Newsletter subscription error:', error);
      return apiError('Subscription failed', 500);
    }

    return apiSuccess({});
  } catch (error) {
    console.error('Newsletter error:', error);
    return apiError('Internal server error', 500);
  }
}
