"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilePlus2, LayoutDashboard, School } from "lucide-react";
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

      <div className="mt-auto rounded-xl border border-amber-100 bg-white/70 p-4">
        <p className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-[#8B5E3C]">
          Demo MVP
        </p>
        <p className="mt-3 text-xs leading-5 text-stone-600">
          AI шалгалтын материал уншиж, дүн тооцоолно.
        </p>
      </div>
    </aside>
  );
}
