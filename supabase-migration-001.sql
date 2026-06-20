-- Migration 001: add parent_session_id for follow-up sessions
-- Run this in the Supabase SQL Editor if you already ran supabase-setup.sql.
-- Safe to run multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

alter table sessions
  add column if not exists parent_session_id uuid references sessions(id);
