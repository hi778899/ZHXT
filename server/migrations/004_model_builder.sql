ALTER TABLE query_records DROP CONSTRAINT IF EXISTS query_records_digital_id_key;
CREATE INDEX IF NOT EXISTS query_records_digital_id_idx ON query_records(digital_id, created_at DESC);

CREATE TABLE IF NOT EXISTS model_projects (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL UNIQUE REFERENCES models(id) ON DELETE CASCADE,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'suggestion' CHECK (stage IN ('suggestion','design','test','config')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','testing','ready','published')),
  suggestion JSONB NOT NULL DEFAULT '{}'::jsonb,
  design JSONB NOT NULL DEFAULT '{}'::jsonb,
  test_data JSONB NOT NULL DEFAULT '{"cases":[]}'::jsonb,
  test_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  test_passed BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_projects_owner_idx ON model_projects(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS model_projects_status_idx ON model_projects(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS model_runs (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  project_id TEXT REFERENCES model_projects(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  digital_id TEXT NOT NULL,
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT '运行中',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS model_runs_owner_idx ON model_runs(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS model_runs_model_idx ON model_runs(model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS model_runs_digital_id_idx ON model_runs(digital_id, created_at DESC);

CREATE TABLE IF NOT EXISTS digital_library_records (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  project_id TEXT REFERENCES model_projects(id) ON DELETE SET NULL,
  run_id TEXT REFERENCES model_runs(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  library_name TEXT NOT NULL,
  digital_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_library_records_model_idx ON digital_library_records(model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS digital_library_records_identity_idx ON digital_library_records(digital_id, created_at DESC);
