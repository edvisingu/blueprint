# Supabase Setup (Masterbuild §8)

> **CRITICAL (§8.1):** Dr. D already has a live Supabase project:
> **`bvxhicdnaordolguuyal`**. **Do NOT create a new project** — a new project
> would strand the existing schema and data. Get credentials via Bitwarden.

## Connect to the existing project

1. Sign in at https://supabase.com with Dr. D's Google Workspace account.
2. Select project **bvxhicdnaordolguuyal**.
3. Settings > API — copy the Project URL and **service_role** key.
4. Store both in Bitwarden; set `SUPABASE_URL` and `SUPABASE_KEY` in the VPS `.env`.
5. Database > Tables — review what already exists **before** running anything.
6. Only run `schema.sql` after confirming the tables don't already exist
   (it is `IF NOT EXISTS`-safe, but review first anyway).

## Run the schema

Database > SQL Editor > paste `schema.sql` > Run.
Creates: pgvector extension, `ai_memory`, `leads`, `content_queue`,
`products`, `members` — all with RLS enabled (service_role-only until
auth policies are added).

## Storage buckets (§8.3)

Create in Storage:

| Bucket | Public | Contents |
|---|---|---|
| `brand-assets` | YES | Logos, brand images, Canva exports, social assets |
| `course-content` | NO | Course videos, PDFs, lesson materials |
| `resumes` | NO | CrediHire resume uploads |
| `avatars` | YES | HeyGen / AI avatar output |
| `audio` | YES | ElevenLabs voice output |
