"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, Images, RefreshCw } from "lucide-react";

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
  const [selectedStudentIdRefValue, setSelectedStudentIdRefValue] = useState("");
  const [lastStudentSelection, setLastStudentSelection] = useState("(none)");
  const [studentSelectionCount, setStudentSelectionCount] = useState(0);
  const [lastEvent, setLastEvent] = useState("(none)");
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [lastDropdownToggleEvent, setLastDropdownToggleEvent] = useState("(none)");
  const [lastDropdownOptionClick, setLastDropdownOptionClick] = useState("(none)");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [message, setMessage] = useState("");
  const [wakeQueue, setWakeQueue] = useState(0);
  const activeUploadsRef = useRef(0);
  const startedLocalIdsRef = useRef(new Set<string>());
  const previewUrlsRef = useRef<string[]>([]);
  const selectedStudentIdRef = useRef(selectedStudentId);
  const lastDropdownTouchAtRef = useRef(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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
      void import("@/lib/supabase-client")
        .then(({ supabaseClient }) => {
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
        })
        .catch((error: unknown) => {
          console.warn("[capture-queue] realtime broadcast skipped", error);
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

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
    source: "camera" | "gallery"
  ) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    const currentSelectedStudentId = selectedStudentIdRef.current || selectedStudentId;
    const student = students.find((item) => item.id === currentSelectedStudentId);

    setMessage("");

    if (!file) {
      log("[capture-input] no file selected");
      input.value = "";
      return;
    }

    input.value = "";
    log(
      `[capture-input] ${source} selected name=${file.name} type=${file.type || "unknown"} size=${file.size}`
    );

    if (!student) {
      setMessage("Эхлээд сурагч сонгоно уу.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("Зургийн файл сонгоно уу.");
      return;
    }

    if (!currentSelectedStudentId.trim() || !student) {
      setMessage("Эхлээд сурагч сонгоно уу.");
      return;
    }

    console.log("enqueue payload", {
      examId,
      selectedStudentId: currentSelectedStudentId,
      fileName: file.name,
    });

    const localId = randomId();
    const clientSubmissionKey = randomId();
    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.push(previewUrl);

    log(`[capture-queue] queued localId=${localId} studentId=${currentSelectedStudentId}`);
    setQueue((currentItems) => [
      {
        localId,
        clientSubmissionKey,
        studentId: currentSelectedStudentId,
        studentName: student.name,
        originalFileName: file.name,
        previewUrl,
        originalSizeBytes: file.size,
        status: "compressing",
      },
      ...currentItems,
    ]);

    try {
      const compressedFile = await compressImage(file);
      const uploadFile = compressedFile.size < file.size ? compressedFile : file;

      log(
        `[capture-queue] compressed original=${file.size} compressed=${uploadFile.size}`
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

  function handleCameraFileChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFileChange(event, "camera");
  }

  function handleGalleryFileChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFileChange(event, "gallery");
  }

  function selectStudent(studentId: string, source: string) {
    const student = students.find((item) => item.id === studentId);

    console.log("SELECT_STUDENT_CALLED", {
      source,
      studentId,
      studentName: student?.name,
    });

    selectedStudentIdRef.current = studentId;
    setSelectedStudentIdRefValue(studentId);
    setLastStudentSelection(`${source}: ${student?.name ?? "(unknown)"} / ${studentId}`);
    setStudentSelectionCount((count) => count + 1);
    setLastEvent(`student ${source}`);
    setSelectedStudentId(studentId);
    setMessage(studentId ? `Сонгосон сурагч: ${student?.name ?? studentId}` : "Сурагч сонгоно уу.");
  }

  function toggleStudentDropdown(source: string) {
    setLastEvent(source);
    setLastDropdownToggleEvent(source);
    setIsStudentDropdownOpen((open) => !open);
  }

  function markDropdownTouch() {
    lastDropdownTouchAtRef.current = Date.now();
  }

  function shouldSkipSyntheticClick() {
    return Date.now() - lastDropdownTouchAtRef.current < 700;
  }

  function handleStudentOptionSelect(studentId: string, source: string) {
    selectStudent(studentId, source);
    setLastDropdownOptionClick(`${source}: ${studentId}`);
    setIsStudentDropdownOpen(false);
  }

  function openPicker(source: "camera" | "gallery") {
    const currentSelectedStudentId = selectedStudentIdRef.current || selectedStudentId;

    setLastEvent(`${source} clicked`);
    console.log(`${source} clicked`, {
      selectedStudentId: currentSelectedStudentId,
      isAnswerKeyReady,
    });

    if (!isAnswerKeyReady) {
      setMessage("Эхлээд хариултын түлхүүрээ баталгаажуулна уу.");
      return;
    }

    if (!currentSelectedStudentId.trim()) {
      setMessage("Эхлээд сурагч сонгоно уу.");
      return;
    }

    setMessage("Зураг сонгоно уу.");
    console.log("triggering file input");
    (source === "camera" ? cameraInputRef : galleryInputRef).current?.click();
  }

  const firstStudent = students[0];
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const selectedStudentName = selectedStudent?.name ?? "(none)";
  const canCapture = isAnswerKeyReady && selectedStudentId.trim().length > 0;
  const enqueueStudentId = selectedStudentId;
  const renderedDropdownOptionCount = isStudentDropdownOpen ? students.length : 0;
  const cameraButtonClass =
    "flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#8B5E3C] px-4 py-4 text-base font-semibold text-white shadow-sm hover:bg-[#734d31]";
  const galleryButtonClass =
    "flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-4 text-base font-semibold text-stone-800 shadow-sm hover:bg-stone-50";
  const latestItem = items[0];
  const statusMessage =
    message ||
    (latestItem
      ? getStatusMessage(latestItem)
      : !isAnswerKeyReady
        ? "Эхлээд хариултын түлхүүрээ баталгаажуулна уу."
        : !selectedStudentId
          ? "Сурагч сонгоно уу."
          : "");

  return (
    <div className="mt-5 space-y-5">
      <div>
        <label htmlFor="studentDropdown" className="mb-1.5 block text-sm font-semibold text-stone-700">
          Сурагч
        </label>
        <div>
          <button
            type="button"
            id="studentDropdown"
            role="combobox"
            aria-expanded={isStudentDropdownOpen}
            aria-controls="studentDropdownOptions"
            onTouchEnd={(event) => {
              event.preventDefault();
              markDropdownTouch();
              toggleStudentDropdown("student dropdown trigger touch");
            }}
            onClick={() => {
              if (shouldSkipSyntheticClick()) {
                return;
              }

              toggleStudentDropdown("student dropdown trigger click");
            }}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-stone-300 bg-white px-3 py-2 text-left text-sm text-stone-900 shadow-sm focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
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
                    data-student-id={student.id}
                    onTouchEnd={(event) => {
                      event.preventDefault();
                      markDropdownTouch();
                      handleStudentOptionSelect(
                        student.id,
                        "custom dropdown option touch"
                      );
                    }}
                    onClick={() => {
                      if (shouldSkipSyntheticClick()) {
                        return;
                      }

                      handleStudentOptionSelect(
                        student.id,
                        "custom dropdown option click"
                      );
                    }}
                    className={`flex w-full items-center justify-between border-b border-stone-100 px-4 py-3 text-left font-medium last:border-b-0 ${
                      isSelected
                        ? "bg-[#8B5E3C] text-white"
                        : "text-stone-800 hover:bg-stone-100"
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
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 rounded-lg bg-stone-100 p-2 text-xs text-stone-700">
          <dt>selectedStudentId:</dt>
          <dd className="break-all font-semibold">{selectedStudentId || "(empty)"}</dd>
          <dt>selectedStudentIdRef.current:</dt>
          <dd className="break-all font-semibold">
            {selectedStudentIdRefValue || "(empty)"}
          </dd>
          <dt>selectedStudentName:</dt>
          <dd className="font-semibold">{selectedStudentName}</dd>
          <dt>isAnswerKeyReady:</dt>
          <dd className="font-semibold">{String(isAnswerKeyReady)}</dd>
          <dt>canCapture:</dt>
          <dd className="font-semibold">{String(canCapture)}</dd>
          <dt>students.length:</dt>
          <dd className="font-semibold">{students.length}</dd>
          <dt>isStudentDropdownOpen:</dt>
          <dd className="font-semibold">{String(isStudentDropdownOpen)}</dd>
          <dt>renderedDropdownOptionCount:</dt>
          <dd className="font-semibold">{renderedDropdownOptionCount}</dd>
          <dt>lastDropdownToggleEvent:</dt>
          <dd className="break-all font-semibold">{lastDropdownToggleEvent}</dd>
          <dt>lastDropdownOptionClick:</dt>
          <dd className="break-all font-semibold">{lastDropdownOptionClick}</dd>
          <dt>enqueueStudentId:</dt>
          <dd className="break-all font-semibold">{enqueueStudentId || "(empty)"}</dd>
          <dt>lastStudentSelection:</dt>
          <dd className="break-all font-semibold">{lastStudentSelection}</dd>
          <dt>studentSelectionCount:</dt>
          <dd className="font-semibold">{studentSelectionCount}</dd>
          <dt>lastEvent:</dt>
          <dd className="font-semibold">{lastEvent}</dd>
          <dt>firstStudent.id:</dt>
          <dd className="break-all font-semibold">
            {firstStudent ? firstStudent.id : "(none)"}
          </dd>
          <dt>firstStudent.name:</dt>
          <dd className="font-semibold">
            {firstStudent ? firstStudent.name : "(none)"}
          </dd>
          <dt>Object.keys(firstStudent):</dt>
          <dd className="break-all font-semibold">
            {firstStudent ? Object.keys(firstStudent).join(", ") : "(none)"}
          </dd>
        </dl>
      </div>

      <div>
        <p className="mb-1.5 block text-sm font-semibold text-stone-700">
          Хариултын хуудасны зураг
        </p>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraFileChange}
          className="sr-only"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleGalleryFileChange}
          className="sr-only"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => openPicker("camera")}
            className={cameraButtonClass}
          >
            <Camera className="size-5" aria-hidden="true" />
            <span>Камераар зураг авах</span>
          </button>
          <button
            type="button"
            onClick={() => openPicker("gallery")}
            className={galleryButtonClass}
          >
            <Images className="size-5" aria-hidden="true" />
            <span>Галерейгаас сонгох</span>
          </button>
        </div>
        {statusMessage ? (
          <p className="mt-2 text-xs font-semibold text-amber-700" role="status">
            {statusMessage}
          </p>
        ) : null}
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
    return "Зураг upload хийж байна";
  }

  if (status === "processing") {
    return "AI шалгалтад илгээгдлээ";
  }

  if (status === "done") {
    return "Амжилттай";
  }

  return "Алдаа гарсан";
}

function getStatusMessage(item: QueueItem) {
  if (item.status === "failed") {
    return `Алдаа: ${item.error || "Зураг илгээхэд алдаа гарлаа."}`;
  }

  if (item.status === "compressing") {
    return "Зураг сонгогдлоо. Зураг шахаж байна.";
  }

  return getStatusText(item.status);
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
