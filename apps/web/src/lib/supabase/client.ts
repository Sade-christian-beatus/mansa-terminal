/**
 * MANSA Terminal — Client Supabase (browser)
 * Utilisé dans les composants "use client" et les pages frontend.
 *
 * Le singleton est initialisé de façon LAZY (premier accès seulement)
 * pour éviter que createBrowserClient() soit appelé au chargement du module
 * pendant le prerendering statique Vercel, quand les env vars ne sont pas encore
 * disponibles côté serveur.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** @internal Instance créée au premier accès, jamais au chargement du module. */
let _instance: ReturnType<typeof createClient> | null = null;

function getInstance(): ReturnType<typeof createClient> {
  if (!_instance) _instance = createClient();
  return _instance;
}

/**
 * Singleton Supabase — proxy lazy.
 * Compatible avec tous les call-sites existants (`supabase.auth.X`).
 */
export const supabase = new Proxy(
  {} as ReturnType<typeof createClient>,
  {
    get(_target, prop: string) {
      return getInstance()[prop as keyof ReturnType<typeof createClient>];
    },
  }
);
