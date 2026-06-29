"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResultsRefreshPoller() {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [router]);

  return null;
}
