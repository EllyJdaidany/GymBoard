-- Bucket-scoped PR board entries (lifters can hold records in multiple weight classes)

ALTER TABLE pr_board_entry
    ADD COLUMN IF NOT EXISTS canonical_bucket_id text,
    ADD COLUMN IF NOT EXISTS meet_ruleset text,
    ADD COLUMN IF NOT EXISTS meet_weight_class_kg double precision,
    ADD COLUMN IF NOT EXISTS bodyweight_kg double precision;

DROP INDEX IF EXISTS idx_pr_board_entry_member_lift_equipment;

CREATE UNIQUE INDEX idx_pr_board_entry_member_lift_equipment_bucket
    ON pr_board_entry (member_id, lift, equipment, canonical_bucket_id);
