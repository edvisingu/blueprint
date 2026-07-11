-- EdVisingU schema (Masterbuild §8.2) — run in the SQL Editor of the
-- EXISTING Supabase project bvxhicdnaordolguuyal. NEVER create a new project (§8.1).

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- AI Memory table (Supabase-based vector search as alternative to ChromaDB)
CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Leads / Student CRM
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  source TEXT,
  status TEXT DEFAULT 'new',
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Content Pipeline Queue
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  raw_content TEXT,
  final_content TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products / Courses / Offers
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  price NUMERIC,
  description TEXT,
  platform TEXT,
  url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Members / Subscribers
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  whop_id TEXT,
  plan TEXT,
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security on all tables.
-- RLS is ON with no policies yet: only the service_role key can access these
-- tables. Add user-level policies when auth is implemented.
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
