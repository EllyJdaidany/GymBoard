-- Member profile + gym PR bucket context for class-scoped records

ALTER TABLE member
    ADD COLUMN IF NOT EXISTS sex text,
    ADD COLUMN IF NOT EXISTS weight_class text,
    ADD COLUMN IF NOT EXISTS weight_class_kg double precision,
    ADD COLUMN IF NOT EXISTS ruleset text,
    ADD COLUMN IF NOT EXISTS federation text;

ALTER TABLE gym_pr
    ADD COLUMN IF NOT EXISTS canonical_bucket_id text,
    ADD COLUMN IF NOT EXISTS meet_ruleset text,
    ADD COLUMN IF NOT EXISTS meet_weight_class_kg double precision;
