/**
 * ============================================================
 * MOCHA & MISO — SUPABASE CLIENT CONFIGURATION
 * Connects Frontend directly to PostgreSQL database via Supabase
 * ============================================================
 */

// Supabase Project Credentials
// Replace with your project details from: Supabase Dashboard -> Project Settings -> API
const SUPABASE_CONFIG = {
  url: window.ENV_SUPABASE_URL || localStorage.getItem('mocha_supabase_url') || "https://aueihxecpcfufgwqhxdl.supabase.co",
  anonKey: window.ENV_SUPABASE_ANON_KEY || localStorage.getItem('mocha_supabase_anon_key') || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZWloeGVjcGNmdWZnd3FoeGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3ODE1NjMsImV4cCI6MjEwNjM1NzU2M30.u0DGDU4yaKKcNsXP5iUnuyHtlarlTzMgvYHtouT-Ksg"
};

let supabaseClient = null;

function initSupabase() {
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
      console.warn('[Supabase Init Notice]', e.message);
      return null;
    }
  }
  return null;
}

// Auto init on script load
if (typeof window !== 'undefined') {
  initSupabase();
}
