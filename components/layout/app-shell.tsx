import type { ReactNode } from "react";
import AppSidebar from "@/components/layout/app-sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F1E8]">
      <AppSidebar />
      <main className="min-h-screen md:pl-[260px]">{children}</main>
    </div>
  );
}
