"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabaseClient } from "@/lib/supabase-client";

type StudentOption = {
  id: string;
  name: string;
};

type QueueStatus =
  | "compressing"
  | "queued"
  | "uploading"
  | "processing"
  | "done"
  | "failed";

type QueueItem = {
  localId: string;
  clientSubmissionKey: string;
  studentId: string;
  studentName: string;
  originalFileName: string;
  previewUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes?: number;
  uploadFile?: File;
  status: QueueStatus;
  error?: string;
  startedAt?: number;
  submissionId?: string;
};

type EnqueueResponse = {
  ok?: boolean;
  submissionId?: string;
  status?: string;
  error?: string;
};

const uploadConcurrency = 2;
const maxWidth = 1400;
const maxHeight = 1800;
const jpegQuality = 0.75;
const isDev = process.env.NODE_ENV === "development";

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
  const [items, setItems] = useState<QueueItem[]>([]);
  const [message, setMessage] = useState("");
  const [wakeQueue, setWakeQueue] = useState(0);
  const activeUploadsRef = useRef(0);
  const startedLocalIdsRef = useRef(new Set<string>());
  const previewUrlsRef = useRef<string[]>([]);

  const setQueue = useCallback((updater: (items: QueueItem[]) => QueueItem[]) => {
    setItems((currentItems) => updater(currentItems));
  }, []);

  const patchItem = useCallback(
    (localId: string, patch: Partial<QueueItem>) => {
      setQueue((currentItems) =>
        currentItems.map((item) =>
          item.localId === localId ? { ...item, ...patch } : item
        )
      );
    },
    [setQueue]
  );

  const sendSubmissionBroadcast = useCallback(
    (payload: { submissionId?: string; studentId: string; status: string }) => {
      const channel = supabaseClient.channel(`exam-submissions:${examId}`, {
        config: { broadcast: { ack: true, self: false } },
      });
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) {
          return;
        }

        cleanedUp = true;
        window.clearTimeout(timeout);
        void supabaseClient.removeChannel(channel);
      };
      const timeout = window.setTimeout(cleanup, 5000);

      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || cleanedUp) {
          return;
        }

        await channel.send({
          type: "broadcast",
          event: "submission_changed",
          payload: {
            examId,
            submissionId: payload.submissionId,
            studentId: payload.studentId,
            status: payload.status,
            timestamp: Date.now(),
            source: "capture-queue",
          },
        });
        cleanup();
      });
    },
    [examId]
  );

  const triggerProcessing = useCallback(
    (item: QueueItem, submissionId: string) => {
      log(`[capture-queue] process trigger submissionId=${submissionId}`);
      void fetch(`/api/submissions/${submissionId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: captureToken }),
      })
        .then(async (response) => {
          const data = await readJson<EnqueueResponse>(response);

          if (!response.ok || data?.ok === false) {
            throw new Error(data?.error || "AI боловсруулалт амжилтгүй боллоо.");
          }

          patchItem(item.localId, {
            status: "done",
            error: "",
          });
          sendSubmissionBroadcast({
            submissionId,
            studentId: item.studentId,
            status: data?.status || "DRAFT",
          });
        })
        .catch((error: unknown) => {
          patchItem(item.localId, {
            status: "failed",
            error: getErrorMessage(error),
          });
          sendSubmissionBroadcast({
            submissionId,
            studentId: item.studentId,
            status: "FAILED",
          });
        });
    },
    [captureToken, patchItem, sendSubmissionBroadcast]
  );

  const uploadQueueItem = useCallback(
    async (item: QueueItem) => {
      if (!item.uploadFile) {
        throw new Error("Илгээх зураг бэлэн биш байна.");
      }

      const formData = new FormData();
      formData.set("token", captureToken);
      formData.set("studentId", item.studentId);
      formData.set("clientSubmissionKey", item.clientSubmissionKey);
      formData.set("image", item.uploadFile);

      log(`[capture-queue] upload start localId=${item.localId}`);
      const response = await fetch(`/api/exams/${examId}/capture/enqueue`, {
        method: "POST",
        body: formData,
      });
      const data = await readJson<EnqueueResponse>(response);

      if (!response.ok || !data?.ok || !data.submissionId) {
        throw new Error(data?.error || "Зураг илгээхэд алдаа гарлаа.");
      }

      log(`[capture-queue] enqueue success submissionId=${data.submissionId}`);
      patchItem(item.localId, {
        status: "processing",
        submissionId: data.submissionId,
        error: "",
      });
      sendSubmissionBroadcast({
        submissionId: data.submissionId,
        studentId: item.studentId,
        status: data.status || "PROCESSING",
      });
      triggerProcessing(item, data.submissionId);
    },
    [
      captureToken,
      examId,
      patchItem,
      sendSubmissionBroadcast,
      triggerProcessing,
    ]
  );

  useEffect(() => {
    const availableSlots = uploadConcurrency - activeUploadsRef.current;

    if (availableSlots <= 0) {
      return;
    }

    const nextItems = items
      .filter(
        (item) =>
          item.status === "queued" && !startedLocalIdsRef.current.has(item.localId)
      )
      .slice(0, availableSlots);

    nextItems.forEach((item) => {
      activeUploadsRef.current += 1;
      startedLocalIdsRef.current.add(item.localId);
      patchItem(item.localId, {
        status: "uploading",
        startedAt: Date.now(),
        error: "",
      });
      void uploadQueueItem(item)
        .catch((error: unknown) => {
          patchItem(item.localId, {
            status: "failed",
            error: getErrorMessage(error),
          });
        })
        .finally(() => {
          activeUploadsRef.current -= 1;
          setWakeQueue((value) => value + 1);
        });
    });
  }, [items, patchItem, uploadQueueItem, wakeQueue]);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    const student = students.find((item) => item.id === selectedStudentId);

    setMessage("");

    if (!file) {
      return;
    }

    input.value = "";

    if (!student) {
      setMessage("Эхлээд сурагч сонгоно уу.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("Зургийн файл сонгоно уу.");
      return;
    }

    const localId = randomId();
    const clientSubmissionKey = randomId();
    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.push(previewUrl);

    log(`[capture-queue] queued localId=${localId} studentId=${student.id}`);
    setQueue((currentItems) => [
      {
        localId,
        clientSubmissionKey,
        studentId: student.id,
        studentName: student.name,
        originalFileName: file.name,
        previewUrl,
        originalSizeBytes: file.size,
        status: "compressing",
      },
      ...currentItems,
    ]);

    try {
      const startedAt = performance.now();
      const compressedFile = await compressImage(file);
      const uploadFile = compressedFile.size < file.size ? compressedFile : file;

      log(
        `[capture-queue] compressed original=${file.size} compressed=${uploadFile.size} ms=${Math.round(
          performance.now() - startedAt
        )}`
      );
      patchItem(localId, {
        uploadFile,
        compressedSizeBytes: uploadFile.size,
        status: "queued",
      });
    } catch (error) {
      console.warn("[capture-queue] compression failed, using original", error);
      patchItem(localId, {
        uploadFile: file,
        compressedSizeBytes: file.size,
        status: "queued",
      });
    }
  }

  function retryItem(localId: string) {
    startedLocalIdsRef.current.delete(localId);
    patchItem(localId, {
      status: "queued",
      error: "",
      startedAt: undefined,
      submissionId: undefined,
    });
    setWakeQueue((value) => value + 1);
  }

  return (
    <div className="mt-5 space-y-5">
      <div>
        <label htmlFor="studentId" className="mb-1.5 block text-sm font-semibold text-stone-700">
          Сурагч
        </label>
        <select
          id="studentId"
          value={selectedStudentId}
          onChange={(event) => setSelectedStudentId(event.currentTarget.value)}
          disabled={!isAnswerKeyReady}
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] disabled:bg-stone-100 disabled:text-stone-500"
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
          type="file"
          accept="image/*"
          capture="environment"
          disabled={!isAnswerKeyReady || !selectedStudentId}
          onChange={handleFileChange}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 file:mr-4 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200 disabled:bg-stone-100 disabled:text-stone-500"
        />
        {message ? <p className="mt-2 text-xs font-semibold text-amber-700">{message}</p> : null}
      </div>

      {items.length > 0 ? (
        <div className="space-y-3" aria-live="polite">
          {items.map((item) => (
            <div
              key={item.localId}
              className="grid grid-cols-[52px_1fr] gap-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3"
            >
              <div
                role="img"
                aria-label={`${item.studentName} preview`}
                className="h-12 w-12 rounded-md bg-stone-200 bg-cover bg-center"
                style={{ backgroundImage: `url(${item.previewUrl})` }}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-900">
                      {item.studentName}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {item.originalFileName}
                    </p>
                  </div>
                  <span className={getStatusClass(item.status)}>
                    {getStatusText(item.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Эх файл: {formatBytes(item.originalSizeBytes)}
                  {item.compressedSizeBytes
                    ? ` · Илгээх файл: ${formatBytes(item.compressedSizeBytes)}`
                    : ""}
                </p>
                {item.error ? (
                  <p className="mt-1 text-xs font-medium text-red-700">{item.error}</p>
                ) : null}
                {item.status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => retryItem(item.localId)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Дахин оролдох
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
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

function getStatusText(status: QueueStatus) {
  if (status === "compressing") {
    return "Зураг шахаж байна";
  }

  if (status === "queued") {
    return "Дараалалд байна";
  }

  if (status === "uploading") {
    return "Илгээж байна";
  }

  if (status === "processing") {
    return "Боловсруулж байна";
  }

  if (status === "done") {
    return "Бэлэн боллоо";
  }

  return "Алдаа гарсан";
}

function getStatusClass(status: QueueStatus) {
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

function log(message: string) {
  if (isDev) {
    console.log(message);
  }
}
