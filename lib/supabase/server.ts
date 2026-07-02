import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookieOptions, createSupabaseClient } from "@/lib/supabase/shared";

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createSupabaseClient({
    getItem: (key) => cookieStore.get(key)?.value ?? null,
    setItem: (key, value) => {
      try {
        cookieStore.set(key, value, cookieOptions);
      } catch {
        // Server Components can read cookies, but cannot mutate response cookies.
      }
    },
    removeItem: (key) => {
      try {
        cookieStore.delete(key);
      } catch {
        // Server Components can read cookies, but cannot mutate response cookies.
      }
    },
    isServer: true,
  });
}

export async function requireCurrentUser(): Promise<User> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
