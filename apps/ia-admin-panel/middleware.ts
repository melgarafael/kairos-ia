import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedPaths = [/^\/admin/, /^\/app/, /^\/meu-design/, /^\/diario/, /^\/ia/, /^\/onboarding/, /^\/api\/ai/, /^\/api\/human-design/];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Configuração do Supabase diretamente no middleware (Edge Runtime compatible)
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL_KAIROS ??
    process.env.SUPABASE_URL_KAIROS ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "";

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_KAIROS ??
    process.env.SUPABASE_ANON_KEY_KAIROS ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieEncoding: "raw",
    cookies: {
      getAll() {
        return req.cookies.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        });
      }
    }
  });

  const isProtected = protectedPaths.some((regex) => regex.test(req.nextUrl.pathname));

  if (!isProtected) return res;

  // Verifica se há cookies de autenticação do Supabase
  // O Supabase SSR armazena tokens em cookies com prefixo sb-
  const hasAuthCookie = req.cookies.getAll().some(
    (cookie) => cookie.name.startsWith("sb-") && (cookie.name.includes("auth-token") || cookie.name.includes("access-token"))
  );
  
  // Se não houver cookie de autenticação, redireciona para login
  if (!hasAuthCookie) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*", "/meu-design/:path*", "/diario/:path*", "/ia/:path*", "/onboarding/:path*", "/api/ai/:path*", "/api/human-design/:path*"]
};

