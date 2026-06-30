import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const publicRoot = path.join(process.cwd(), "public");
const uploadRoot = path.join(publicRoot, "uploads", "submissions");

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
  const lowerName = name.toLowerCase();

  if (lowerName.endsWith(".png")) {
    return "image/png";
  }

  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}
