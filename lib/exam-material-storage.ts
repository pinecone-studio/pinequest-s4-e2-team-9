import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const publicRoot = path.join(process.cwd(), "public");
const uploadRoot = path.join(publicRoot, "uploads", "exam-materials");

export type ExamMaterialPreview = {
  url: string | null;
  name: string | null;
  mimeType: string | null;
  missingReason: "none" | "not-uploaded" | "old-not-persisted";
};

export async function saveExamMaterialFile(file: File) {
  const safeName = safeSegment(file.name || "exam-material");
  const relativePath = `/uploads/exam-materials/${randomUUID()}-${safeName}`;
  const absolutePath = path.join(publicRoot, relativePath);

  // ponytail: local public storage; move to object storage when uploads must survive deploys.
  await mkdir(uploadRoot, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return relativePath;
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

function safeSegment(value: string) {
  const extension = path.extname(value);
  const base = path.basename(value, extension);
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_") || "exam-material";
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();

  return `${safeBase}${safeExtension}`;
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
