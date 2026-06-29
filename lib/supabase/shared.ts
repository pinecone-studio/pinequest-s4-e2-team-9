import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupportedStorage } from "@supabase/supabase-js";

export const authStorageKey = "duntuslah-auth";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export function createSupabaseClient(storage: SupportedStorage): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing Supabase auth environment variables");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      storage,
      storageKey: authStorageKey,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
