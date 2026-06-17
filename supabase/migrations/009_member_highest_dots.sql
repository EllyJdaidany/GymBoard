-- Member-level highest DOTS score (computed during OPL sync)

ALTER TABLE member
    ADD COLUMN IF NOT EXISTS highest_dots_score double precision,
    ADD COLUMN IF NOT EXISTS highest_dots_total_kg double precision,
    ADD COLUMN IF NOT EXISTS highest_dots_bodyweight_kg double precision,
    ADD COLUMN IF NOT EXISTS highest_dots_achieved_date date,
    ADD COLUMN IF NOT EXISTS highest_dots_meet_name text;

CREATE INDEX IF NOT EXISTS idx_member_highest_dots_score
    ON member (highest_dots_score DESC NULLS LAST)
    WHERE highest_dots_score IS NOT NULL;
