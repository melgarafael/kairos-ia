import { supabaseConfig } from "@/lib/supabase/config";

type AuditPayload = {
  user_id: string;
  event: string;
  metadata?: Record<string, any>;
};

export async function auditAgentEvent(payload: AuditPayload) {
  console.info("[audit] agent-event", payload);

  if (!supabaseConfig.serviceRoleKey) return;

  try {
    const res = await fetch(`${supabaseConfig.url}/rest/v1/admin_ai_audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.serviceRoleKey,
        Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        ...payload,
        metadata: payload.metadata ?? {},
        created_at: new Date().toISOString()
      })
    });
    if (!res.ok) {
      console.warn("[audit] failed to persist", await res.text());
    }
  } catch (error) {
    console.error("[audit] error", error);
  }
}

