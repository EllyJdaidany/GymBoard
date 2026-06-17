-- Legacy cleanup: equipment columns and meet_result table are no longer part of the schema.
-- Uses IF EXISTS so this is a no-op on fresh databases created from 001.

ALTER TABLE gym_pr DROP COLUMN IF EXISTS equipment;
ALTER TABLE pr_board_entry DROP COLUMN IF EXISTS equipment;

DROP INDEX IF EXISTS idx_pr_board_entry_member_lift_equipment;
DROP TABLE IF EXISTS meet_result;

-- Ensure the current unique index exists (no-op if already created by 001)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_board_entry_member_lift
    ON pr_board_entry (member_id, lift);
