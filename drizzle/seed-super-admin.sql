PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO roles (id, name, description) VALUES
  ('role_super_admin', 'super_admin', 'Full system access'),
  ('role_admin', 'admin', 'Company-wide meeting and user administration'),
  ('role_employee', 'employee', 'Employee meeting and recording access');

INSERT OR IGNORE INTO users (
  id,
  email,
  name,
  approval_status,
  approved_at,
  created_at,
  updated_at
) VALUES (
  'user_vivek_markitome_com',
  'vivek@markitome.com',
  'Vivek',
  'approved',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO user_roles (
  id,
  user_id,
  role_id,
  created_at,
  updated_at
) VALUES (
  'user_role_vivek_super_admin',
  'user_vivek_markitome_com',
  'role_super_admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
