"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Digite um email válido."),
  password: z.string().min(6, "Senha precisa de pelo menos 6 caracteres.")
});

export async function loginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const parseResult = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parseResult.success) {
    return { error: parseResult.error.errors[0]?.message ?? "Erro desconhecido." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parseResult.data);

  if (error || !data.session) {
    return {
      error:
        error?.message ??
        "Não foi possível autenticar. Verifique as credenciais e tente novamente."
    };
  }

  redirect("/admin");
}

