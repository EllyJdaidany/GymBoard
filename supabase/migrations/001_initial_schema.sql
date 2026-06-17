-- Powerlifting / strength-tracking schema
-- MEMBER is the central entity; all other tables reference member.id

-- ---------------------------------------------------------------------------
-- member
-- ---------------------------------------------------------------------------
CREATE TABLE member (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name        text        NOT NULL,
    last_name         text        NOT NULL,
    date_of_birth     date,
    email             text        NOT NULL UNIQUE,
    opl_username      text,
    opl_match_status  text,
    opl_linked_at     timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_opl_username ON member (opl_username)
    WHERE opl_username IS NOT NULL;

-- ---------------------------------------------------------------------------
-- gym_pr — personal records logged in the gym (member logs gym_pr)
-- ---------------------------------------------------------------------------
CREATE TABLE gym_pr (
    id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id   uuid             NOT NULL REFERENCES member (id) ON DELETE CASCADE,
    lift        text             NOT NULL,
    weight_kg   double precision NOT NULL,
    weight_lbs  double precision,
    equipment   text             NOT NULL DEFAULT 'raw',
    logged_at   timestamptz      NOT NULL DEFAULT now(),
    source      text
);

CREATE INDEX idx_gym_pr_member_id ON gym_pr (member_id);
CREATE INDEX idx_gym_pr_member_lift ON gym_pr (member_id, lift);

-- ---------------------------------------------------------------------------
-- pr_board_entry — best lifts per member (derived from OPL API + gym_pr)
-- ---------------------------------------------------------------------------
CREATE TABLE pr_board_entry (
    id                uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id         uuid             NOT NULL REFERENCES member (id) ON DELETE CASCADE,
    lift              text             NOT NULL,
    weight_kg         double precision NOT NULL,
    weight_lbs        double precision,
    equipment         text             NOT NULL DEFAULT 'raw',
    source            text,
    achieved_date     date,
    meet_name         text,
    federation        text,
    is_meet_verified  boolean          NOT NULL DEFAULT false
);

CREATE INDEX idx_pr_board_entry_member_id ON pr_board_entry (member_id);
CREATE UNIQUE INDEX idx_pr_board_entry_member_lift_equipment
    ON pr_board_entry (member_id, lift, equipment);

-- ---------------------------------------------------------------------------
-- opl_sync_log — sync runs tracked per member (member tracked_by opl_sync_log)
-- ---------------------------------------------------------------------------
CREATE TABLE opl_sync_log (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       uuid        NOT NULL REFERENCES member (id) ON DELETE CASCADE,
    run_at          timestamptz NOT NULL DEFAULT now(),
    status          text        NOT NULL,
    error_message   text,
    results_added   integer     NOT NULL DEFAULT 0
);

CREATE INDEX idx_opl_sync_log_member_id ON opl_sync_log (member_id);
CREATE INDEX idx_opl_sync_log_run_at ON opl_sync_log (run_at DESC);
