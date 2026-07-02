"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/login?error=required");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=credentials");
  }

  redirect("/dashboard");
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!email || !password || !confirmPassword) {
    redirect("/signup?error=required");
  }

  if (password !== confirmPassword) {
    redirect("/signup?error=match");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect("/signup?error=signup");
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();

  await supabase.auth.signOut();
  redirect("/login");
}
