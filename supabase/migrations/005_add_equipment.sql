-- equipment distinguishes raw vs equipped (and other OPL equipment classes)

ALTER TABLE gym_pr
    ADD COLUMN IF NOT EXISTS equipment text DEFAULT 'raw';

ALTER TABLE pr_board_entry
    ADD COLUMN IF NOT EXISTS equipment text DEFAULT 'raw';

UPDATE gym_pr SET equipment = 'raw' WHERE equipment IS NULL;
UPDATE pr_board_entry SET equipment = 'raw' WHERE equipment IS NULL;

DROP INDEX IF EXISTS idx_pr_board_entry_member_lift;
DROP INDEX IF EXISTS idx_pr_board_entry_member_lift_equipment;
CREATE UNIQUE INDEX idx_pr_board_entry_member_lift_equipment
    ON pr_board_entry (member_id, lift, equipment);
