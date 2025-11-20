import { redirect } from "next/navigation";
import { getSession } from "./get-session";

const ALLOWED_ROLES = new Set(["staff", "founder", "admin"]);

type GuardOptions = {
  redirectOnFail?: boolean;
};

export async function requireStaffSession(options: GuardOptions = {}) {
  const session = await getSession();
  const redirectOnFail = options.redirectOnFail ?? true;

  if (!session) {
    if (redirectOnFail) redirect("/login");
    throw new Error("Sessão não encontrada.");
  }

  const role =
    (session.user.user_metadata?.role as string | undefined) ??
    session.user.app_metadata?.role;

  if (role && ALLOWED_ROLES.has(role)) {
    return session;
  }

  if (redirectOnFail) {
    redirect("/login?reason=not_authorized");
  }
  throw new Error("Usuário sem permissão.");
}

