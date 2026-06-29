import Link from "next/link";
import { UserPlus } from "lucide-react";
import { signupAction } from "@/actions/auth-actions";
import LoadingSubmitButton from "@/components/ui/loading-submit-button";

export default async function SignupPage({
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
          <h1 className="mt-2 text-2xl font-bold text-stone-950">Бүртгүүлэх</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Багшийн бүртгэл үүсгээд өөрийн анги, шалгалтаа удирдана.
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
            {error}
          </div>
        ) : null}

        <form action={signupAction} className="mt-5 space-y-4">
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
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Нууц үг давтах
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
          </div>

          <LoadingSubmitButton loadingText="Бүртгэж байна..." className="min-h-11 w-full">
            <UserPlus className="size-4" aria-hidden="true" />
            Бүртгүүлэх
          </LoadingSubmitButton>
        </form>

        <p className="mt-5 text-center text-sm text-stone-600">
          Бүртгэлтэй юу?{" "}
          <Link href="/login" className="font-semibold text-[#8B5E3C] hover:text-[#734d31]">
            Нэвтрэх
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
    return "Бүх талбарыг бөглөнө үү.";
  }

  if (error === "match") {
    return "Нууц үг давхцахгүй байна.";
  }

  if (error === "signup") {
    return "Бүртгэл үүсгэж чадсангүй. Имэйл эсвэл нууц үгээ шалгана уу.";
  }

  return error ? "Бүртгүүлэх үед алдаа гарлаа. Дахин оролдоно уу." : "";
}
