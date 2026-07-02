"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  ChevronDown,
  Images,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";

type StudentOption = {
  id: string;
  name: string;
};

type PageStatus = "compressing" | "ready" | "uploading" | "processing" | "done" | "failed";

type PendingPage = {
  localId: string;
  file?: File;
  previewUrl: string;
  originalFileName: string;
  originalSizeBytes: number;
  compressedSizeBytes?: number;
  status: PageStatus;
  error?: string;
};

type EnqueueResponse = {
  ok?: boolean;
  submissionId?: string;
  pageCount?: number;
  status?: string;
  error?: string;
};

const maxWidth = 1400;
const maxHeight = 1800;
const jpegQuality = 0.75;

export default function PhoneCaptureQueue({
  examId,
  captureToken,
  students,
  isAnswerKeyReady,
}: {
  examId: string;
  captureToken: string;
  students: StudentOption[];
  isAnswerKeyReady: boolean;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [pages, setPages] = useState<PendingPage[]>([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedStudentIdRef = useRef(selectedStudentId);
  const lastDropdownTouchAtRef = useRef(0);
  const previewUrlsRef = useRef<string[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    selectedStudentIdRef.current = selectedStudentId;
  }, [selectedStudentId]);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files ?? []);
    const currentStudentId = selectedStudentIdRef.current;

    input.value = "";
    setMessage("");

    if (!isAnswerKeyReady) {
      setMessage("Эхлээд хариултын түлхүүрээ баталгаажуулна уу.");
      return;
    }

    if (!currentStudentId.trim()) {
      setMessage("Эхлээд сурагч сонгоно уу.");
      return;
    }

    if (selectedFiles.length === 0) {
      return;
    }

    for (const file of selectedFiles) {
      if (!file.type.startsWith("image/")) {
        setMessage("Зөвхөн зургийн файл сонгоно уу.");
        continue;
      }

      const localId = randomId();
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.push(previewUrl);
      const page: PendingPage = {
        localId,
        previewUrl,
        originalFileName: file.name,
        originalSizeBytes: file.size,
        status: "compressing",
      };

      setPages((current) => [...current, page]);

      try {
        const compressed = await compressImage(file);
        const uploadFile = compressed.size < file.size ? compressed : file;

        setPages((current) =>
          current.map((item) =>
            item.localId === localId
              ? {
                  ...item,
                  file: uploadFile,
                  compressedSizeBytes: uploadFile.size,
                  status: "ready",
                }
              : item
          )
        );
      } catch (error) {
        console.warn("[capture-queue] compression failed, using original", error);
        setPages((current) =>
          current.map((item) =>
            item.localId === localId
              ? {
                  ...item,
                  file,
                  compressedSizeBytes: file.size,
                  status: "ready",
                }
              : item
          )
        );
      }
    }
  }

  function selectStudent(studentId: string) {
    const student = students.find((item) => item.id === studentId);

    selectedStudentIdRef.current = studentId;
    setSelectedStudentId(studentId);
    setIsStudentDropdownOpen(false);
    setMessage(student ? `Сонгосон сурагч: ${student.name}` : "Сурагч сонгоно уу.");
  }

  function toggleStudentDropdown() {
    setIsStudentDropdownOpen((open) => !open);
  }

  function markDropdownTouch() {
    lastDropdownTouchAtRef.current = Date.now();
  }

  function shouldSkipSyntheticClick() {
    return Date.now() - lastDropdownTouchAtRef.current < 700;
  }

  function openPicker(source: "camera" | "gallery") {
    if (!isAnswerKeyReady) {
      setMessage("Эхлээд хариултын түлхүүрээ баталгаажуулна уу.");
      return;
    }

    if (!selectedStudentIdRef.current.trim()) {
      setMessage("Эхлээд сурагч сонгоно уу.");
      return;
    }

    (source === "camera" ? cameraInputRef : galleryInputRef).current?.click();
  }

  function removePage(localId: string) {
    setPages((current) => {
      const page = current.find((item) => item.localId === localId);

      if (page) {
        URL.revokeObjectURL(page.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter((url) => url !== page.previewUrl);
      }

      return current.filter((item) => item.localId !== localId);
    });
  }

  function movePage(localId: string, direction: -1 | 1) {
    setPages((current) => {
      const index = current.findIndex((item) => item.localId === localId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];

      return next;
    });
  }

  async function processPages() {
    const studentId = selectedStudentIdRef.current;

    setMessage("");

    if (!isAnswerKeyReady) {
      setMessage("Эхлээд хариултын түлхүүрээ баталгаажуулна уу.");
      return;
    }

    if (!studentId.trim()) {
      setMessage("Эхлээд сурагч сонгоно уу.");
      return;
    }

    if (pages.length === 0) {
      setMessage("Эхлээд хариултын хуудас нэмнэ үү.");
      return;
    }

    if (pages.some((page) => page.status === "compressing" || !page.file)) {
      setMessage("Зураг бэлэн болтол түр хүлээнэ үү.");
      return;
    }

    setIsSubmitting(true);
    setPages((current) => current.map((page) => ({ ...page, status: "uploading", error: "" })));

    try {
      const formData = new FormData();
      formData.set("token", captureToken);
      formData.set("studentId", studentId);
      pages.forEach((page) => {
        if (page.file) {
          formData.append("files", page.file);
        }
      });

      const response = await fetch(`/api/exams/${examId}/capture/enqueue`, {
        method: "POST",
        body: formData,
      });
      const data = await readJson<EnqueueResponse>(response);

      if (!response.ok || !data?.ok || !data.submissionId) {
        throw new Error(data?.error || "Зураг илгээхэд алдаа гарлаа.");
      }

      setPages((current) => current.map((page) => ({ ...page, status: "done" })));
      setMessage(
        `Амжилттай илгээгдлээ. ${data.pageCount ?? pages.length} хуудас нэг хариултын материал болж боловсруулагдлаа.`
      );
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      setPages((current) =>
        current.map((page) => ({ ...page, status: "failed", error: errorMessage }))
      );
      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const readyCount = pages.filter((page) => page.status !== "compressing").length;
  const statusMessage =
    message ||
    (!isAnswerKeyReady
      ? "Эхлээд хариултын түлхүүрээ баталгаажуулна уу."
      : !selectedStudentId
        ? "Сурагч сонгоно уу."
        : "");

  return (
    <div className="mt-5 space-y-5">
      <div>
        <label htmlFor="studentDropdown" className="mb-1.5 block text-sm font-semibold text-stone-700">
          Сурагч сонгох
        </label>
        <button
          type="button"
          id="studentDropdown"
          role="combobox"
          aria-expanded={isStudentDropdownOpen}
          aria-controls="studentDropdownOptions"
          onTouchEnd={(event) => {
            event.preventDefault();
            markDropdownTouch();
            toggleStudentDropdown();
          }}
          onClick={() => {
            if (!shouldSkipSyntheticClick()) {
              toggleStudentDropdown();
            }
          }}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-stone-300 bg-white px-3 py-3 text-left text-sm text-stone-900 shadow-sm focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
        >
          <span>{selectedStudent ? selectedStudent.name : "Сурагч сонгох"}</span>
          <ChevronDown className="size-4 shrink-0 text-stone-500" aria-hidden="true" />
        </button>
        {isStudentDropdownOpen ? (
          <div
            id="studentDropdownOptions"
            role="listbox"
            className="relative z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-stone-300 bg-white text-sm shadow-lg"
          >
            {students.map((student) => {
              const isSelected = student.id === selectedStudentId;

              return (
                <button
                  type="button"
                  key={student.id}
                  role="option"
                  aria-selected={isSelected}
                  onTouchEnd={(event) => {
                    event.preventDefault();
                    markDropdownTouch();
                    selectStudent(student.id);
                  }}
                  onClick={() => {
                    if (!shouldSkipSyntheticClick()) {
                      selectStudent(student.id);
                    }
                  }}
                  className={`flex w-full items-center justify-between border-b border-stone-100 px-4 py-3 text-left font-medium last:border-b-0 ${
                    isSelected ? "bg-[#8B5E3C] text-white" : "text-stone-800 hover:bg-stone-100"
                  }`}
                >
                  <span>{student.name}</span>
                  {isSelected ? <span aria-hidden="true">✓</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-semibold text-stone-700">Хуудас нэмэх</p>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="sr-only"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="sr-only"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => openPicker("camera")}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#8B5E3C] px-4 py-4 text-base font-semibold text-white shadow-sm hover:bg-[#734d31]"
          >
            <Camera className="size-5" aria-hidden="true" />
            <span>Камер нээх</span>
          </button>
          <button
            type="button"
            onClick={() => openPicker("gallery")}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-4 text-base font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
          >
            <Images className="size-5" aria-hidden="true" />
            <span>Зураг сонгох</span>
          </button>
        </div>
        <p className="mt-2 text-xs font-medium text-stone-500">
          Энэ сурагчийн бүх хуудас нэг хариултын материал болж илгээгдэнэ.
        </p>
        {statusMessage ? (
          <p className="mt-2 text-xs font-semibold text-amber-700" role="status">
            {statusMessage}
          </p>
        ) : null}
      </div>

      {pages.length > 0 ? (
        <div className="space-y-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-stone-900">Оруулсан хуудаснууд</h3>
            <span className="text-xs font-semibold text-stone-500">
              {readyCount}/{pages.length} бэлэн
            </span>
          </div>
          {pages.map((page, index) => (
            <div
              key={page.localId}
              className="grid grid-cols-[64px_1fr] gap-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3"
            >
              <div
                role="img"
                aria-label={`Хуудас ${index + 1}`}
                className="h-16 w-16 rounded-md bg-stone-200 bg-cover bg-center"
                style={{ backgroundImage: `url(${page.previewUrl})` }}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-900">
                      Хуудас {index + 1}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {page.originalFileName}
                    </p>
                  </div>
                  <span className={getStatusClass(page.status)}>
                    {getStatusText(page.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Эх файл: {formatBytes(page.originalSizeBytes)}
                  {page.compressedSizeBytes
                    ? ` · Илгээх файл: ${formatBytes(page.compressedSizeBytes)}`
                    : ""}
                </p>
                {page.error ? (
                  <p className="mt-1 text-xs font-medium text-red-700">{page.error}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => movePage(page.localId, -1)}
                    disabled={index === 0 || isSubmitting}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                    Дээш
                  </button>
                  <button
                    type="button"
                    onClick={() => movePage(page.localId, 1)}
                    disabled={index === pages.length - 1 || isSubmitting}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                    Доош
                  </button>
                  <button
                    type="button"
                    onClick={() => removePage(page.localId)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Устгах
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={processPages}
        disabled={isSubmitting}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#8B5E3C] px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#734d31] disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {isSubmitting ? (
          <RefreshCw className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <UploadCloud className="size-5" aria-hidden="true" />
        )}
        <span>{isSubmitting ? "Боловсруулж байна..." : "Боловсруулах"}</span>
      </button>
    </div>
  );
}

async function compressImage(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);
    const scale = Math.min(
      1,
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error("Canvas context unavailable");
    }

    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/jpeg", jpegQuality);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "answer-sheet";

    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
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
      quality
    );
  });
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function getStatusText(status: PageStatus) {
  if (status === "compressing") {
    return "Зураг шахаж байна";
  }

  if (status === "ready") {
    return "Дараалалд байна";
  }

  if (status === "uploading") {
    return "Илгээж байна";
  }

  if (status === "processing") {
    return "AI уншиж байна";
  }

  if (status === "done") {
    return "Амжилттай";
  }

  return "Алдаа гарсан";
}

function getStatusClass(status: PageStatus) {
  if (status === "done") {
    return "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800";
  }

  if (status === "failed") {
    return "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800";
  }

  if (status === "processing" || status === "uploading") {
    return "inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800";
  }

  return "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
