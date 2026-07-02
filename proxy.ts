import { NextResponse, type NextRequest } from "next/server";
import { updateAuthSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (!isProtectedRoute(pathname) && !isAuthPage) {
    return NextResponse.next();
  }

  const { response, user } = await updateAuthSession(request);

  if (isAuthPage) {
    return user ? NextResponse.redirect(new URL("/dashboard", request.url)) : response;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

function isProtectedRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname === "/exams/new" ||
    pathname === "/classrooms" ||
    pathname.startsWith("/classrooms/") ||
    /^\/exams\/[^/]+\/(answer-key|submissions|results|setup|upload)(?:\/.*)?$/.test(pathname)
  );
}
