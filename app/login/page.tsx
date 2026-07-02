import Link from "next/link";
import { LogIn } from "lucide-react";
import { loginAction } from "@/actions/auth-actions";
import LoadingSubmitButton from "@/components/ui/loading-submit-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const error = getErrorMessage(getQueryValue(query.error));

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F1E8] px-4 py-10">
      <main className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-[#8B5E3C]">ДүнТуслах AI</p>
          <h1 className="mt-2 text-2xl font-bold text-stone-950">Нэвтрэх</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Багшийн самбар руу орохын тулд Supabase Auth хэрэглэгчээр нэвтэрнэ.
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            {error}
          </div>
        ) : null}

        <form action={loginAction} className="mt-5 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Имэйл
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Нууц үг
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
          </div>

          <LoadingSubmitButton loadingText="Нэвтэрч байна..." className="min-h-11 w-full">
            <LogIn className="size-4" aria-hidden="true" />
            Нэвтрэх
          </LoadingSubmitButton>
        </form>

        <p className="mt-5 text-center text-sm text-stone-600">
          Бүртгэлгүй юу?{" "}
          <Link href="/signup" className="font-semibold text-[#8B5E3C] hover:text-[#734d31]">
            Бүртгүүлэх
          </Link>
        </p>
      </main>
    </div>
  );
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(error?: string) {
  if (error === "required") {
    return "Имэйл болон нууц үгээ оруулна уу.";
  }

  if (error === "credentials") {
    return "Имэйл эсвэл нууц үг буруу байна.";
  }

  return error ? "Нэвтрэх үед алдаа гарлаа. Дахин оролдоно уу." : "";
}
