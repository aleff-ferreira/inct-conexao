import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase da Plataforma de Seleções.
 *
 * A plataforma é OPCIONAL: sem as variáveis de ambiente o site continua 100%
 * estático (as rotas de inscrição/gestão mostram um aviso amigável). Para
 * ativar, crie um arquivo `.env` na raiz com:
 *
 *   VITE_SUPABASE_URL=https://<projeto>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon key>
 *
 * e rode `npm run build`. A anon key é pública por design — toda a segurança
 * vem das políticas RLS (ver supabase/migrations/001_platform.sql).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const platformEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Cliente singleton; chame apenas quando `platformEnabled` for true. */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) {
      throw new Error("Plataforma de Seleções não configurada (defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).");
    }
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE: o retorno do link mágico vem como "?code=..." (query), que não
        // conflita com o roteamento por hash (#/inscricao/...). No fluxo
        // implícito os tokens viriam num segundo "#..." e a sessão se perdia.
        flowType: "pkce",
      },
    });
  }
  return client;
}
