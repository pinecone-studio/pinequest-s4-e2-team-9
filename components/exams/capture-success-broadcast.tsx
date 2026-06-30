"use client";

import { useEffect, useRef } from "react";
import { supabaseClient } from "@/lib/supabase-client";

const isDev = process.env.NODE_ENV === "development";

export default function CaptureSuccessBroadcast({
  examId,
  submissionId,
}: {
  examId: string;
  submissionId?: string;
}) {
  const sentRef = useRef(false);

  useEffect(() => {
    const channel = supabaseClient.channel(`exam-submissions:${examId}`, {
      config: { broadcast: { ack: true, self: false } },
    });

    channel.subscribe(async (status, error) => {
      log("[capture-success-broadcast] subscription status", {
        examId,
        status,
        error,
      });

      if (status !== "SUBSCRIBED" || sentRef.current) {
        return;
      }

      sentRef.current = true;
      const payload = {
        examId,
        submissionId,
        timestamp: Date.now(),
        source: "capture-success",
      };

      log("[capture-success-broadcast] sending", payload);
      const result = await channel.send({
        type: "broadcast",
        event: "submission_changed",
        payload,
      });
      log("[capture-success-broadcast] send result", { examId, result });
    });

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [examId, submissionId]);

  return null;
}

function log(message: string, payload: unknown) {
  if (isDev) {
    console.log(message, payload);
  }
}
