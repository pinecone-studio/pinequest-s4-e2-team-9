"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
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
}: {
  examId: string;
  students: StudentOption[];
  isAnswerKeyReady: boolean;
}) {
  const [original, setOriginal] = useState<FileInfo | null>(null);
  const [compressed, setCompressed] = useState<FileInfo | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [message, setMessage] = useState("");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;

    setMessage("");
    setCompressed(null);

    if (!file) {
      setOriginal(null);
      return;
    }

    setOriginal(toFileInfo(file));
    setIsCompressing(true);

    try {
      const resized = await compressImage(file);
      const nextFile = resized.size < file.size ? resized : file;

      if (typeof DataTransfer !== "undefined") {
        const files = new DataTransfer();
        files.items.add(nextFile);
        input.files = files.files;
      }

      setCompressed(toFileInfo(nextFile));
      setMessage(
        nextFile.size > warningSizeBytes
          ? "Зураг 1MB-ээс их байна. Демо хурд удааширч магадгүй."
          : "Зураг demo-д зориулж багаслаа."
      );
    } catch (error) {
      console.warn("[submission-speed] imageCompressionFailed", error);
      setCompressed(toFileInfo(file));
      setMessage("Зургийг багасгаж чадсангүй. Эх файлыг илгээнэ.");
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <form action={createSubmissionDraftAction} className="mt-5 space-y-5">
      <input type="hidden" name="examId" value={examId} />
      <input type="hidden" name="originalImageSize" value={original?.size ?? ""} />
      <input type="hidden" name="compressedImageSize" value={compressed?.size ?? ""} />
      <input type="hidden" name="originalMimeType" value={original?.type ?? ""} />
      <input type="hidden" name="compressedMimeType" value={compressed?.type ?? ""} />

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
        <label htmlFor="answerSheet" className="mb-1.5 block text-sm font-semibold text-stone-700">
          Хариултын хуудасны зураг
        </label>
        <input
          id="answerSheet"
          name="answerSheet"
          required
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileChange}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 file:mr-4 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
        />
        {original ? (
          <p className="mt-2 text-xs leading-5 text-stone-500">
            Эх файл: {formatBytes(original.size)}
            {compressed ? ` · Илгээх файл: ${formatBytes(compressed.size)}` : ""}
          </p>
        ) : null}
        {message ? (
          <p
            className={`mt-2 text-xs font-medium ${
              compressed && compressed.size > warningSizeBytes ? "text-amber-700" : "text-stone-500"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>

      <LoadingSubmitButton
        disabled={!isAnswerKeyReady || isCompressing}
        loadingText="Уншиж байна..."
        className="w-full px-5 py-2.5 text-sm font-medium"
      >
        <UploadCloud className="size-4" aria-hidden="true" />
        {isCompressing ? "Зургийг багасгаж байна..." : "AI-аар уншуулах"}
      </LoadingSubmitButton>
    </form>
  );
}

function toFileInfo(file: File): FileInfo {
  return {
    name: file.name,
    size: file.size,
    type: file.type || "unknown",
  };
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
