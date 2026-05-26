#!/usr/bin/env npx tsx
/**
 * Sales onboarding script — provisions a new Portfolio License team.
 *
 * Usage:
 *   npx tsx scripts/provision-portfolio-team.ts \
 *     --name "OrbiMed Advisors" \
 *     --admin-email "ops@orbimed.com" \
 *     --tier scale \
 *     --seats 10
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    parsed[key] = args[i + 1];
  }
  return parsed;
}

const tierDefaults: Record<string, { seats: number; hours: number }> = {
  growth: { seats: 5, hours: 2 },
  scale: { seats: 10, hours: 5 },
  enterprise: { seats: 15, hours: 10 },
};

async function main() {
  const args = parseArgs();
  const name = args['name'];
  const adminEmail = args['admin-email'];
  const tier = args['tier'] || 'growth';
  const seats = parseInt(args['seats'] || String(tierDefaults[tier]?.seats || 5));

  if (!name || !adminEmail) {
    console.error('Usage: --name "Fund Name" --admin-email "email@fund.com" [--tier growth|scale|enterprise] [--seats N]');
    process.exit(1);
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const defaults = tierDefaults[tier] || tierDefaults.growth;

  console.log(`\nProvisioning Portfolio License team:`);
  console.log(`  Name:  ${name}`);
  console.log(`  Slug:  ${slug}`);
  console.log(`  Tier:  ${tier}`);
  console.log(`  Seats: ${seats}`);
  console.log(`  Admin: ${adminEmail}`);
  console.log(`  Analyst hrs/mo: ${defaults.hours}`);
  console.log('');

  // Check if admin email exists in auth
  const { data: users } = await supabase.auth.admin.listUsers();
  const adminUser = users?.users?.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());

  // Create the team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name,
      slug,
      portfolio_tier: tier,
      max_seats: seats,
      analyst_hours_monthly: defaults.hours,
      contract_start_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (teamError) {
    console.error('Failed to create team:', teamError.message);
    process.exit(1);
  }

  console.log(`Team created: ${team.id}`);

  if (adminUser) {
    // User exists — add as admin directly
    await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: adminUser.id,
      role: 'admin',
      status: 'active',
      accepted_at: new Date().toISOString(),
    });

    await supabase
      .from('user_profiles')
      .update({ tier: 'portfolio', team_id: team.id })
      .eq('id', adminUser.id);

    console.log(`Admin ${adminEmail} added directly (existing user)`);
  } else {
    // User doesn't exist — create invite
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('team_invites').insert({
      team_id: team.id,
      email: adminEmail.toLowerCase(),
      role: 'admin',
      token,
      expires_at: expiresAt,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';
    console.log(`\nAdmin invite created (user not yet registered):`);
    console.log(`  Join URL: ${appUrl}/portfolio/join?token=${token}`);
    console.log(`  Expires:  ${expiresAt}`);
  }

  // Log audit event
  await supabase.from('audit_log').insert({
    team_id: team.id,
    user_email: 'system@ambrosiaventures.co',
    action: 'team_provisioned',
    resource: 'team',
    resource_id: team.id,
    details: { name, tier, seats, adminEmail, provisionedBy: 'CLI' },
  });

  console.log('\nDone. Team is ready for use.');
}

main().catch(err => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
