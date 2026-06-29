"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilePlus2, LayoutDashboard, LogOut, School } from "lucide-react";
import { logoutAction } from "@/actions/auth-actions";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Хянах самбар", icon: LayoutDashboard },
  { href: "/classrooms", label: "Ангиуд", icon: School },
  { href: "/exams/new", label: "Шинэ шалгалт", icon: FilePlus2 },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-stone-200 bg-[#FAF7F1] px-4 py-5 shadow-sm md:flex md:flex-col">
      <Link href="/dashboard" className="rounded-xl px-3 py-2 transition-colors duration-200 hover:bg-stone-100">
        <p className="text-lg font-bold tracking-tight text-stone-950">ДүнТуслах AI</p>
        <p className="mt-0.5 text-xs text-stone-500">Шалгалтын дүн засах туслах</p>
      </Link>

      <nav className="mt-8 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-[#8B5E3C] text-white shadow-sm"
                  : "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-950"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Гарах
          </button>
        </form>
      </div>
    </aside>
  );
}
