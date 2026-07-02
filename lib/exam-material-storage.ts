import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";
import {
  getExamMaterialPageDisplayUrl,
  getExamMaterialPageFile,
  uploadExamMaterialPageToStorage,
} from "@/lib/upload-storage";

const publicRoot = path.join(process.cwd(), "public");

export type ExamMaterialPreview = {
  url: string | null;
  name: string | null;
  mimeType: string | null;
  missingReason: "none" | "not-uploaded" | "old-not-persisted";
};

export async function saveExamMaterialFile(file: File, examId: string) {
  const saved = await saveExamMaterialPageFile({ file, examId, pageNumber: 1 });

  return saved.publicUrl ?? saved.storagePath;
}

export async function saveExamMaterialPageFile({
  file,
  examId,
  pageNumber,
}: {
  file: File;
  examId: string;
  pageNumber: number;
}) {
  return uploadExamMaterialPageToStorage({
    file,
    examId,
    pageNumber,
    fileName: file.name || null,
    contentType: file.type || null,
  });
}

export async function readExamMaterialPageFile(page: {
  storagePath: string;
  publicUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  return getExamMaterialPageFile(page);
}

export async function getExamMaterialPreview(
  materialUrl: string | null | undefined
): Promise<ExamMaterialPreview> {
  const value = materialUrl?.trim();

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

  if (value.includes("/pages/page-")) {
    const url = await getExamMaterialPageDisplayUrl(value);

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
    `/uploads/exam-materials/${encodeURIComponent(value)}`,
    `/${encodeURIComponent(value)}`,
    `/demo-files/${encodeURIComponent(value)}`,
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

function getFileName(value: string) {
  try {
    const pathname = /^https?:\/\//i.test(value) ? new URL(value).pathname : value;
    return decodeURIComponent(path.basename(pathname)) || null;
  } catch {
    return path.basename(value) || null;
  }
}

function getMimeType(value: string) {
  const extension = path.extname(getPathname(value)).toLowerCase();

  if (extension === ".pdf") {
    return "application/pdf";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  return null;
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
