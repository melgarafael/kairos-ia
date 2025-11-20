"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
}

