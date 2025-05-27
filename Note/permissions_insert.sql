INSERT INTO permissions (action, resource)
VALUES
  ('view', 'dashboard'),
  ('view', 'kpi:company'),
  ('view', 'kpi:department'),
  ('view', 'kpi:section'),
  ('view', 'employee:company'),
  ('view', 'report'),
  ('view', 'kpi-value'),
  ('view', 'admin'),
  ('view', 'kpi:employee'),

  ('create', 'employee:company'),
  ('create', 'kpi:company'),
  ('create', 'kpi:section'),
  ('create', 'kpi:employee'),
  ('create', 'kpi:department'),
  ('create', 'kpi:section'),

  ('delete', 'employee:company'),
  ('delete', 'kpi'),

  ('update', 'employee:company'),

  ('assign', 'kpi:company'),
  ('assign', 'kpi:department'),
  ('assign', 'kpi:section'),

  ('reject', 'kpi-value'),
  ('approve', 'kpi-value'),

  ('copy-template', 'kpi'),
  ('toggle-status', 'kpi'),

  ('export', 'report');