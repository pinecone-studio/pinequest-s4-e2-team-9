"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AppSidebar from "@/components/layout/app-sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    /^\/exams\/[^/]+\/capture\/?$/.test(pathname);

  return (
    <div className="min-h-screen bg-[#F7F1E8]">
      {isPublicPage ? null : <AppSidebar />}
      <main className={`min-h-screen ${isPublicPage ? "" : "md:pl-[260px]"}`}>
        {children}
      </main>
    </div>
  );
}
