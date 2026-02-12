import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { checkRateLimit, getIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'promo_validate', { limit: 10, windowSeconds: 60 });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { valid: false, error: 'Too many attempts. Please wait a moment.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!stripeSecretKey) {
      return NextResponse.json({ valid: false, error: 'Payment system not configured' }, { status: 500 });
    }

    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Code is required' }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();
    const stripe = new Stripe(stripeSecretKey);

    // Look up active promotion codes matching this code string
    const promoCodes = await stripe.promotionCodes.list({
      code: normalizedCode,
      active: true,
      limit: 1,
    });

    if (promoCodes.data.length === 0) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired promo code' });
    }

    const promo = promoCodes.data[0];
    if (!promo.active) {
      return NextResponse.json({ valid: false, error: 'This promo code is no longer active' });
    }

    // Get coupon details for discount info
    const rawCoupon = promo.promotion?.coupon;
    const coupon = typeof rawCoupon === 'string'
      ? await stripe.coupons.retrieve(rawCoupon)
      : rawCoupon;

    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'Promo code has no associated discount' });
    }

    return NextResponse.json({
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
    return NextResponse.json({ valid: false, error: 'Failed to validate promo code' }, { status: 500 });
  }
}
