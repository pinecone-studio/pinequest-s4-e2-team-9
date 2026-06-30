"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabase-client";

type SubmissionRealtimeRow = {
  id?: string;
  examId?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type SubmissionRealtimePayload =
  | RealtimePostgresInsertPayload<SubmissionRealtimeRow>
  | RealtimePostgresUpdatePayload<SubmissionRealtimeRow>;

type SubmissionBroadcastPayload = {
  examId?: string;
  submissionId?: string;
  timestamp?: number;
  source?: string;
};

const isDev = process.env.NODE_ENV === "development";

export default function SubmissionsRealtimeRefresh({ examId }: { examId: string }) {
  const router = useRouter();
  const lastRefreshKeyRef = useRef("");
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    log("[submissions-realtime] mounted", { examId });

    const refreshOnce = ({
      source,
      submissionId,
      eventAt,
      eventType,
    }: {
      source: "broadcast" | "postgres";
      submissionId?: string;
      eventAt?: string | number | null;
      eventType?: string;
    }) => {
      const now = Date.now();
      const key = `${submissionId ?? "unknown"}:${eventAt ?? "unknown"}`;

      if (lastRefreshKeyRef.current === key || now - lastRefreshAtRef.current < 800) {
        log("[submissions-realtime] ignored event", {
          reason: "duplicate/throttled refresh",
          source,
          key,
        });
        return;
      }

      lastRefreshKeyRef.current = key;
      lastRefreshAtRef.current = now;
      log("[submissions-realtime] router.refresh()", {
        examId,
        source,
        eventType,
        submissionId,
      });
      router.refresh();
    };

    const refreshForBroadcast = (message: { payload: SubmissionBroadcastPayload }) => {
      const payload = message.payload;
      log("[submissions-realtime] broadcast", payload);

      if (payload.examId !== examId) {
        log("[submissions-realtime] ignored event", {
          reason: "broadcast examId mismatch",
          expectedExamId: examId,
          receivedExamId: payload.examId,
        });
        return;
      }

      refreshOnce({
        source: "broadcast",
        submissionId: payload.submissionId,
        eventAt: payload.timestamp,
        eventType: "submission_changed",
      });
    };

    const refreshForExam = (payload: SubmissionRealtimePayload) => {
      log("[submissions-realtime] postgres payload", payload);

      if (payload.new.examId !== examId) {
        log("[submissions-realtime] ignored event", {
          reason: "postgres examId mismatch",
          expectedExamId: examId,
          receivedExamId: payload.new.examId,
        });
        return;
      }

      refreshOnce({
        source: "postgres",
        eventType: payload.eventType,
        submissionId: payload.new.id,
        eventAt: payload.new.updatedAt ?? payload.new.createdAt,
      });
    };

    const channel = supabaseClient
      .channel(`exam-submissions:${examId}`)
      .on("broadcast", { event: "submission_changed" }, refreshForBroadcast)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Submission",
        },
        refreshForExam
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Submission",
        },
        refreshForExam
      )
      .subscribe((status, error) => {
        log("[submissions-realtime] subscription status", {
          examId,
          status,
          error,
        });
      });

    return () => {
      log("[submissions-realtime] unmounted", { examId });
      supabaseClient.removeChannel(channel);
    };
  }, [examId, router]);

  return null;
}

function log(message: string, payload: unknown) {
  if (isDev) {
    console.log(message, payload);
  }
}
