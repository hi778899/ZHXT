ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending','active','disabled'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id TEXT;

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  parent_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registration_requests (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE registration_requests DROP CONSTRAINT IF EXISTS registration_requests_username_key;
CREATE UNIQUE INDEX IF NOT EXISTS registration_requests_pending_username_idx ON registration_requests(lower(username)) WHERE status='pending';
CREATE INDEX IF NOT EXISTS registration_requests_status_idx ON registration_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  module TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO departments(id,name) VALUES ('dept-equipment','设备管理部') ON CONFLICT(name) DO NOTHING;
INSERT INTO roles(id,code,name,description) VALUES
  ('role-admin','admin','系统管理员','平台全部管理权限'),
  ('role-user','user','普通用户','个人工作台和授权业务权限'),
  ('role-dept','department_manager','部门经理','负责本部门业务审批')
ON CONFLICT(code) DO NOTHING;
UPDATE users SET department_id=(SELECT id FROM departments WHERE name=users.department) WHERE department_id IS NULL;
