/**
 * Script para aplicar a migration de metadata na tabela ai_messages
 * 
 * Execute com: npx tsx scripts/apply-metadata-migration.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Variáveis de ambiente necessárias:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  console.log("🚀 Aplicando migration: ai_messages_add_metadata...\n");

  const migrationSQL = `
    ALTER TABLE public.ai_messages 
    ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

    COMMENT ON COLUMN public.ai_messages.metadata IS 'Metadados da mensagem como tool_calls, usage, etc.';
  `;

  const { error } = await supabase.rpc("exec_sql", { sql: migrationSQL }).single();

  if (error) {
    // Se o RPC não existir, tentar via query direta (requer extensão)
    console.log("⚠️  RPC não disponível, tentando via Supabase Dashboard...");
    console.log("\n📋 Por favor, execute o seguinte SQL no Supabase Dashboard:\n");
    console.log("═".repeat(60));
    console.log(migrationSQL);
    console.log("═".repeat(60));
    console.log("\n📍 Acesse: https://supabase.com/dashboard/project/[SEU_PROJECT]/sql/new");
    console.log("\n⚡ Ou execute diretamente:\n");
    console.log("   1. Vá ao Supabase Dashboard → SQL Editor");
    console.log("   2. Cole o SQL acima");
    console.log("   3. Clique em 'Run'");
    return;
  }

  console.log("✅ Migration aplicada com sucesso!");
}

applyMigration().catch(console.error);

