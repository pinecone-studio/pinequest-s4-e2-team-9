import { randomUUID } from "node:crypto";

export const examMaterialBucket = "exam-materials";
export const submissionsBucket = "submissions";

export function buildExamMaterialPageStoragePath({
  examId,
  pageNumber,
  extension,
  uuid = randomUUID(),
}: {
  examId: string;
  pageNumber: number;
  extension: string;
  uuid?: string;
}) {
  return `${safeSegment(examId)}/pages/page-${pageNumber}-${uuid}.${normalizeExtension(extension)}`;
}

export function buildSubmissionPageStoragePath({
  examId,
  studentId,
  submissionId,
  pageNumber,
  extension,
  uuid = randomUUID(),
}: {
  examId: string;
  studentId: string;
  submissionId: string;
  pageNumber: number;
  extension: string;
  uuid?: string;
}) {
  return `${safeSegment(examId)}/${safeSegment(studentId)}/${safeSegment(
    submissionId
  )}/pages/page-${pageNumber}-${uuid}.${normalizeExtension(extension)}`;
}

export function buildLegacySubmissionImageStoragePath({
  examId,
  clientSubmissionKey,
  extension,
  uuid = randomUUID(),
}: {
  examId: string;
  clientSubmissionKey: string;
  extension: string;
  uuid?: string;
}) {
  return `${safeSegment(examId)}/legacy/${safeSegment(
    clientSubmissionKey
  )}-${uuid}.${normalizeExtension(extension)}`;
}

export function isLocalUploadReference(value: string | null | undefined) {
  const pathValue = value?.trim();

  return (
    !!pathValue &&
    (pathValue.startsWith("/uploads/") ||
      pathValue.startsWith("public/uploads/") ||
      pathValue.startsWith("uploads/") ||
      pathValue.startsWith(`${examMaterialBucket}/`) ||
      pathValue.startsWith(`${submissionsBucket}/`))
  );
}

export function getLocalUploadUrl(value: string | null | undefined) {
  const pathValue = value?.trim();

  if (!pathValue) {
    return null;
  }

  if (pathValue.startsWith("/uploads/")) {
    return pathValue;
  }

  if (pathValue.startsWith("public/uploads/")) {
    return `/${pathValue.replace(/^public\/+/, "")}`;
  }

  if (pathValue.startsWith("uploads/")) {
    return `/${pathValue}`;
  }

  if (
    pathValue.startsWith(`${examMaterialBucket}/`) ||
    pathValue.startsWith(`${submissionsBucket}/`)
  ) {
    return `/uploads/${pathValue}`;
  }

  return null;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_") || "file";
}

function normalizeExtension(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
}
