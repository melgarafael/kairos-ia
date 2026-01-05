import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/supabase/config";

const protectedPaths = [/^\/admin/, /^\/app/, /^\/meu-design/, /^\/diario/, /^\/ia/, /^\/onboarding/, /^\/api\/ai/, /^\/api\/human-design/];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
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

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*", "/meu-design/:path*", "/diario/:path*", "/ia/:path*", "/onboarding/:path*", "/api/ai/:path*", "/api/human-design/:path*"]
};

