-- ============================================================
-- AI Bottleneck Diagnostic — Supabase Setup
-- Paste this entire file into the Supabase SQL Editor and run it.
-- ============================================================

-- ─── Tables ──────────────────────────────────────────────────

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  parent_session_id uuid references sessions(id),
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions not null,
  role text check (role in ('user','assistant')) not null,
  content text not null,
  turn_number int,
  created_at timestamptz default now()
);

create table if not exists diagnoses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions unique not null,
  sentence text not null,
  created_at timestamptz default now()
);

create table if not exists outcomes (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid references diagnoses unique not null,
  action_text text not null,
  created_at timestamptz default now()
);

-- ─── Row-Level Security ───────────────────────────────────────

alter table sessions enable row level security;
alter table messages enable row level security;
alter table diagnoses enable row level security;
alter table outcomes enable row level security;

-- sessions: user owns rows directly
create policy "sessions: select own" on sessions
  for select using (auth.uid() = user_id);

create policy "sessions: insert own" on sessions
  for insert with check (auth.uid() = user_id);

create policy "sessions: update own" on sessions
  for update using (auth.uid() = user_id);

create policy "sessions: delete own" on sessions
  for delete using (auth.uid() = user_id);

-- messages: owned via session
create policy "messages: select own" on messages
  for select using (
    exists (
      select 1 from sessions
      where sessions.id = messages.session_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "messages: insert own" on messages
  for insert with check (
    exists (
      select 1 from sessions
      where sessions.id = messages.session_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "messages: update own" on messages
  for update using (
    exists (
      select 1 from sessions
      where sessions.id = messages.session_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "messages: delete own" on messages
  for delete using (
    exists (
      select 1 from sessions
      where sessions.id = messages.session_id
        and sessions.user_id = auth.uid()
    )
  );

-- diagnoses: owned via session
create policy "diagnoses: select own" on diagnoses
  for select using (
    exists (
      select 1 from sessions
      where sessions.id = diagnoses.session_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "diagnoses: insert own" on diagnoses
  for insert with check (
    exists (
      select 1 from sessions
      where sessions.id = diagnoses.session_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "diagnoses: update own" on diagnoses
  for update using (
    exists (
      select 1 from sessions
      where sessions.id = diagnoses.session_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "diagnoses: delete own" on diagnoses
  for delete using (
    exists (
      select 1 from sessions
      where sessions.id = diagnoses.session_id
        and sessions.user_id = auth.uid()
    )
  );

-- outcomes: owned via diagnosis → session chain
create policy "outcomes: select own" on outcomes
  for select using (
    exists (
      select 1 from diagnoses
      join sessions on sessions.id = diagnoses.session_id
      where diagnoses.id = outcomes.diagnosis_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "outcomes: insert own" on outcomes
  for insert with check (
    exists (
      select 1 from diagnoses
      join sessions on sessions.id = diagnoses.session_id
      where diagnoses.id = outcomes.diagnosis_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "outcomes: update own" on outcomes
  for update using (
    exists (
      select 1 from diagnoses
      join sessions on sessions.id = diagnoses.session_id
      where diagnoses.id = outcomes.diagnosis_id
        and sessions.user_id = auth.uid()
    )
  );

create policy "outcomes: delete own" on outcomes
  for delete using (
    exists (
      select 1 from diagnoses
      join sessions on sessions.id = diagnoses.session_id
      where diagnoses.id = outcomes.diagnosis_id
        and sessions.user_id = auth.uid()
    )
  );
