"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import OriginalMaterialPreview from "@/components/exams/original-material-preview";

type AnswerKeyReviewLayoutProps = {
  children: ReactNode;
  examId: string;
  originalMaterialUrl?: string | null;
  originalMaterialName?: string | null;
  originalMaterialMimeType?: string | null;
  originalMaterialMissingReason?: "none" | "not-uploaded" | "old-not-persisted";
};

export default function AnswerKeyReviewLayout({
  children,
  examId,
  originalMaterialUrl,
  originalMaterialName,
  originalMaterialMimeType,
  originalMaterialMissingReason = "none",
}: AnswerKeyReviewLayoutProps) {
  const [showOriginalMaterial, setShowOriginalMaterial] = useState(false);

  return (
    <div className={showOriginalMaterial ? "space-y-4" : "mx-auto max-w-4xl space-y-4"}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowOriginalMaterial((current) => !current)}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
        >
          {showOriginalMaterial ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
          {showOriginalMaterial ? "Эх материалыг нуух" : "Эх материалыг харах"}
        </button>
      </div>

      {showOriginalMaterial ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,44vw)] lg:items-start">
          <div className="min-w-0">{children}</div>
          <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-140px)] lg:overflow-auto">
            <OriginalMaterialPreview
              examId={examId}
              url={originalMaterialUrl}
              name={originalMaterialName}
              mimeType={originalMaterialMimeType}
              missingReason={originalMaterialMissingReason}
            />
          </aside>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
