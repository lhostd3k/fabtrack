// ─── Database Schema Initialization ─────────────────────────────────
// Run: npm run db:init
// This creates all tables for FabTrack

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const schema = `
-- ════════════════════════════════════════════════════════════════════
-- FABTRACK DATABASE SCHEMA
-- ════════════════════════════════════════════════════════════════════

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  pin           VARCHAR(255) NOT NULL,          -- hashed 4-digit PIN
  role          VARCHAR(30)  NOT NULL,           -- boss, fabricator, installer, cutter, polisher
  sub_role      VARCHAR(50),                     -- display label: "Fabricator", "Cutting", etc.
  division      VARCHAR(20)  NOT NULL,           -- metal, granite, all
  avatar_color  VARCHAR(50)  DEFAULT '#7c9aff',
  active        BOOLEAN      DEFAULT true,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  client_name   VARCHAR(255) NOT NULL,
  address       TEXT,
  project_type  VARCHAR(50)  NOT NULL,           -- Door, Window, Railing, Granite Countertop, etc.
  division      VARCHAR(20)  NOT NULL,           -- metal or granite
  description   TEXT,
  assigned_team TEXT,                             -- comma-separated names (simple for v1)
  due_date      DATE,
  status        VARCHAR(60)  NOT NULL,
  created_by    INTEGER      REFERENCES users(id),
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Timeline entries (status changes, notes, photos)
CREATE TABLE IF NOT EXISTS timeline_entries (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       INTEGER      REFERENCES users(id),
  user_name     VARCHAR(100),                    -- denormalized for fast reads
  entry_type    VARCHAR(20)  NOT NULL,           -- status, note, photo
  content       TEXT         NOT NULL,           -- status name, note text, or photo path
  metadata      JSONB,                           -- extra data (old_status, checklist, etc.)
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Photo attachments
CREATE TABLE IF NOT EXISTS photos (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  timeline_id   INTEGER      REFERENCES timeline_entries(id),
  user_id       INTEGER      REFERENCES users(id),
  filename      VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  file_path     TEXT         NOT NULL,
  thumb_path    TEXT,
  file_size     INTEGER,
  mime_type     VARCHAR(50),
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Powder coat checklist completions
CREATE TABLE IF NOT EXISTS checklist_completions (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       INTEGER      REFERENCES users(id),
  checklist     JSONB        NOT NULL,           -- { items: [{label, checked}] }
  completed     BOOLEAN      DEFAULT false,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_projects_division    ON projects(division);
CREATE INDEX IF NOT EXISTS idx_projects_status      ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client      ON projects(client_name);
CREATE INDEX IF NOT EXISTS idx_projects_due_date    ON projects(due_date);
CREATE INDEX IF NOT EXISTS idx_projects_created     ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_project     ON timeline_entries(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_project       ON photos(project_id);
CREATE INDEX IF NOT EXISTS idx_users_division       ON users(division);
`;

async function init() {
  console.log("🔧 Initializing FabTrack database...\n");
  try {
    await pool.query(schema);
    console.log("✅ All tables created successfully!");
  } catch (err) {
    console.error("❌ Error creating tables:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
