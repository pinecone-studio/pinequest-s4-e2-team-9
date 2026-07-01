import "server-only";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const publicRoot = path.join(process.cwd(), "public");
const uploadRoot = path.join(publicRoot, "uploads", "submissions");

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
  const extension = getImageExtension(file.type, file.name);
  const relativePath = `/uploads/submissions/${safeSegment(examId)}/${safeSegment(
    clientSubmissionKey
  )}.${extension}`;
  const absolutePath = path.join(publicRoot, relativePath);

  // ponytail: demo-local storage; move this helper to object storage when uploads must survive deploys.
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return relativePath;
}

export async function readSubmissionImageFile(imageUrl: string | null) {
  if (!imageUrl?.startsWith("/uploads/submissions/")) {
    throw new Error("Submission image is not stored locally.");
  }

  const absolutePath = path.resolve(publicRoot, imageUrl.slice(1));
  const resolvedUploadRoot = path.resolve(uploadRoot);

  if (!absolutePath.startsWith(`${resolvedUploadRoot}${path.sep}`)) {
    throw new Error("Submission image path is invalid.");
  }

  const bytes = await readFile(absolutePath);
  const name = path.basename(absolutePath);

  return new File([bytes], name, { type: getMimeType(name) });
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

function getImageExtension(type: string, name: string) {
  if (type === "image/png") {
    return "png";
  }

  if (type === "image/webp") {
    return "webp";
  }

  return name.toLowerCase().endsWith(".png")
    ? "png"
    : name.toLowerCase().endsWith(".webp")
      ? "webp"
      : "jpg";
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
