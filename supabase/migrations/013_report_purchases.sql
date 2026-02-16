-- Report purchases for one-time $149 deal reports
CREATE TABLE IF NOT EXISTS report_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  email TEXT,
  calculation_inputs JSONB NOT NULL,
  calculation_results JSONB NOT NULL,
  memo_content JSONB,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_purchases_user ON report_purchases(user_id);
CREATE INDEX idx_report_purchases_email ON report_purchases(email);
CREATE INDEX idx_report_purchases_session ON report_purchases(stripe_session_id);

ALTER TABLE report_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own reports" ON report_purchases
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON report_purchases
  FOR ALL USING (auth.role() = 'service_role');
