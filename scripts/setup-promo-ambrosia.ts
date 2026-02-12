/**
 * One-time setup script: creates the AMBROSIA launch promo code in Stripe.
 *
 * Usage: npx tsx scripts/setup-promo-ambrosia.ts
 *
 * Creates:
 *   1. A coupon: 100% off first month (duration: once)
 *   2. A promotion code: "AMBROSIA" linked to that coupon
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY not found in .env.local');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);

async function main() {
  // 1. Create coupon: 100% off, applies to first invoice only
  const coupon = await stripe.coupons.create({
    percent_off: 100,
    duration: 'once',
    name: 'Launch - 1 Month Free',
    metadata: {
      campaign: 'launch_email_2026',
      created_by: 'setup_script',
    },
  });
  console.log('Coupon created:', coupon.id);

  // 2. Create promotion code attached to the coupon
  const promoCode = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: coupon.id },
    code: 'AMBROSIA',
    max_redemptions: 500,
    expires_at: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
    metadata: {
      campaign: 'launch_email_2026',
    },
  });
  console.log('Promotion code created:', promoCode.id);
  console.log('');
  console.log('Done! The code AMBROSIA is now active in Stripe.');
  console.log(`Coupon: ${coupon.id} (100% off first month)`);
  console.log(`Promo: ${promoCode.id} (max 500 redemptions, expires in 90 days)`);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
