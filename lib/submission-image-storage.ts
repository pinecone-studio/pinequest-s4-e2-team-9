import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  getSubmissionImageFileFromUrl,
  getSubmissionPageDisplayUrl,
  getSubmissionPageFile,
  uploadLegacySubmissionImageToStorage,
  uploadSubmissionPageToStorage,
} from "@/lib/upload-storage";

const publicRoot = path.join(process.cwd(), "public");

export type SubmissionImagePreview = {
  url: string | null;
  name: string | null;
  mimeType: string | null;
  missingReason: "none" | "not-uploaded" | "old-not-persisted";
};

export async function saveSubmissionImageFile({
  file,
  examId,
  clientSubmissionKey,
}: {
  file: File;
  examId: string;
  clientSubmissionKey: string;
}) {
  const saved = await uploadLegacySubmissionImageToStorage({
    file,
    examId,
    clientSubmissionKey,
    fileName: file.name || null,
    contentType: file.type || null,
  });

  return saved.publicUrl ?? saved.storagePath;
}

export async function saveSubmissionPageFile({
  file,
  examId,
  studentId,
  submissionId,
  pageNumber,
}: {
  file: File;
  examId: string;
  studentId: string;
  submissionId: string;
  pageNumber: number;
}) {
  return uploadSubmissionPageToStorage({
    file,
    examId,
    studentId,
    submissionId,
    pageNumber,
    fileName: file.name || null,
    contentType: file.type || null,
  });
}

export async function readSubmissionPageFile(page: {
  storagePath: string;
  publicUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  return getSubmissionPageFile(page);
}

export async function readSubmissionImageFile(imageUrl: string | null) {
  return getSubmissionImageFileFromUrl(imageUrl);
}

export async function getSubmissionImagePreview(
  imageUrl: string | null | undefined,
  examId: string
): Promise<SubmissionImagePreview> {
  const value = imageUrl?.trim();

  if (!value) {
    return {
      url: null,
      name: null,
      mimeType: null,
      missingReason: "not-uploaded",
    };
  }

  if (value.startsWith("/") || /^https?:\/\//i.test(value)) {
    return {
      url: value,
      name: getFileName(value),
      mimeType: getMimeType(value),
      missingReason: "none",
    };
  }

  if (value.includes("/")) {
    const url = await getSubmissionPageDisplayUrl(value);

    if (url) {
      return {
        url,
        name: getFileName(value),
        mimeType: getMimeType(value),
        missingReason: "none",
      };
    }
  }

  for (const url of [
    `/uploads/submissions/${safeSegment(examId)}/${encodeURIComponent(value)}`,
    `/${encodeURIComponent(value)}`,
  ]) {
    if (await publicFileExists(url)) {
      return {
        url,
        name: value,
        mimeType: getMimeType(value),
        missingReason: "none",
      };
    }
  }

  return {
    url: null,
    name: value,
    mimeType: getMimeType(value),
    missingReason: "old-not-persisted",
  };
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_") || "file";
}

function getMimeType(name: string) {
  const lowerName = getPathname(name).toLowerCase();

  if (lowerName.endsWith(".png")) {
    return "image/png";
  }

  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

async function publicFileExists(publicPath: string) {
  const absolutePath = getPublicFilePath(publicPath);

  if (!absolutePath) {
    return false;
  }

  try {
    const file = await stat(absolutePath);
    return file.isFile();
  } catch {
    return false;
  }
}

function getFileName(value: string) {
  try {
    const pathname = /^https?:\/\//i.test(value) ? new URL(value).pathname : value;
    return decodeURIComponent(path.basename(pathname)) || null;
  } catch {
    return path.basename(value) || null;
  }
}

function getPathname(value: string) {
  try {
    return /^https?:\/\//i.test(value) ? new URL(value).pathname : value.split(/[?#]/)[0];
  } catch {
    return value;
  }
}

function getPublicFilePath(publicPath: string) {
  if (!publicPath.startsWith("/")) {
    return null;
  }

  const relativePath = decodeURIComponent(publicPath).replace(/^\/+/, "");

  if (relativePath.split(/[\\/]/).includes("..")) {
    return null;
  }

  return path.join(publicRoot, relativePath);
}
