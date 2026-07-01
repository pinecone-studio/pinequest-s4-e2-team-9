"use client";

import { useState } from "react";
import { ExternalLink, FileText, UploadCloud } from "lucide-react";
import { replaceExamMaterialAction } from "@/actions/exam-actions";

type OriginalMaterialPreviewProps = {
  examId?: string;
  url?: string | null;
  name?: string | null;
  mimeType?: string | null;
  missingReason?: "none" | "not-uploaded" | "old-not-persisted";
  title?: string;
  description?: string;
  missingMessage?: string;
  oldNotPersistedMessage?: string;
  brokenFileMessage?: string;
};

export default function OriginalMaterialPreview({
  examId,
  url,
  name,
  mimeType,
  missingReason = "none",
  title = "Эх материал",
  description = "AI-ийн гаргасан хариултын түлхүүрийг эх материалтай тулгаж шалгана уу.",
  missingMessage = "Эх материал хадгалагдаагүй байна.",
  oldNotPersistedMessage = "Энэ шалгалтын эх материал өмнө нь хадгалагдаагүй байна. Эх материалыг дахин оруулна уу.",
  brokenFileMessage = "Эх материалын файл олдсонгүй. Файлыг дахин оруулах шаардлагатай.",
}: OriginalMaterialPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const kind = getMaterialKind(url, mimeType);
  const previewUrl = url && !imageFailed ? url : null;
  const emptyMessage = imageFailed
    ? brokenFileMessage
    : missingReason === "old-not-persisted"
      ? oldNotPersistedMessage
      : missingMessage;

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-stone-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            {description}
          </p>
          {name ? <p className="mt-1 text-xs text-stone-500">{name}</p> : null}
        </div>
        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Шинэ цонхонд нээх
          </a>
        ) : null}
      </div>

      {!previewUrl ? (
        <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/70 p-6 text-center">
          <FileText className="mb-3 size-8 text-stone-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-700">{emptyMessage}</p>
          {examId ? <ReuploadMaterialForm examId={examId} /> : null}
        </div>
      ) : kind === "image" ? (
        <div className="max-h-[calc(100vh-220px)] overflow-auto rounded-lg border border-stone-200 bg-stone-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Шалгалтын эх материал"
            loading="lazy"
            decoding="async"
            className="mx-auto h-auto max-w-full"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : kind === "pdf" ? (
        <iframe
          src={previewUrl}
          title="Шалгалтын эх материал"
          loading="lazy"
          className="h-[calc(100vh-220px)] min-h-[420px] w-full rounded-lg border border-stone-200 bg-stone-50"
        />
      ) : (
        <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-5">
          <FileText className="mb-3 size-8 text-stone-400" aria-hidden="true" />
          <p className="text-sm font-medium text-stone-700">
            Энэ төрлийн файлыг шууд харуулах боломжгүй байна.
          </p>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#8B5E3C] hover:text-[#734d31]"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Эх материалыг шинэ цонхонд нээх
          </a>
        </div>
      )}
    </section>
  );
}

function ReuploadMaterialForm({ examId }: { examId: string }) {
  return (
    <form action={replaceExamMaterialAction} className="mt-5 space-y-3 text-left">
      <input type="hidden" name="examId" value={examId} />
      <label className="block text-sm font-semibold text-stone-700" htmlFor="material-reupload">
        Эх материал дахин оруулах
      </label>
      <input
        id="material-reupload"
        name="material"
        type="file"
        accept="image/*,.pdf"
        required
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 file:mr-4 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
      />
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31]"
      >
        <UploadCloud className="size-4" aria-hidden="true" />
        Эх материал дахин оруулах
      </button>
    </form>
  );
}

function getMaterialKind(url?: string | null, mimeType?: string | null) {
  const value = `${mimeType ?? ""} ${url ?? ""}`.toLowerCase();

  if (value.includes("application/pdf") || /\.pdf(\?|#|$)/i.test(value)) {
    return "pdf";
  }

  if (
    value.includes("image/") ||
    /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(value)
  ) {
    return "image";
  }

  return "unknown";
}
