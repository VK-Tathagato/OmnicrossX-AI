-- ============================================================
-- OmniX AI — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Profiles (extends Supabase Auth) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Research Sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  query TEXT NOT NULL,
  expanded_queries JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','complete','failed')),
  papers_found INTEGER DEFAULT 0,
  current_step TEXT DEFAULT 'Initializing',
  progress_pct INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON research_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON research_sessions(status);

-- ─── Papers ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arxiv_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  authors JSONB DEFAULT '[]',
  published_date DATE,
  categories JSONB DEFAULT '[]',
  pdf_url TEXT,
  pdf_stored_path TEXT,
  extracted_text TEXT,
  is_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_papers_arxiv ON papers(arxiv_id);

-- ─── Session Papers (join) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_papers (
  session_id UUID REFERENCES research_sessions(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  relevance_score FLOAT DEFAULT 0.8,
  PRIMARY KEY (session_id, paper_id)
);

-- ─── Embeddings (pgvector) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_ivfflat
  ON embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_embeddings_paper ON embeddings(paper_id);

-- ─── Similarity Search RPC ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding VECTOR(768),
  match_count INTEGER DEFAULT 25,
  filter_paper_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  paper_id UUID,
  chunk_index INTEGER,
  chunk_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.paper_id,
    e.chunk_index,
    e.chunk_text,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE
    (filter_paper_ids IS NULL OR e.paper_id = ANY(filter_paper_ids))
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ─── Solutions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES research_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  full_content JSONB DEFAULT '{}',
  feasibility_score FLOAT DEFAULT 0.5 CHECK (feasibility_score >= 0 AND feasibility_score <= 1),
  cost_score FLOAT DEFAULT 0.5 CHECK (cost_score >= 0 AND cost_score <= 1),
  innovation_score FLOAT DEFAULT 0.5 CHECK (innovation_score >= 0 AND innovation_score <= 1),
  confidence_level FLOAT DEFAULT 0.5 CHECK (confidence_level >= 0 AND confidence_level <= 1),
  tags JSONB DEFAULT '[]',
  domains JSONB DEFAULT '[]',
  is_speculative BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solutions_session ON solutions(session_id);

-- ─── Citations ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_id UUID REFERENCES solutions(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES papers(id) ON DELETE SET NULL,
  chunk_text TEXT,
  relevance FLOAT DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citations_solution ON citations(solution_id);

-- ─── Chat History ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES research_sessions(id) ON DELETE CASCADE,
  solution_id UUID REFERENCES solutions(id) ON DELETE SET NULL,
  user_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_solution ON chat_history(solution_id);

-- ─── Saved Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('solution','paper','session')),
  item_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_items(user_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

-- Disable RLS on backend-managed tables to allow anon-key inserts
ALTER TABLE research_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE solutions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE papers DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_papers DISABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings DISABLE ROW LEVEL SECURITY;
ALTER TABLE citations DISABLE ROW LEVEL SECURITY;

-- Profiles: users see only their own
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Sessions: users see only their own (or anonymous)
DROP POLICY IF EXISTS "Users can view own sessions" ON research_sessions;
CREATE POLICY "Users can view own sessions" ON research_sessions FOR SELECT
  USING (auth.uid()::text = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert sessions" ON research_sessions;
CREATE POLICY "Users can insert sessions" ON research_sessions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

-- Solutions: viewable if session is accessible
DROP POLICY IF EXISTS "Solutions viewable" ON solutions;
CREATE POLICY "Solutions viewable" ON solutions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM research_sessions s
    WHERE s.id = solutions.session_id
    AND (s.user_id = auth.uid()::text OR s.user_id IS NULL)
  )
);

-- Chat history
DROP POLICY IF EXISTS "Users can view own chat" ON chat_history;
CREATE POLICY "Users can view own chat" ON chat_history FOR SELECT
  USING (auth.uid()::text = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert chat" ON chat_history;
CREATE POLICY "Users can insert chat" ON chat_history FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

-- Saved items
DROP POLICY IF EXISTS "Users can view own saved" ON saved_items;
CREATE POLICY "Users can view own saved" ON saved_items FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert saved" ON saved_items;
CREATE POLICY "Users can insert saved" ON saved_items FOR INSERT WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete saved" ON saved_items;
CREATE POLICY "Users can delete saved" ON saved_items FOR DELETE USING (auth.uid()::text = user_id);

-- ─── Storage Bucket ───────────────────────────────────────────────────────────
-- Run this to create the PDF storage bucket:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('omnix-papers', 'omnix-papers', false);
