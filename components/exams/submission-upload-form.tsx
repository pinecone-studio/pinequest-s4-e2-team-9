"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { UploadCloud } from "lucide-react";
import { createSubmissionDraftAction } from "@/actions/submission-actions";
import LoadingSubmitButton from "@/components/ui/loading-submit-button";

type StudentOption = {
  id: string;
  name: string;
};

type FileInfo = {
  name: string;
  size: number;
  type: string;
};

const maxLongEdge = 1600;
const quality = 0.8;
const warningSizeBytes = 1024 * 1024;

export default function SubmissionUploadForm({
  examId,
  students,
  isAnswerKeyReady,
  variant = "desktop",
  submitLabel = "AI-аар уншуулах",
  loadingText = "Уншиж байна...",
  captureToken,
}: {
  examId: string;
  students: StudentOption[];
  isAnswerKeyReady: boolean;
  variant?: "desktop" | "mobile";
  submitLabel?: string;
  loadingText?: string;
  captureToken?: string;
}) {
  const [originalFiles, setOriginalFiles] = useState<FileInfo[]>([]);
  const [compressedFiles, setCompressedFiles] = useState<FileInfo[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [message, setMessage] = useState("");
  const isMobile = variant === "mobile";

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);

    setMessage("");
    setCompressedFiles([]);

    if (files.length === 0) {
      setOriginalFiles([]);
      return;
    }

    setOriginalFiles(files.map(toFileInfo));
    setIsCompressing(true);

    try {
      const nextFiles = await Promise.all(
        files.map(async (file) => {
          if (!file.type.startsWith("image/")) {
            return file;
          }

          const resized = await compressImage(file);

          return resized.size < file.size ? resized : file;
        })
      );

      if (typeof DataTransfer !== "undefined") {
        const dataTransfer = new DataTransfer();

        for (const file of nextFiles) {
          dataTransfer.items.add(file);
        }

        input.files = dataTransfer.files;
      }

      setCompressedFiles(nextFiles.map(toFileInfo));
      setMessage(
        nextFiles.some((file) => file.size > warningSizeBytes)
          ? "Зарим файл 1MB-ээс их байна. Демо хурд удааширч магадгүй."
          : "Зургууд demo-д зориулж багаслаа."
      );
    } catch (error) {
      console.warn("[submission-speed] imageCompressionFailed", error);
      setCompressedFiles(files.map(toFileInfo));
      setMessage("Зургийг багасгаж чадсангүй. Эх файлуудыг илгээнэ.");
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <form action={createSubmissionDraftAction} className="mt-5 space-y-5">
      <input type="hidden" name="examId" value={examId} />
      <input type="hidden" name="originalImageSize" value={sumSizes(originalFiles) || ""} />
      <input type="hidden" name="compressedImageSize" value={sumSizes(compressedFiles) || ""} />
      <input type="hidden" name="originalMimeType" value={originalFiles.map((file) => file.type).join(",")} />
      <input type="hidden" name="compressedMimeType" value={compressedFiles.map((file) => file.type).join(",")} />
      {captureToken ? <input type="hidden" name="captureToken" value={captureToken} /> : null}

      <div>
        <label htmlFor="studentId" className="mb-1.5 block text-sm font-semibold text-stone-700">
          Сурагч
        </label>
        <select
          id="studentId"
          name="studentId"
          required
          defaultValue=""
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
        >
          <option value="">Сурагч сонгох</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="answerFiles" className="mb-1.5 block text-sm font-semibold text-stone-700">
          Хариултын хуудасны зургууд
        </label>
        <input
          id="answerFiles"
          name="answerFiles"
          required
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture={isMobile ? "environment" : undefined}
          onChange={handleFileChange}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 file:mr-4 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
        />
        <p className="mt-2 text-xs leading-5 text-stone-500">
          Нэг сурагчийн нэг эсвэл олон хуудас сонгож болно. Олон файл сонговол нэг хариултын материал болж боловсруулагдана.
        </p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          Олон файл сонгохын тулд Ctrl эсвэл Shift дарж сонгоно уу.
        </p>
        {originalFiles.length > 0 ? (
          <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
              Сонгосон хуудсууд
            </p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-stone-700">
              {originalFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="break-all">
                  Хуудас {index + 1} — {file.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {originalFiles.length > 0 ? (
          <p className="mt-2 text-xs leading-5 text-stone-500">
            Эх файл: {formatBytes(sumSizes(originalFiles))}
            {compressedFiles.length > 0 ? ` · Илгээх файл: ${formatBytes(sumSizes(compressedFiles))}` : ""}
          </p>
        ) : null}
        {message ? (
          <p
            className={`mt-2 text-xs font-medium ${
              compressedFiles.some((file) => file.size > warningSizeBytes) ? "text-amber-700" : "text-stone-500"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>

      <LoadingSubmitButton
        disabled={!isAnswerKeyReady || isCompressing}
        loadingText={loadingText}
        className="min-h-11 w-full whitespace-normal px-5 py-2.5 text-sm font-medium"
      >
        <UploadCloud className="size-4" aria-hidden="true" />
        {isCompressing ? "Зургийг багасгаж байна..." : submitLabel}
      </LoadingSubmitButton>
      <SubmissionProgressText enabled={isMobile} />
    </form>
  );
}

function SubmissionProgressText({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  if (!enabled || !pending) {
    return null;
  }

  return (
    <div className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium leading-6 text-stone-700" aria-live="polite">
      <p>Зураг илгээгдэж байна...</p>
      <p>AI хариултыг уншиж байна...</p>
    </div>
  );
}

function toFileInfo(file: File): FileInfo {
  return {
    name: file.name,
    size: file.size,
    type: file.type || "unknown",
  };
}

function sumSizes(files: FileInfo[]) {
  return files.reduce((sum, file) => sum + file.size, 0);
}

async function compressImage(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);
    const scale = Math.min(1, maxLongEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas context unavailable");
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/webp", quality);
    const type = blob.type || "image/webp";
    const extension = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "answer-sheet";

    return new File([blob], `${baseName}.${extension}`, {
      type,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, qualityValue: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas compression failed"));
        }
      },
      type,
      qualityValue
    );
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
