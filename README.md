# AI Bottleneck Diagnostic

A short conversational AI interview that diagnoses your real bottleneck with AI in 4 turns.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase (auth + Postgres + RLS)
- Anthropic API (`claude-sonnet-4-5`)
- Tailwind CSS

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the values from your Supabase project and Anthropic dashboard into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
```

> **Critical:** `ANTHROPIC_API_KEY` must never have the `NEXT_PUBLIC_` prefix. It is only used in the server route `/api/chat`.

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in the Supabase dashboard.
3. Paste the entire contents of `supabase-setup.sql` and click **Run**.
4. This creates the four tables (`sessions`, `messages`, `diagnoses`, `outcomes`) and all RLS policies.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in [vercel.com/new](https://vercel.com/new).
3. Add the three environment variables in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
4. Deploy. Vercel auto-detects Next.js — no extra config needed.

---

## Row-Level Security Test (two-user test)

This confirms that User A cannot read User B's sessions even with direct API calls.

### Steps

1. **Browser A** — sign up as `user-a@example.com`, start a session. Note the session UUID from the URL (`/chat/<uuid>`).

2. **Browser B** (incognito or a different browser) — sign up as `user-b@example.com`.

3. In **Browser B**, open the browser DevTools console and run:

```js
// Replace with your Supabase URL and anon key
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_ANON_KEY')

// Sign in as user B first (already done via the app), then:
const { data, error } = await supabase
  .from('sessions')
  .select('*')
  .eq('id', 'USER_A_SESSION_UUID')

console.log(data, error)
```

4. **Expected result:** `data` is `[]` (empty array) and `error` is `null`. RLS silently returns no rows — it does not throw a 403, it simply returns nothing, because the policy filters out rows that don't belong to the authenticated user.

5. Confirm by also trying:

```js
const { data } = await supabase.from('sessions').select('*')
console.log(data) // Only user B's own sessions appear
```

---

## App flow

1. `/login` — sign in or sign up
2. `/dashboard` — list of past sessions with their diagnostic sentence; "Start new session" button
3. `/chat/[sessionId]` — 4-turn interview; turn counter shown; input locks after turn 4
4. `/result/[sessionId]` — diagnostic sentence displayed prominently; commit to a 24-hour action; toggle full transcript
