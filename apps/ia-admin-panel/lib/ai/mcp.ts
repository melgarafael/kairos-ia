const MCP_ENDPOINT = "https://qckjiolragbvvpqvfhrj.supabase.co/functions/v1/mcp-server";

type McpResponse = {
  jsonrpc: string;
  id: string | number | null;
  result?: {
    content: Array<{ type: "text"; text: string }>;
  };
  error?: {
    code: number;
    message: string;
  };
};

export async function invokeMcpTool(tool: string, args: Record<string, unknown>) {
  const body = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "tools/call",
    params: {
      name: tool,
      arguments: args
    }
  };

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const adminSecret = process.env.ADMIN_ANALYTICS_SECRET ?? "";

  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      "x-admin-secret": adminSecret
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP error: ${text}`);
  }

  const json = (await res.json()) as McpResponse;

  if (json.error) {
    throw new Error(json.error.message);
  }

  const textChunk = json.result?.content?.[0]?.text ?? "";
  return textChunk;
}

