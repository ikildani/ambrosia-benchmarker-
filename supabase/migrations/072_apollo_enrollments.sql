-- Apollo Enrollment Tracking
-- Migration: 072_apollo_enrollments.sql
--
-- Tracks every contact enrolled into Apollo sequences by the auto-enroll cron.
-- Enables outbound attribution: when a user signs up with an email matching
-- an enrolled contact's domain, we can attribute the conversion to Apollo outbound.

CREATE TABLE apollo_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apollo_contact_id TEXT NOT NULL,
  email TEXT NOT NULL,
  email_domain TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  organization_name TEXT,
  sequence_id TEXT NOT NULL,
  sequence_name TEXT NOT NULL DEFAULT 'Tier 1 Generalist',
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  -- Attribution tracking
  converted_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  converted_tier TEXT, -- 'free', 'pro'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_apollo_enrollments_email ON apollo_enrollments(email);
CREATE INDEX idx_apollo_enrollments_email_domain ON apollo_enrollments(email_domain);
CREATE INDEX idx_apollo_enrollments_enrolled_at ON apollo_enrollments(enrolled_at);
CREATE INDEX idx_apollo_enrollments_converted_user_id ON apollo_enrollments(converted_user_id);
CREATE INDEX idx_apollo_enrollments_apollo_contact_id ON apollo_enrollments(apollo_contact_id);
