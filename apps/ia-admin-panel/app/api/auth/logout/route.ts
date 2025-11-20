import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const redirectUrl = new URL("/login", request.url);
  const res = NextResponse.redirect(redirectUrl, { status: 302 });
  res.cookies.delete("sb-access-token");
  res.cookies.delete("sb-refresh-token");
  return res;
}

