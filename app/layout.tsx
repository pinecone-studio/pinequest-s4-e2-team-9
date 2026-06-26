import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppShell from "@/components/layout/app-shell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DunTuslah AI",
  description: "Шалгалтын материалыг хурдан шалгах багшийн туслах систем",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${inter.variable} min-h-full font-sans`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
