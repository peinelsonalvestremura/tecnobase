/*
 * Configuração pública do Supabase. A chave publishable/anon é destinada ao
 * navegador; nunca coloque service_role ou outra chave secreta neste arquivo.
 */
const SUPABASE_URL = "https://wjkniaaaiglamgkcxmih.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_n6OYcUst4f06kfbUf_7ZmQ_JKKzOR6P";

window.tecnobaseSupabaseConfig = { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
try {
  if (!window.supabase?.createClient) throw new Error("A biblioteca de conexão não carregou.");
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
} catch (error) {
  // Keep diagnostics free of config values, URLs, keys, and credentials.
  window.tecnobaseConfigError = new Error("A configuração de conexão não pôde ser iniciada.");
  window.supabaseClient = null;
  console.error("Falha ao inicializar o cliente do Supabase. Confira a disponibilidade do serviço e as configurações públicas.");
}
