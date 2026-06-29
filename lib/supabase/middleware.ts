import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, createSupabaseClient } from "@/lib/supabase/shared";

export async function updateAuthSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createSupabaseClient({
    getItem: (key) => request.cookies.get(key)?.value ?? null,
    setItem: (key, value) => {
      request.cookies.set(key, value);
      response.cookies.set(key, value, cookieOptions);
    },
    removeItem: (key) => {
      request.cookies.delete(key);
      response.cookies.delete(key);
    },
    isServer: true,
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
