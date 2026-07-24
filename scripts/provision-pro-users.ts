#!/usr/bin/env npx tsx
/**
 * Provision Pro user accounts and send welcome emails.
 * Usage: npx tsx scripts/provision-pro-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY!;
const APP_URL = 'https://solidus.ambrosiaventures.co';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface UserToProvision {
  email: string;
  name: string;
}

const users: UserToProvision[] = [
  { email: 'jules@scirena.bio', name: 'Jules' },
  { email: 'manu@scirena.bio', name: 'Manu' },
];

function buildWelcomeEmail(name: string, magicLink?: string | null): string {
  const ctaUrl = magicLink || APP_URL;
  const ctaText = magicLink ? 'Sign In Instantly' : 'Open Your Dashboard';
  const ctaNote = magicLink
    ? 'Click the button above to sign in instantly — no password needed. You can set a password later from your Dashboard under Account & Security.'
    : 'To get started, sign in with this email address using Google OAuth or click "Send me a login link" on the sign-in page.';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Welcome to Ambrosia Ventures Pro</h1>
    <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">Your deal intelligence platform is ready</p>
  </div>
  <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
    <p style="font-size: 16px;">Hi ${name},</p>
    <p>Your <strong>Pro account</strong> on Solidus is live. You now have full access to:</p>
    <ul style="padding-left: 20px; color: #334155;">
      <li><strong>14 valuation engines</strong> — rNPV, Monte Carlo, Real Options, Buyer-Specific Valuation, and more</li>
      <li><strong>1,900+ verified deals</strong> — sourced from SEC 8-K filings across 12 therapeutic areas</li>
      <li><strong>AI Deal Memo & Negotiation Playbook</strong> — board-ready analysis in seconds</li>
      <li><strong>850+ ranked partner matches</strong> — scored by strategic fit, intent signals, and deal history</li>
      <li><strong>PDF & Excel export</strong> — institutional-grade reports for your stakeholders</li>
    </ul>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #0d9488, #0891b2); color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">${ctaText}</a>
    </div>
    <p style="color: #64748b; font-size: 14px;">${ctaNote}</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
    <p style="color: #94a3b8; font-size: 12px; text-align: center;">
      Ambrosia Ventures · <a href="${APP_URL}" style="color: #0d9488;">solidus.ambrosiaventures.co</a><br>
      Questions? Reply to this email or reach us at hello@ambrosiaventures.co
    </p>
  </div>
</body>
</html>`;
}

async function main() {
  for (const user of users) {
    console.log(`\nProvisioning: ${user.email}`);

    // 1. Create auth user via Supabase admin (generates a magic link)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
      user_metadata: { name: user.name },
    });

    if (authError) {
      console.error(`  Auth creation failed: ${authError.message}`);
      continue;
    }

    console.log(`  Auth user created: ${authUser.user.id}`);

    // 2. Create user_profiles row with Pro tier (using tier_change_authorized flag)
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        id: authUser.user.id,
        email: user.email,
        tier: 'pro',
        tier_change_authorized: true,
        email_verified: true,
      }, { onConflict: 'id' });

    if (profileError) {
      console.error(`  Profile creation failed: ${profileError.message}`);
    } else {
      console.log(`  Profile created with Pro tier`);
    }

    // 3. Generate magic link for instant access (no password needed)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: { redirectTo: `${APP_URL}/auth/callback` },
    });

    const magicLink = linkError ? null : linkData?.properties?.action_link;
    if (magicLink) {
      console.log(`  Magic link generated`);
    } else {
      console.log(`  Magic link failed: ${linkError?.message || 'no link returned'}`);
    }

    // 4. Send welcome email with magic link
    if (SENDGRID_API_KEY) {
      sgMail.setApiKey(SENDGRID_API_KEY);
      try {
        await sgMail.send({
          to: user.email,
          from: 'Ambrosia Ventures <info@ambrosiaventures.co>',
          replyTo: 'hello@ambrosiaventures.co',
          subject: magicLink ? 'Your Ambrosia Pro Account is Live — Sign In Instantly' : 'Your Ambrosia Pro Account is Live',
          html: buildWelcomeEmail(user.name, magicLink),
        });
        console.log(`  Welcome email sent`);
      } catch (emailErr) {
        console.error(`  Email failed:`, emailErr);
      }
    } else {
      console.log(`  SENDGRID_API_KEY not set — skipping email`);
    }
  }

  // Verify
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('email, tier')
    .in('email', users.map(u => u.email));

  console.log('\nVerification:', profiles);
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
