/* ============================================================
   supabase/config.js — Supabase Client Configuration
   ============================================================ */

// ⚠️  REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://yfwaoxntkeacutkzazmp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gn40BOfOQpZUJeejS3xeug_0azv-af2';

// Initialize Supabase client
// Import in HTML via: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
let supabaseClient = null;

function initSupabase() {
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase SDK not loaded.');
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabaseClient;
}

function getSupabase() {
  return supabaseClient || initSupabase();
}

// Export for module use
if (typeof module !== 'undefined') {
  module.exports = { initSupabase, getSupabase };
}
