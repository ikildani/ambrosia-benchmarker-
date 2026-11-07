#!/usr/bin/env bash
# Applies migration 139 (score archive) to a throwaway local Postgres and
# checks the guarantees it makes: inserts are hashed and time-stamped by the
# database, UPDATE / DELETE / TRUNCATE fail for every role, ledger writes are
# copied automatically, confidential ledger names are hashed, days seal into
# a chain, and verify_score_archive() catches an edit made with triggers off.
#
# Usage: scripts/score-archive/verify-migration.sh   (needs initdb/pg_ctl/psql;
# PG_BIN overrides their directory). Exits non-zero on the first failure.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PORT="${PORT:-55439}"
WORK="$(mktemp -d)"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$WORK"
  RUN_AS=(runuser -u postgres --)
fi

cleanup() { "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

psql_() { PGOPTIONS="-c client_min_messages=warning" "$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

# Minimal Supabase surface the migrations reference.
psql_ <<'SQL'
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE TABLE companies (id uuid PRIMARY KEY);
CREATE TABLE clinical_assets (id uuid PRIMARY KEY);
CREATE TABLE deals (id uuid PRIMARY KEY);
CREATE TABLE radar_sync_cursors (source text PRIMARY KEY, cursor text, state jsonb);
SQL
psql_ -f "$ROOT/supabase/migrations/122_outcome_ledger.sql"
psql_ -c "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS priors_as_of text;"
psql_ -c "GRANT ALL ON predictions, outcomes TO service_role; GRANT USAGE ON SCHEMA public TO service_role;"
psql_ -f "$ROOT/supabase/migrations/139_score_archive.sql"
# Re-applying must be harmless.
psql_ -f "$ROOT/supabase/migrations/139_score_archive.sql"

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "ok - $*"; }
expect_error() {
  local what="$1"; shift
  if psql_ "$@" >/dev/null 2>&1; then fail "$what succeeded"; else pass "$what is refused"; fi
}

# 1. Insert: DB sets recorded_at and hashes; caller values are overwritten.
psql_ <<'SQL'
INSERT INTO score_archive (product, score_type, model_version, origin, entity_type, entity_id, inputs, output, recorded_at, row_sha256, inputs_sha256)
VALUES ('solidus', 'radar.licensing_intent', 'v3', 'platform', 'asset', 'a1', '{"b":2,"a":1}', '{"score":72}', '2001-01-01', 'forged', 'forged');
SQL
[ "$(psql_ -c "SELECT count(*) FROM score_archive WHERE recorded_at > now() - interval '1 minute' AND row_sha256 = score_archive_row_sha256(score_archive) AND inputs_sha256 = encode(sha256(convert_to(inputs::text,'UTF8')),'hex')")" = "1" ] \
  || fail "insert did not set recorded_at / hashes"
pass "insert: recorded_at and hashes set by the database"

expect_error "confidential row without an inputs hash" -c "INSERT INTO score_archive (product, score_type, model_version, origin, entity_type, output) VALUES ('terrain','terrain.demand','1','api','indication','{}')"
expect_error "unknown product" -c "INSERT INTO score_archive (product, score_type, model_version, origin, entity_type, inputs, output) VALUES ('other','x','1','api','asset','{}','{}')"

# 2. Append-only, for the owner and for service_role.
expect_error "UPDATE (owner)" -c "UPDATE score_archive SET output = '{\"score\":99}'"
expect_error "DELETE (owner)" -c "DELETE FROM score_archive"
expect_error "TRUNCATE (owner)" -c "TRUNCATE score_archive"
expect_error "UPDATE (service_role)" -c "SET ROLE service_role; UPDATE score_archive SET output = '{}'"
expect_error "DELETE (service_role)" -c "SET ROLE service_role; DELETE FROM score_archive"
expect_error "SELECT (anon)" -c "SET ROLE anon; SELECT * FROM score_archive"
expect_error "INSERT (authenticated)" -c "SET ROLE authenticated; INSERT INTO score_archive (product, score_type, model_version, origin, entity_type, inputs, output) VALUES ('solidus','x','1','user','asset','{}','{}')"
psql_ -c "SET ROLE service_role; INSERT INTO score_archive (product, score_type, model_version, origin, entity_type, inputs, output) VALUES ('augur','augur.fair_value','1','api','company','{}','{\"mark\":1}')" >/dev/null \
  || fail "service_role insert"
pass "service_role can insert"

# 3. Ledger triggers: predictions / outcomes are copied; confidential names hashed.
psql_ <<'SQL'
INSERT INTO predictions (id, source, licensor_name, asset_name, therapeutic_area, phase, upfront_mid, model_version)
VALUES ('11111111-1111-1111-1111-111111111111', 'brief', 'StealthCo', 'Secret-7', 'oncology', 'phase_2', 120, 'brief-v3.1');
INSERT INTO predictions (id, source, licensor_name, asset_name, model_version)
VALUES ('22222222-2222-2222-2222-222222222222', 'radar', 'Acme Bio', 'AC-101', 'radar-intent-v3');
UPDATE predictions SET status = 'resolved' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE predictions SET upfront_mid = 130 WHERE id = '11111111-1111-1111-1111-111111111111';
INSERT INTO outcomes (id, prediction_id, matched_by, status, upfront_m)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'client', 'accepted', 110);
SQL
[ "$(psql_ -c "SELECT count(*) FROM score_archive WHERE prediction_id = '11111111-1111-1111-1111-111111111111' AND score_type LIKE 'ledger.brief%'")" = "2" ] \
  || fail "brief prediction insert + status change should give 2 rows (non-status updates are not copied)"
[ "$(psql_ -c "SELECT count(*) FROM score_archive WHERE score_type = 'outcome.accepted' AND origin = 'client'")" = "1" ] || fail "outcome not copied"
[ "$(psql_ -c "SELECT count(*) FROM score_archive WHERE score_archive::text LIKE '%StealthCo%' OR score_archive::text LIKE '%Secret-7%'")" = "0" ] \
  || fail "confidential brief names leaked into the archive"
[ "$(psql_ -c "SELECT count(*) FROM score_archive WHERE score_type = 'ledger.radar' AND entity_label = 'AC-101'")" = "1" ] || fail "public radar label missing"
pass "ledger triggers copy predictions/outcomes; brief names hashed, radar names kept"

# A failing archive insert must not fail the ledger write.
psql_ -c "ALTER TABLE score_archive ADD CONSTRAINT tmp_block CHECK (score_type <> 'ledger.calculator') NOT VALID"
psql_ -c "INSERT INTO predictions (source, model_version) VALUES ('calculator', 'calculator-1.0.0')" >/dev/null 2>&1 || fail "ledger insert failed because archiving failed"
psql_ -c "ALTER TABLE score_archive DROP CONSTRAINT tmp_block"
pass "archive failure never blocks a ledger write"

# 4. Sealing: move the rows to earlier days (owner, triggers off) to simulate history, then seal.
psql_ <<'SQL'
ALTER TABLE score_archive DISABLE TRIGGER USER;
UPDATE score_archive SET recorded_at = recorded_at - interval '3 days';
UPDATE score_archive SET row_sha256 = score_archive_row_sha256(score_archive);
ALTER TABLE score_archive ENABLE TRIGGER USER;
SQL
SEALED="$(psql_ -c "SELECT count(*) FROM seal_score_archive_days()")"
[ "$SEALED" -ge 3 ] || fail "expected ≥ 3 sealed days, got $SEALED"
[ "$(psql_ -c "SELECT count(*) FROM seal_score_archive_days()")" = "0" ] || fail "sealing is not idempotent"
[ "$(psql_ -c "SELECT count(*) FROM verify_score_archive()")" = "0" ] || fail "fresh archive does not verify"
[ "$(psql_ -c "SELECT count(*) FROM score_archive_digests g WHERE g.prev_sha256 IS DISTINCT FROM (SELECT chain_sha256 FROM score_archive_digests p WHERE p.day = g.day - 1)")" = "0" ] \
  || fail "digest chain is not linked day to day"
[ "$(psql_ -c "SELECT count(*) FROM score_archive_digests WHERE prev_sha256 IS NULL")" = "1" ] || fail "only the first sealed day may have no previous digest"
expect_error "UPDATE digests" -c "UPDATE score_archive_digests SET row_count = 0"
expect_error "DELETE digests" -c "DELETE FROM score_archive_digests"
pass "days seal into a linked chain; digests are append-only"

# 5. Tamper detection: an owner edit with triggers disabled shows up in verify.
psql_ <<'SQL'
ALTER TABLE score_archive DISABLE TRIGGER USER;
UPDATE score_archive SET output = '{"score":99}' WHERE entity_id = 'a1';
ALTER TABLE score_archive ENABLE TRIGGER USER;
SQL
psql_ -c "SELECT problem FROM verify_score_archive()" | grep -q row_hash_mismatch || fail "content edit not detected"
psql_ <<'SQL'
ALTER TABLE score_archive DISABLE TRIGGER USER;
UPDATE score_archive SET row_sha256 = score_archive_row_sha256(score_archive) WHERE entity_id = 'a1';
ALTER TABLE score_archive ENABLE TRIGGER USER;
SQL
psql_ -c "SELECT problem FROM verify_score_archive()" | grep -q day_hash_mismatch || fail "re-hashed edit not detected by the day digest"
psql_ <<'SQL'
ALTER TABLE score_archive DISABLE TRIGGER USER;
DELETE FROM score_archive WHERE product = 'augur';
ALTER TABLE score_archive ENABLE TRIGGER USER;
SQL
psql_ -c "SELECT problem FROM verify_score_archive()" | grep -q row_count_mismatch || fail "deleted row not detected"
pass "verify_score_archive detects edited, re-hashed and deleted rows"

# 6. Hash stability across session time zones.
H1="$(psql_ -c "SET TIME ZONE 'UTC'; SELECT score_archive_row_sha256(s) FROM score_archive s WHERE product='solidus' ORDER BY id LIMIT 1")"
H2="$(psql_ -c "SET TIME ZONE 'Asia/Tokyo'; SELECT score_archive_row_sha256(s) FROM score_archive s WHERE product='solidus' ORDER BY id LIMIT 1")"
[ "$H1" = "$H2" ] || fail "row hash depends on the session time zone"
pass "row hash is time-zone independent"

echo "All score archive migration checks passed."
