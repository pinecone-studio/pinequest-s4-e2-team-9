import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildExamMaterialPageStoragePath,
  buildLegacySubmissionImageStoragePath,
  buildSubmissionPageStoragePath,
  examMaterialBucket,
  getLocalUploadUrl,
  isLocalUploadReference,
  submissionsBucket,
} from "@/lib/upload-storage-paths";

export {
  buildExamMaterialPageStoragePath,
  buildSubmissionPageStoragePath,
  examMaterialBucket,
  isLocalUploadReference,
  submissionsBucket,
};

const publicRoot = path.join(process.cwd(), "public");
const signedUrlTtlSeconds = 60 * 60;

type UploadInput = {
  file: File;
  fileName?: string | null;
  contentType?: string | null;
};

export type StoredUpload = {
  storagePath: string;
  publicUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
};

export async function uploadExamMaterialPageToStorage({
  examId,
  pageNumber,
  file,
  fileName,
  contentType,
}: UploadInput & { examId: string; pageNumber: number }): Promise<StoredUpload> {
  const name = fileName || file.name || `page-${pageNumber}`;
  const mimeType = contentType || file.type || getMimeType(name) || "image/jpeg";
  const storagePath = buildExamMaterialPageStoragePath({
    examId,
    pageNumber,
    extension: getExtension(mimeType, name),
  });

  return uploadToBucket({
    bucket: examMaterialBucket,
    storagePath,
    file,
    fileName: name,
    mimeType,
  });
}

export async function uploadSubmissionPageToStorage({
  examId,
  studentId,
  submissionId,
  pageNumber,
  file,
  fileName,
  contentType,
}: UploadInput & {
  examId: string;
  studentId: string;
  submissionId: string;
  pageNumber: number;
}): Promise<StoredUpload> {
  const name = fileName || file.name || `page-${pageNumber}`;
  const mimeType = contentType || file.type || getMimeType(name) || "image/jpeg";
  const storagePath = buildSubmissionPageStoragePath({
    examId,
    studentId,
    submissionId,
    pageNumber,
    extension: getExtension(mimeType, name),
  });

  return uploadToBucket({
    bucket: submissionsBucket,
    storagePath,
    file,
    fileName: name,
    mimeType,
  });
}

export async function uploadLegacySubmissionImageToStorage({
  examId,
  clientSubmissionKey,
  file,
  fileName,
  contentType,
}: UploadInput & {
  examId: string;
  clientSubmissionKey: string;
}): Promise<StoredUpload> {
  const name = fileName || file.name || "answer-sheet";
  const mimeType = contentType || file.type || getMimeType(name) || "image/jpeg";
  const storagePath = buildLegacySubmissionImageStoragePath({
    examId,
    clientSubmissionKey,
    extension: getExtension(mimeType, name),
  });

  return uploadToBucket({
    bucket: submissionsBucket,
    storagePath,
    file,
    fileName: name,
    mimeType,
  });
}

export async function getExamMaterialPageDisplayUrl(
  storagePath: string | null | undefined,
  publicUrl?: string | null
) {
  return getDisplayUrl(examMaterialBucket, storagePath, publicUrl);
}

export async function getSubmissionPageDisplayUrl(
  storagePath: string | null | undefined,
  publicUrl?: string | null
) {
  return getDisplayUrl(submissionsBucket, storagePath, publicUrl);
}

export async function getExamMaterialPageFile(page: {
  storagePath: string;
  publicUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  return getStoredFile(examMaterialBucket, page);
}

export async function getSubmissionPageFile(page: {
  storagePath: string;
  publicUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  return getStoredFile(submissionsBucket, page);
}

export async function getSubmissionImageFileFromUrl(imageUrl: string | null) {
  const value = imageUrl?.trim();

  if (!value) {
    throw new Error("Зураг олдсонгүй.");
  }

  const storagePath = getStoragePathFromSupabaseUrl(value, submissionsBucket);

  if (storagePath) {
    return getStoredFile(submissionsBucket, {
      storagePath,
      publicUrl: value,
      fileName: path.basename(storagePath),
      mimeType: getMimeType(storagePath),
    });
  }

  const localFile = await readLocalUploadFile({ publicUrl: value });

  if (localFile) {
    return localFile;
  }

  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value);

    if (!response.ok) {
      throw new Error("Зураг олдсонгүй.");
    }

    const name = getFileName(value) || "answer-sheet.jpg";

    return new File([await response.arrayBuffer()], name, {
      type: response.headers.get("content-type") || getMimeType(name) || "image/jpeg",
    });
  }

  if (value.includes("/")) {
    return getStoredFile(submissionsBucket, {
      storagePath: value,
      fileName: path.basename(value),
      mimeType: getMimeType(value),
    });
  }

  throw new Error("Зураг олдсонгүй.");
}

export async function deleteExamMaterialStorageObjects(paths: string[]) {
  await deleteStorageObjects(examMaterialBucket, paths);
}

export async function deleteSubmissionStorageObjects(paths: string[]) {
  await deleteStorageObjects(submissionsBucket, paths);
}

async function uploadToBucket({
  bucket,
  storagePath,
  file,
  fileName,
  mimeType,
}: {
  bucket: string;
  storagePath: string;
  file: File;
  fileName: string;
  mimeType: string;
}): Promise<StoredUpload> {
  const supabase = getStorageClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    console.error("[upload-storage] upload failed", { bucket, storagePath, error });
    throw new Error("Зураг хадгалах үед алдаа гарлаа.");
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl || null,
    fileName,
    mimeType,
  };
}

async function getDisplayUrl(
  bucket: string,
  storagePath: string | null | undefined,
  publicUrl?: string | null
) {
  if (publicUrl?.trim()) {
    return publicUrl.trim();
  }

  const localUrl = getLocalUploadUrl(storagePath);

  if (localUrl) {
    return localUrl;
  }

  if (!storagePath?.trim()) {
    return null;
  }

  const { data, error } = await getStorageClient()
    .storage.from(bucket)
    .createSignedUrl(storagePath.trim(), signedUrlTtlSeconds);

  if (error) {
    console.warn("[upload-storage] signed URL failed", {
      bucket,
      storagePath,
      error,
    });
    return null;
  }

  return data.signedUrl || null;
}

async function getStoredFile(
  bucket: string,
  page: {
    storagePath: string;
    publicUrl?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
  }
) {
  const localFile = await readLocalUploadFile(page);

  if (localFile) {
    return localFile;
  }

  const { data, error } = await getStorageClient()
    .storage.from(bucket)
    .download(page.storagePath);

  if (error || !data) {
    console.error("[upload-storage] download failed", {
      bucket,
      storagePath: page.storagePath,
      error,
    });
    throw new Error("Зураг олдсонгүй.");
  }

  const name = page.fileName || path.basename(page.storagePath);

  return new File([await data.arrayBuffer()], name, {
    type: page.mimeType || getMimeType(name) || "image/jpeg",
  });
}

async function deleteStorageObjects(bucket: string, paths: string[]) {
  const storagePaths = paths.filter((item) => item && !isLocalUploadReference(item));

  if (storagePaths.length === 0) {
    return;
  }

  const { error } = await getStorageClient().storage.from(bucket).remove(storagePaths);

  if (error) {
    console.warn("[upload-storage] delete failed", { bucket, paths: storagePaths, error });
  }
}

async function readLocalUploadFile(page: {
  storagePath?: string | null;
  publicUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const localUrl = getLocalUploadUrl(page.publicUrl) || getLocalUploadUrl(page.storagePath);

  if (!localUrl) {
    return null;
  }

  const filePath = getPublicFilePath(localUrl);

  if (!filePath) {
    return null;
  }

  let bytes: Buffer;

  try {
    bytes = await readFile(filePath);
  } catch {
    throw new Error("Зураг олдсонгүй.");
  }

  const name = page.fileName || path.basename(filePath);

  return new File([toArrayBuffer(bytes)], name, {
    type: page.mimeType || getMimeType(name) || "image/jpeg",
  });
}

function toArrayBuffer(bytes: Buffer) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Supabase Storage тохиргоо дутуу байна: NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Supabase Storage тохиргоо дутуу байна: SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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

function getExtension(type: string, name: string) {
  if (type === "application/pdf") {
    return "pdf";
  }

  if (type === "image/png") {
    return "png";
  }

  if (type === "image/webp") {
    return "webp";
  }

  if (type === "image/gif") {
    return "gif";
  }

  const extension = path.extname(name).replace(/^\./, "");

  return extension || "jpg";
}

function getMimeType(value: string) {
  const extension = path.extname(value.split(/[?#]/)[0]).toLowerCase();

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

function getFileName(value: string) {
  try {
    const pathname = /^https?:\/\//i.test(value) ? new URL(value).pathname : value;
    return decodeURIComponent(path.basename(pathname)) || null;
  } catch {
    return path.basename(value) || null;
  }
}

function getStoragePathFromSupabaseUrl(value: string, bucket: string) {
  try {
    const pathname = new URL(value).pathname;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const signedMarker = `/storage/v1/object/sign/${bucket}/`;
    const index = pathname.indexOf(marker);
    const signedIndex = pathname.indexOf(signedMarker);
    const rawPath =
      index >= 0
        ? pathname.slice(index + marker.length)
        : signedIndex >= 0
          ? pathname.slice(signedIndex + signedMarker.length)
          : "";

    return rawPath ? decodeURIComponent(rawPath) : null;
  } catch {
    return null;
  }
}

export async function localUploadExists(value: string | null | undefined) {
  const localUrl = getLocalUploadUrl(value);

  if (!localUrl) {
    return false;
  }

  const filePath = getPublicFilePath(localUrl);

  if (!filePath) {
    return false;
  }

  try {
    const file = await stat(filePath);
    return file.isFile();
  } catch {
    return false;
  }
}
