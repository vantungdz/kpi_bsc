-- Promotion cycles (cross-year) + link from kpi_assignments.
-- Single migration: replaces former V11 + V12 + V13.
-- Safe on greenfield DB and on legacy DBs that had an older promotion_cycles shape
-- (missing user_id, stray new_id column, or DATE instead of TIMESTAMPTZ).

-- ---------------------------------------------------------------------------
-- 1. Table (target schema)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotion_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    duration_months INTEGER,
    status_code INTEGER REFERENCES sys_status_codes(code) DEFAULT 201,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    deleted_at TIMESTAMPTZ
);

COMMENT ON COLUMN promotion_cycles.user_id IS
    'Employee on promotion track; NULL = shared cycle assignable when validating overlap.';

-- ---------------------------------------------------------------------------
-- 2. Legacy repair (no-op when table was created with section 1)
-- ---------------------------------------------------------------------------
ALTER TABLE promotion_cycles
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

ALTER TABLE promotion_cycles DROP COLUMN IF EXISTS new_id;

ALTER TABLE promotion_cycles
    ALTER COLUMN start_date TYPE TIMESTAMPTZ USING start_date::timestamptz,
    ALTER COLUMN end_date TYPE TIMESTAMPTZ USING end_date::timestamptz;

-- ---------------------------------------------------------------------------
-- 3. Assignments → promotion cycle
-- ---------------------------------------------------------------------------
ALTER TABLE kpi_assignments
    ADD COLUMN IF NOT EXISTS promotion_cycle_id UUID REFERENCES promotion_cycles(id);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_promotion_cycles_user_active
    ON promotion_cycles(user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_assignments_promotion_cycle
    ON kpi_assignments(promotion_cycle_id)
    WHERE deleted_at IS NULL AND promotion_cycle_id IS NOT NULL;
