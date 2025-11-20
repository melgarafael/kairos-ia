import fs from "node:fs/promises";
import path from "node:path";

let cachedPrompt: string | null = null;

export async function getAgentPrompt() {
  // Sempre recarregar em desenvolvimento para facilitar testes
  if (process.env.NODE_ENV === "production" && cachedPrompt) {
    return cachedPrompt;
  }

  const promptPath = path.resolve(
    process.cwd(),
    "../../docs/agentes-mcp/AGENTE-GESTÃO-USER.md"
  );
  cachedPrompt = await fs.readFile(promptPath, "utf8");
  return cachedPrompt;
}

