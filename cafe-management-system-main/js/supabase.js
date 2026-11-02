/**
 * ============================================================
 * MOCHA & MISO — SUPABASE CLIENT CONFIGURATION
 * Connects Frontend directly to PostgreSQL database via Supabase
 * ============================================================
 */

// Supabase Project Credentials
// Replace with your project details from: Supabase Dashboard -> Project Settings -> API
const SUPABASE_CONFIG = {
  url: window.ENV_SUPABASE_URL || localStorage.getItem('mocha_supabase_url') || 'https://aueihxecpcfufgwqhxdl.supabase.co',
  anonKey: window.ENV_SUPABASE_ANON_KEY || localStorage.getItem('mocha_supabase_anon_key') || ''
};

let supabaseClient = null;

function hasValidSupabaseConfig() {
  const url = (SUPABASE_CONFIG.url || '').trim();
  const key = (SUPABASE_CONFIG.anonKey || '').trim();
  return Boolean(url && key && !key.includes('YOUR_') && !key.includes('***') && !key.includes('anonKey'));
}

function initSupabase() {
  if (!hasValidSupabaseConfig()) {
    console.warn('[Supabase Init Notice] Missing/placeholder Supabase URL or anon key; cloud authentication and data are unavailable.');
    window.supabaseClient = null;
    window.supabaseDb = null;
    window.db = null;
    return null;
  }

  if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      window.supabaseClient = supabaseClient;
      window.supabaseDb = supabaseClient;
      window.db = supabaseClient; // compatibility alias
      return supabaseClient;
    } catch (e) {
      console.error('[Supabase Init Error] Could not initialize the configured Supabase client.', e);
      window.supabaseClient = null;
      window.supabaseDb = null;
      window.db = null;
      return null;
    }
  } else {
    console.error('[Supabase Init Error] Supabase JS SDK did not load; check CDN/network access.');
    window.supabaseClient = null;
    window.supabaseDb = null;
    window.db = null;
  }
  return null;
}

// Auto init on script load
if (typeof window !== 'undefined') {
  initSupabase();
}