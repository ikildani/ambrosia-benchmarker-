-- 169: ai_spend_daily gains the 'search' lane (Search & Evaluation user requests), so S&E has its own
-- small pool and can never spend the credits reserved for the core Solidus product ('interactive').
ALTER TABLE public.ai_spend_daily DROP CONSTRAINT IF EXISTS ai_spend_daily_lane_check;
ALTER TABLE public.ai_spend_daily ADD CONSTRAINT ai_spend_daily_lane_check CHECK (lane IN ('interactive', 'search', 'core', 'bulk'));
