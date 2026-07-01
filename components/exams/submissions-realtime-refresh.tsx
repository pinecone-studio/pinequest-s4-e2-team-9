"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type SignatureResponse = {
  signature: string;
  active: number;
};

export default function SubmissionsRealtimeRefresh({
  examId,
  initialSignature,
  hasActiveSubmissions,
}: {
  examId: string;
  initialSignature: string;
  hasActiveSubmissions: boolean;
}) {
  const router = useRouter();
  const signatureRef = useRef(initialSignature);
  const activeRef = useRef(hasActiveSubmissions);
  const inFlightRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    signatureRef.current = initialSignature;
    activeRef.current = hasActiveSubmissions;
  }, [hasActiveSubmissions, initialSignature]);

  useEffect(() => {
    let cancelled = false;

    const schedule = (delay: number) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(poll, delay);
    };

    const poll = async () => {
      if (cancelled) {
        return;
      }

      if (inFlightRef.current) {
        schedule(activeRef.current ? 2000 : 6500);
        return;
      }

      const controller = new AbortController();
      inFlightRef.current = controller;

      try {
        const response = await fetch(`/api/exams/${examId}/submissions/signature`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as SignatureResponse;

        activeRef.current = data.active > 0;

        if (!data.signature || data.signature === signatureRef.current) {
          return;
        }

        signatureRef.current = data.signature;
        router.refresh();
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("[submissions-refresh] polling failed", error);
        }
      } finally {
        inFlightRef.current = null;

        if (!cancelled) {
          schedule(activeRef.current ? 2000 : 6500);
        }
      }
    };

    const pollNow = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      schedule(0);
    };

    schedule(activeRef.current ? 1500 : 6500);
    window.addEventListener("focus", pollNow);
    document.addEventListener("visibilitychange", pollNow);

    return () => {
      cancelled = true;

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      if (inFlightRef.current) {
        inFlightRef.current.abort();
      }

      window.removeEventListener("focus", pollNow);
      document.removeEventListener("visibilitychange", pollNow);
    };
  }, [examId, router]);

  return null;
}
