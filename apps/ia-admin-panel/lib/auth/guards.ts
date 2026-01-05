import { redirect } from "next/navigation";
import { getSession } from "./get-session";

type GuardOptions = {
  redirectOnFail?: boolean;
};

/**
 * Kairos-authenticated guard (non-role-gated).
 * Keeps API/route protection while allowing all signed-in users.
 */
export async function requireStaffSession(options: GuardOptions = {}) {
  const session = await getSession();
  const redirectOnFail = options.redirectOnFail ?? true;

  if (!session) {
    if (redirectOnFail) redirect("/login");
    throw new Error("Sessão não encontrada.");
  }

  return session;
}

