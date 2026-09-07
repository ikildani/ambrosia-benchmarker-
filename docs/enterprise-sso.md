# Enterprise SSO (SAML) — design and enablement runbook

Status: **not built**. This document specifies how to enable SAML SSO for an
enterprise customer domain on Solidus, what it costs, and exactly which code
touchpoints change. Read together with migration `100_team_audit_events.sql`
(which adds `team_domains` and the missing `teams.sso_entity_id` /
`teams.sso_sso_url` columns).

## 1. What exists today

| Piece | Location | State |
|---|---|---|
| `teams.sso_provider_id`, `teams.sso_email_domain` | migration 060 | present |
| `teams.sso_entity_id`, `teams.sso_sso_url` | used by code, **never migrated** | added in migration 100 |
| `POST /api/portfolio/sso/register` | `app/api/portfolio/sso/register/route.ts` | calls `supabase.auth.admin.createSSOProvider()` (cast to `any`); Enterprise tier gate |
| `POST /api/portfolio/sso/login` | `app/api/portfolio/sso/login/route.ts` | looks up team by `sso_email_domain`, calls `auth.signInWithSSO({ domain })` |
| `/portfolio/sso` | `app/portfolio/sso/page.tsx` | email-domain login form |
| `/portfolio/admin/settings` | | admin enters entity ID / SSO URL / domain |
| `handle_new_user()` trigger | migration 098 | creates `user_profiles` row **with a 7-day auto Pro trial** for every new `auth.users` row |
| Auth callback | `app/auth/callback/route.ts` | PKCE exchange; signup/OAuth notifications; `?next=` redirect |
| Team role model | `team_members.role` in `admin \| analyst \| viewer` | canonical; `user_profiles.team_id` is a denormalised copy |

The register/login routes are therefore ~80% of the plumbing. What is missing
is (a) the Supabase plan, (b) attribute mapping, (c) auto-join on first login,
(d) skipping the trial for enterprise users, and (e) the settings UI to manage
verified domains.

## 2. Supabase plan requirement

SAML 2.0 SSO is available on **Supabase Pro plan and above** (Pro, Team,
Enterprise), and is enabled per project under
*Authentication → Providers → SAML 2.0* (or via the Management API /
`supabase sso` CLI). It is not available on Free. Budget the Pro plan
(currently USD 25/month base) against the Enterprise Portfolio tier price in
`lib/config/constants.ts` `PORTFOLIO_PRICING` — trivially covered.

Two operational prerequisites:

1. The project's SAML metadata URL (`https://<project-ref>.supabase.co/auth/v1/sso/saml/metadata`)
   and ACS URL (`.../sso/saml/acs`) must be registered in the customer's IdP
   (Okta, Entra ID, Google Workspace, OneLogin all support this).
2. A custom domain for the auth endpoint is not required, but customers'
   security teams sometimes ask for it; Supabase custom domains are a paid
   add-on on Pro.

## 3. Provider registration (per customer domain)

Preferred: CLI, run by us, once per customer, from a secure workstation.

```bash
supabase sso add \
  --project-ref <ref> \
  --type saml \
  --metadata-url 'https://login.microsoftonline.com/<tenant>/federationmetadata/2007-06/federationmetadata.xml' \
  --domains customer.com \
  --attribute-mapping-file ./sso/customer-com.json
```

`--attribute-mapping-file` (see §4). `supabase sso list` / `supabase sso show`
verify. The returned provider UUID is stored on `teams.sso_provider_id`.

Equivalent Admin API (what `sso/register` already attempts):

```ts
await supabase.auth.admin.createSSOProvider({
  type: 'saml',
  metadata_url: idpMetadataUrl,      // NOT the entity ID — see fix below
  domains: [domain],
  attribute_mapping: { keys: { ... } },
});
```

**Fix required in `sso/register/route.ts`:** it passes `team.sso_entity_id`
as `metadata_url`. Entity IDs are opaque identifiers (often not URLs). Add a
`sso_metadata_url` field to the settings form (or accept raw metadata XML via
`metadata_xml`) and pass that. Keep `sso_entity_id` for display/validation
only. Also replace the `as any` with the typed `AdminApi.createSSOProvider`
now available in `@supabase/supabase-js` v2.

## 4. Attribute mapping → `user_profiles`

Store per-customer mapping JSON in `sso/<domain>.json` (repo, not DB) and pass
it at registration. Claims land in `auth.users.raw_user_meta_data` (and
`user_metadata` client-side), which is what `handle_new_user()` and the auth
callback read.

```json
{
  "keys": {
    "email":     { "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" },
    "full_name": { "name": "http://schemas.microsoft.com/identity/claims/displayname" },
    "first_name":{ "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname" },
    "last_name": { "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname" },
    "job_title": { "name": "jobTitle", "default": "" },
    "groups":    { "name": "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups", "array": true }
  }
}
```

Mapping to columns:

| SAML key | `user_profiles` column | Notes |
|---|---|---|
| `email` | `email` | required; Supabase also sets `auth.users.email` |
| `full_name` (or first+last) | `full_name` | |
| `job_title` | `job_title` / `role` (whichever exists) | optional |
| `groups` | → `team_members.role` | optional: map an IdP group (e.g. `solidus-admins`) to `admin`, else `team_domains.auto_join_role` |

Okta/Google use `user.email`, `user.firstName`, `user.lastName` names instead
of the Microsoft URIs; keep one JSON per customer.

## 5. Auto-join by email domain (`team_domains`)

Migration 100 adds:

```
team_domains(id, team_id, domain (lower, unique), auto_join_role, verified_at, created_by, created_at)
```

RLS: members read; admins insert/delete. `verified_at` must be set by us
(or by a DNS TXT check we add later) before the domain is honoured — an admin
adding `gmail.com` must not capture every Gmail signup.

Rules for auto-join, in order:

1. Domain of `NEW.email` matches a row in `team_domains` with `verified_at IS NOT NULL`.
2. Team has a free seat: `count(team_members where status='active') < teams.max_seats`.
   If full, still create the profile but with `tier='free'`, no membership, and
   insert an `audit_log` row `action='sso_seat_limit_reached'` so the admin sees it.
3. Role: if an IdP group maps to admin (see §4) use `admin`, else `team_domains.auto_join_role`.

`teams.sso_email_domain` (single column, migration 060) becomes redundant;
keep it as a fallback for one release, then migrate its values into
`team_domains` and drop it.

## 6. Code touchpoints

### 6.1 `handle_new_user()` trigger — skip the trial, land on the team tier

Migration 098 must **not** be edited. Write `101_handle_new_user_enterprise_join.sql`
with `CREATE OR REPLACE FUNCTION public.handle_new_user()` that:

```sql
DECLARE
  v_domain    text := lower(split_part(NEW.email, '@', 2));
  v_team      record;
  v_seats     integer;
  v_is_sso    boolean := COALESCE(NEW.raw_app_meta_data->>'provider', '') = 'sso'
                         OR (NEW.raw_app_meta_data->'providers') ? 'sso';
BEGIN
  SELECT td.team_id, td.auto_join_role, t.max_seats, t.portfolio_tier
    INTO v_team
  FROM public.team_domains td
  JOIN public.teams t ON t.id = td.team_id
  WHERE td.domain = v_domain AND td.verified_at IS NOT NULL
  LIMIT 1;

  IF v_team.team_id IS NOT NULL THEN
    SELECT count(*) INTO v_seats FROM public.team_members
     WHERE team_id = v_team.team_id AND status = 'active';

    IF v_seats < v_team.max_seats THEN
      -- Enterprise path: no trial, straight onto the team's tier.
      INSERT INTO public.user_profiles (id, email, tier, tier_change_authorized,
                                        subscription_status, team_id, updated_at)
      VALUES (NEW.id, NEW.email, 'portfolio', TRUE, 'active', v_team.team_id, NOW())
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.team_members (team_id, user_id, role, status, accepted_at)
      VALUES (v_team.team_id, NEW.id, v_team.auto_join_role, 'active', NOW())
      ON CONFLICT (team_id, user_id) DO NOTHING;

      INSERT INTO public.audit_log (team_id, user_id, user_email, action, resource, resource_id, details)
      VALUES (v_team.team_id, NEW.id, NEW.email, 'member_auto_joined', 'team', v_team.team_id::text,
              jsonb_build_object('via', CASE WHEN v_is_sso THEN 'sso' ELSE 'domain' END, 'role', v_team.auto_join_role));
      RETURN NEW;
    END IF;
    -- seat limit: fall through to the normal path, but flag it
    INSERT INTO public.audit_log (team_id, user_id, user_email, action, resource, status, details)
    VALUES (v_team.team_id, NEW.id, NEW.email, 'sso_seat_limit_reached', 'team', 'denied',
            jsonb_build_object('max_seats', v_team.max_seats));
  END IF;

  -- ... existing 098 body unchanged (7-day auto Pro trial + trial_activated event) ...
END;
```

Notes:
- `tier_change_authorized = TRUE` is required because `trigger_prevent_tier_escalation`
  (BEFORE UPDATE) would otherwise block later tier writes; on INSERT it is not
  consulted, but set it for consistency with `app/api/portfolio/invites/accept`.
- The downstream crons (`pro-expiration`, `post-trial-drip`, `smart-trial-extend`)
  key on `tier='pro'`, so an enterprise user on `portfolio` is untouched.
- Function stays `SECURITY DEFINER`; `team_domains`/`team_members` RLS is bypassed.

### 6.2 Auth callback — `app/auth/callback/route.ts`

- SSO sign-ins return through the same PKCE callback. Detect with
  `data.user.app_metadata.provider === 'sso'`.
- Skip the "new signup" admin/Slack notifications for SSO users (they are
  provisioned, not marketing signups) — or route them to a separate
  `notifyEnterpriseProvision()`.
- Honour `?next=` as today; `sso/login` already sends `/portfolio/admin`.
  Change that default to `/dashboard` — most SSO users are `viewer`/`analyst`,
  not admins, and the admin layout redirects non-portfolio tiers to `/`.
- Optional hardening: if the user's domain has a verified `team_domains` row
  but the profile has no `team_id` (trigger ran before the domain was
  verified), perform the auto-join here using the service client, with the
  same seat check. Keep this logic in one helper, e.g. `lib/portfolio/auto-join.ts`.

### 6.3 `sso/login` route

- Look up `team_domains` first, then fall back to `teams.sso_email_domain`.
- Return the provider's `url` from `signInWithSSO` to the client and redirect
  the browser there (the current code calls it server-side; `signInWithSSO`
  must run with the anon key + PKCE from the browser or return `data.url` for
  the client to follow). Use `createServerClient()` (cookie-aware) rather than
  `createServiceClient()` so the PKCE verifier cookie is set.

### 6.4 Settings UI — `app/portfolio/admin/settings/page.tsx`

- Replace the single `sso_email_domain` input with a **Verified domains** list
  backed by `team_domains` (add `GET/POST/DELETE /api/portfolio/domains`,
  admin-only via `requireTeamAdmin`). Show "pending verification" until
  `verified_at` is set.
- Add `sso_metadata_url` input (see §3 fix).
- Show provider status from `supabase sso show` equivalent
  (`auth.admin.listSSOProviders()` filtered by domain).

### 6.5 Middleware / session

- `lib/auth/require-single-session.ts` is unaffected: SSO sessions are ordinary
  Supabase sessions.
- Enterprise customers commonly ask for **forced SSO** (block password login
  for their domain). Implement in `app/api/auth/*` sign-in handler: if the
  email domain has a `team_domains` row with `verified_at` and the team has
  `sso_provider_id`, reject password/magic-link login with
  `error_code: 'SSO_REQUIRED'` and let the client redirect to `/portfolio/sso`.

### 6.6 Audit

- Provisioning events go to `audit_log` (admin actions): `sso_provider_registered`
  (exists), `member_auto_joined`, `sso_seat_limit_reached`, `domain_added`,
  `domain_verified`, `domain_removed`.
- Sign-in events are not recorded today. If the customer requires login
  auditing, add an `auth_events` feed from Supabase auth logs (Log Drains, Team
  plan+) rather than writing from the callback — the callback is not hit for
  refreshed sessions.

## 7. Rollout checklist per customer

1. Upgrade project to Pro (once). Enable SAML in dashboard.
2. Create `teams` row (Enterprise tier, `max_seats`), first admin via invite.
3. Insert `team_domains` row; set `verified_at` after confirming domain
   ownership with the customer's IT contact (email from an admin at that domain
   suffices for now).
4. Receive IdP metadata URL; write `sso/<domain>.json` mapping; run `supabase sso add`.
5. Store provider UUID on `teams.sso_provider_id`; fill `sso_entity_id`, `sso_sso_url`.
6. Apply migration 101 (§6.1).
7. Test with a fresh IdP user: expect `user_profiles.tier='portfolio'`,
   `team_members.status='active'`, no `trial_activated` event, landing on `/dashboard`
   with the Team toggle visible in History.
8. Test seat-limit path and a non-listed domain (must fall back to the normal
   trial signup).

## 8. Open questions

- SCIM deprovisioning: not supported by Supabase Auth natively. Offer a
  scheduled `supabase.auth.admin.listUsers()` reconciliation against the IdP
  group, or a webhook from the IdP that calls `PUT /api/portfolio/members`
  (`status='deactivated'`).
- Multiple domains per IdP (e.g. `customer.com` + `customer.co.uk`): supported —
  one `team_domains` row each, one provider with both `--domains`.
- Data residency: the Supabase project region is fixed; note it in the MSA.
