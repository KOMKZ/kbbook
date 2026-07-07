/**
 * V001 — Initial schema.
 *
 * Creates all core tables:
 *   series, groups, articles, article_links,
 *   reading_history, reading_positions,
 *   stats_snapshot, preferences, audit_log
 *
 * schema_version and migration_log are managed by MigrationRunner.bootstrap().
 */

import type { Migration } from './migrations.js'

export const v001: Migration = {
  version: 1,
  name: 'Initial schema — core tables',

  up: `
    -- ── Knowledge structure ──────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS series (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      short_title TEXT,
      tagline     TEXT,
      description TEXT,
      icon        TEXT,
      color       TEXT,
      enabled     INTEGER DEFAULT 1,
      sort_order  INTEGER DEFAULT 0,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id              TEXT PRIMARY KEY,
      series_id       TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
      parent_group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
      title           TEXT NOT NULL,
      slug            TEXT NOT NULL,
      sort_order      INTEGER DEFAULT 0,
      UNIQUE(series_id, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_groups_series ON groups(series_id);
    CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_group_id);

    CREATE TABLE IF NOT EXISTS articles (
      slug           TEXT PRIMARY KEY,
      series_id      TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
      group_id       TEXT REFERENCES groups(id) ON DELETE SET NULL,
      title          TEXT NOT NULL,
      description    TEXT,
      content        TEXT,
      word_count     INTEGER DEFAULT 0,
      read_time_mins INTEGER DEFAULT 0,
      status         TEXT DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
      tags           TEXT,
      frontmatter    TEXT,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_articles_series ON articles(series_id);
    CREATE INDEX IF NOT EXISTS idx_articles_group ON articles(group_id);
    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);

    -- ── Cross-references ─────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS article_links (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source_slug TEXT NOT NULL REFERENCES articles(slug) ON DELETE CASCADE,
      target_slug TEXT NOT NULL REFERENCES articles(slug) ON DELETE CASCADE,
      link_type   TEXT DEFAULT 'reference' CHECK(link_type IN ('reference','prerequisite','extends','related')),
      context     TEXT,
      UNIQUE(source_slug, target_slug, link_type)
    );
    CREATE INDEX IF NOT EXISTS idx_links_source ON article_links(source_slug);
    CREATE INDEX IF NOT EXISTS idx_links_target ON article_links(target_slug);

    -- ── Reading state ────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS reading_history (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      slug      TEXT NOT NULL,
      series_id TEXT NOT NULL,
      title     TEXT NOT NULL,
      read_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reading_slug ON reading_history(slug);
    CREATE INDEX IF NOT EXISTS idx_reading_time ON reading_history(read_at DESC);

    CREATE TABLE IF NOT EXISTS reading_positions (
      slug        TEXT PRIMARY KEY,
      series_id   TEXT NOT NULL,
      version     TEXT NOT NULL,
      top         REAL DEFAULT 0,
      ratio       REAL DEFAULT 0,
      updated_at  INTEGER NOT NULL
    );

    -- ── Analytics ────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS stats_snapshot (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      computed_at INTEGER NOT NULL
    );

    -- ── User preferences ─────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS preferences (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- ── Audit trail ──────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      operation   TEXT    NOT NULL,
      entity_type TEXT    NOT NULL,
      entity_id   TEXT,
      changes     TEXT,
      source      TEXT    DEFAULT 'manual' CHECK(source IN ('llm','manual','sync')),
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at DESC);
  `,

  down: `
    DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS preferences;
    DROP TABLE IF EXISTS stats_snapshot;
    DROP TABLE IF EXISTS reading_positions;
    DROP TABLE IF EXISTS reading_history;
    DROP TABLE IF EXISTS article_links;
    DROP TABLE IF EXISTS articles;
    DROP TABLE IF EXISTS groups;
    DROP TABLE IF EXISTS series;
  `,
}
