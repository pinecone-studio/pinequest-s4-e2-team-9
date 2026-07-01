"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import AppSidebar from "@/components/layout/app-sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isPublicPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    /^\/exams\/[^/]+\/capture\/?$/.test(pathname);

  return (
    <div className="min-h-screen bg-[#F7F1E8]">
      {isPublicPage ? null : (
        <AppSidebar
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        />
      )}
      <main
        className={`min-h-screen transition-all duration-200 ${
          isPublicPage ? "" : isSidebarCollapsed ? "md:pl-20" : "md:pl-[260px]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
