-- Enable extensions used by the app.
-- pgvector: RAG embeddings (Phase 8)
-- pgcrypto: gen_random_uuid() etc.
-- citext:   case-insensitive text (emails, slugs)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
