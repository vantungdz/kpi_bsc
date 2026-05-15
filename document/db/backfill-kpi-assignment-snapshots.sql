INSERT INTO kpi_assignment_snapshots (
    id,
    assignment_id,
    cycle_id,
    user_id,
    department_id,
    job_title_id,
    supervisor_id,
    user_full_name,
    user_email,
    department_name,
    job_title_name,
    supervisor_full_name,
    supervisor_email,
    created_at,
    created_by
)
SELECT
    uuid_generate_v4(),
    ka.id,
    ka.cycle_id,
    ka.user_id,
    ud.department_id,
    u.job_title_id,
    ud.supervisor_id,
    u.full_name,
    u.email,
    d.name,
    jt.name,
    sup.full_name,
    sup.email,
    COALESCE(ka.created_at, NOW()),
    ka.created_by
FROM kpi_assignments ka
INNER JOIN users u ON u.id = ka.user_id
LEFT JOIN LATERAL (
    SELECT user_departments.department_id,
           user_departments.supervisor_id
    FROM user_departments
    WHERE user_departments.user_id = ka.user_id
    ORDER BY COALESCE(user_departments.is_primary, FALSE) DESC,
             user_departments.department_id
    LIMIT 1
) ud ON TRUE
LEFT JOIN departments d ON d.id = ud.department_id AND d.deleted_at IS NULL
LEFT JOIN job_titles jt ON jt.id = u.job_title_id AND jt.deleted_at IS NULL
LEFT JOIN users sup ON sup.id = ud.supervisor_id AND sup.deleted_at IS NULL
WHERE ka.user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM kpi_assignment_snapshots kas
      WHERE kas.assignment_id = ka.id
        AND kas.cycle_id = ka.cycle_id
  );
