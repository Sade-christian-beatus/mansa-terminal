-- ============================================================
-- MANSA Terminal — Row Level Security (défense en profondeur)
-- ============================================================
-- Contexte :
--   • Le frontend lit les données UNIQUEMENT via FastAPI, jamais via le client
--     Supabase (vérifié : aucun supabase.from()/rpc() dans apps/web).
--   • FastAPI se connecte avec le rôle `postgres` (propriétaire des tables) qui
--     CONTOURNE la RLS par défaut (on n'active PAS « FORCE ROW LEVEL SECURITY »).
--   • Donc activer la RLS ne casse pas l'app : ça bloque seulement l'accès
--     direct via les clés `anon` / `authenticated` (extension navigateur, fuite
--     de clé anon, etc.).
--
-- Idempotent : peut être ré-exécuté sans erreur.
-- À appliquer via Supabase MCP (apply_migration) ou le SQL editor.
-- ============================================================

-- ── 1) Tables de données / référentiel : verrouillage total côté client ─────
--    Aucune policy permissive → anon & authenticated ne voient rien en direct.
--    FastAPI (propriétaire) continue de lire/écrire normalement.
ALTER TABLE public.countries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_indicators     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_ingestion_logs  ENABLE ROW LEVEL SECURITY;

-- ── 2) Tables liées à l'utilisateur : RLS + policies scopées ────────────────
--    Si le frontend lit un jour ces tables directement (client authentifié),
--    chaque utilisateur ne voit QUE ses propres lignes.
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_queries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys       ENABLE ROW LEVEL SECURITY;

-- users : l'utilisateur ne lit/écrit que sa propre fiche
DROP POLICY IF EXISTS "own user row (select)" ON public.users;
CREATE POLICY "own user row (select)" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "own user row (update)" ON public.users;
CREATE POLICY "own user row (update)" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- subscriptions : lecture de son propre abonnement
DROP POLICY IF EXISTS "own subscription (select)" ON public.subscriptions;
CREATE POLICY "own subscription (select)" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ai_queries : lecture de son propre historique IA
DROP POLICY IF EXISTS "own ai queries (select)" ON public.ai_queries;
CREATE POLICY "own ai queries (select)" ON public.ai_queries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- api_keys : lecture de ses propres clés (jamais le hash en clair côté client)
DROP POLICY IF EXISTS "own api keys (select)" ON public.api_keys;
CREATE POLICY "own api keys (select)" ON public.api_keys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 3) Révoquer les droits par défaut accordés au rôle anon ─────────────────
--    Ceinture + bretelles : même sans policy, anon ne doit avoir aucun GRANT.
REVOKE ALL ON public.countries, public.macro_indicators, public.fx_rates,
              public.knowledge_documents, public.data_ingestion_logs
       FROM anon;
