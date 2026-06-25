import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
