-- Display context for where a best lift was achieved

UPDATE pr_board_entry SET equipment = 'classic raw' WHERE equipment = 'raw';

ALTER TABLE pr_board_entry
    ADD COLUMN IF NOT EXISTS meet_name text,
    ADD COLUMN IF NOT EXISTS federation text;
