import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { checkRateLimit, getIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { promoValidateSchema, formatZodErrors } from '@/lib/api-validation';

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'promo_validate', { limit: 10, windowSeconds: 60 });

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders('Too many attempts. Please wait a moment.', 429, getRateLimitHeaders(rateLimitResult));
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!stripeSecretKey) {
      return apiError('Payment system not configured', 500);
    }

    const body = await request.json();
    const parsed = promoValidateSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { code } = parsed.data;
    const normalizedCode = code.trim().toUpperCase();
    const stripe = new Stripe(stripeSecretKey);

    // AMBROSIA code: 7-day free trial (handled directly, not via Stripe promo)
    if (normalizedCode === 'AMBROSIA') {
      return apiSuccess({
        valid: true,
        promoId: 'AMBROSIA',
        discount: {
          percentOff: 100,
          amountOff: null,
          duration: 'once',
          name: '7-Day Pro Trial',
        },
      });
    }

    // Look up active promotion codes matching this code string
    const promoCodes = await stripe.promotionCodes.list({
      code: normalizedCode,
      active: true,
      limit: 1,
    });

    if (promoCodes.data.length === 0) {
      return apiSuccess({ valid: false, message: 'Invalid or expired promo code' });
    }

    const promo = promoCodes.data[0];
    if (!promo.active) {
      return apiSuccess({ valid: false, message: 'This promo code is no longer active' });
    }

    // Get coupon details for discount info
    const rawCoupon = promo.promotion?.coupon;
    const coupon = typeof rawCoupon === 'string'
      ? await stripe.coupons.retrieve(rawCoupon)
      : rawCoupon;

    if (!coupon) {
      return apiSuccess({ valid: false, message: 'Promo code has no associated discount' });
    }

    return apiSuccess({
      valid: true,
      promoId: promo.id,
      discount: {
        percentOff: coupon.percent_off,
        amountOff: coupon.amount_off,
        duration: coupon.duration,
        name: coupon.name,
      },
    });
  } catch (error) {
    console.error('Promo validation error:', error);
    return apiError('Failed to validate promo code', 500);
  }
}
