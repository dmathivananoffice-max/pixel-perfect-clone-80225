// Single Supabase client for the whole app.
//
// Previously this module created a SECOND Supabase client alongside
// @/integrations/supabase/client — two GoTrue instances fighting over the
// same localStorage session ("Multiple GoTrueClient instances detected"
// warnings, duplicated token refreshes, divergent auth state).
//
// `authSupabase` is now just an alias of the one shared client so all
// existing imports keep working while there is exactly one client,
// one auth listener target, and one session lifecycle.
import { supabase } from "@/integrations/supabase/client";

export const authSupabase = supabase;
