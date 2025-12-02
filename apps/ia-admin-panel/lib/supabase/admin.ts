import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

/**
 * Supabase Admin Client (uses service_role_key)
 * Use for server-side operations that need to bypass RLS
 */
export function createSupabaseAdminClient() {
  if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin client"
    );
  }

  return createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

