"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  School,
} from "lucide-react";
import { logoutAction } from "@/actions/auth-actions";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Хянах самбар", icon: LayoutDashboard },
  { href: "/classrooms", label: "Ангиуд", icon: School },
  { href: "/exams/new", label: "Шинэ шалгалт", icon: FilePlus2 },
];

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden border-r border-stone-200 bg-[#FAF7F1] py-5 shadow-sm transition-all duration-200 md:flex md:flex-col",
        collapsed ? "w-20 px-3" : "w-[260px] px-4"
      )}
    >
      <div
        className={cn(
          "flex gap-2",
          collapsed ? "flex-col items-center" : "items-start justify-between"
        )}
      >
        <Link
          href="/dashboard"
          title="ДүнТуслах AI"
          aria-label="ДүнТуслах AI"
          className={cn(
            "rounded-xl py-2 transition-colors duration-200 hover:bg-stone-100",
            collapsed ? "flex size-10 items-center justify-center" : "px-3"
          )}
        >
          {collapsed ? (
            <Bot className="size-5 text-[#8B5E3C]" aria-hidden="true" />
          ) : (
            <>
              <p className="text-lg font-bold tracking-tight text-stone-950">
                ДүнТуслах AI
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                Шалгалтын дүн засах туслах
              </p>
            </>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Цэс дэлгэх" : "Цэс хураах"}
          title={collapsed ? "Цэс дэлгэх" : "Цэс хураах"}
          className="flex size-9 items-center justify-center rounded-lg text-stone-600 transition-colors duration-200 hover:bg-stone-100 hover:text-stone-950"
        >
          {collapsed ? (
            <ChevronRight className="size-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>

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
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-[#8B5E3C] text-white shadow-sm"
                  : "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className={collapsed ? "hidden" : "inline"}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <form action={logoutAction}>
          <button
            type="submit"
            title={collapsed ? "Гарах" : undefined}
            aria-label={collapsed ? "Гарах" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-950",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            <span className={collapsed ? "hidden" : "inline"}>Гарах</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
