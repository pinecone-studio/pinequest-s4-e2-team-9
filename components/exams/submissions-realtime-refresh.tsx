"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase-client";

export default function SubmissionsRealtimeRefresh({ examId }: { examId: string }) {
  const router = useRouter();

  useEffect(() => {
    const refreshIfDraft = (payload: { new: { status?: unknown } }) => {
      if (payload.new.status === "DRAFT") {
        router.refresh();
      }
    };
    const channel = supabaseClient
      .channel(`exam-submissions-${examId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Submission",
          filter: `examId=eq.${examId}`,
        },
        refreshIfDraft
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Submission",
          filter: `examId=eq.${examId}`,
        },
        refreshIfDraft
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [examId, router]);

  return null;
}
