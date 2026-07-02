"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import OriginalMaterialPreview from "@/components/exams/original-material-preview";

type SubmissionMaterialReviewLayoutProps = {
  children: ReactNode;
  materialUrl?: string | null;
  materialName?: string | null;
  materialMimeType?: string | null;
  materialMissingReason?: "none" | "not-uploaded" | "old-not-persisted";
};

export default function SubmissionMaterialReviewLayout({
  children,
  materialUrl,
  materialName,
  materialMimeType,
  materialMissingReason = "none",
}: SubmissionMaterialReviewLayoutProps) {
  const [showMaterial, setShowMaterial] = useState(false);

  return (
    <div className={showMaterial ? "space-y-4" : "mx-auto max-w-5xl space-y-4"}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowMaterial((current) => !current)}
          className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
        >
          {showMaterial ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
          {showMaterial ? "Сурагчийн материалыг нуух" : "Сурагчийн материалыг харах"}
        </button>
      </div>

      {showMaterial ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,44vw)] lg:items-start">
          <div className="min-w-0">{children}</div>
          <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-140px)] lg:overflow-auto">
            <OriginalMaterialPreview
              url={materialUrl}
              name={materialName}
              mimeType={materialMimeType}
              missingReason={materialMissingReason}
              title="Сурагчийн материал"
              description="AI-ийн таньсан хариултыг сурагчийн эх зурагтай тулгаж шалгана уу."
              missingMessage="Сурагчийн эх материал хадгалагдаагүй байна."
              oldNotPersistedMessage="Сурагчийн эх материал хадгалагдаагүй байна."
              brokenFileMessage="Сурагчийн эх материалын файл олдсонгүй."
            />
          </aside>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
