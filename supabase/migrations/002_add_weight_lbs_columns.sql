-- Add pound equivalents alongside kilogram weight fields
-- Safe to re-run: uses IF NOT EXISTS for projects that already have these columns from 001

ALTER TABLE gym_pr
    ADD COLUMN IF NOT EXISTS weight_lbs double precision;

ALTER TABLE pr_board_entry
    ADD COLUMN IF NOT EXISTS weight_lbs double precision;
