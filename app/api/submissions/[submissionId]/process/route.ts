import {
  processSubmissionByToken,
  SubmissionProcessError,
} from "@/lib/submission-processing";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await params;

  try {
    const token = await getToken(request);

    if (!token) {
      return jsonError("Зураг авах token дутуу байна.", 401);
    }

    const result = await processSubmissionByToken({ submissionId, token });

    return Response.json({ ok: true, status: result.status });
  } catch (error) {
    return jsonError(
      error instanceof SubmissionProcessError
        ? error.message
        : "AI боловсруулалт амжилтгүй боллоо.",
      error instanceof SubmissionProcessError ? error.status : 500
    );
  }
}

async function getToken(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as unknown;

    return isRecord(body) && typeof body.token === "string" ? body.token.trim() : "";
  }

  const formData = await request.formData().catch(() => null);

  return String(formData?.get("token") || "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}
