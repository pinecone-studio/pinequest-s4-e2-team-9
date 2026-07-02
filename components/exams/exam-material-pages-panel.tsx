import { FileText, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import {
  deleteExamMaterialPageAction,
  processExamMaterialPagesAction,
  uploadExamMaterialPagesAction,
} from "@/actions/exam-actions";

type ExamMaterialPage = {
  id: string;
  pageNumber: number;
  fileName: string | null;
  mimeType: string | null;
  publicUrl: string | null;
  status: string;
  errorMessage: string | null;
};

export default function ExamMaterialPagesPanel({
  examId,
  pages,
}: {
  examId: string;
  pages: ExamMaterialPage[];
}) {
  return (
    <section className="mb-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900">
            Шалгалтын материалын хуудсууд
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Эдгээр хуудсууд нэг шалгалтын материал болж боловсруулагдана.
          </p>
        </div>
        <form action={processExamMaterialPagesAction}>
          <input type="hidden" name="examId" value={examId} />
          <button
            type="submit"
            disabled={pages.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#8B5E3C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#734d31] disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            AI-аар асуулт таних
          </button>
        </form>
      </div>

      <form action={uploadExamMaterialPagesAction} className="mt-5 rounded-lg border border-dashed border-stone-300 bg-stone-50/60 p-4">
        <input type="hidden" name="examId" value={examId} />
        <label className="mb-2 block text-sm font-semibold text-stone-700" htmlFor="materials">
          Хуудас нэмэх
        </label>
        <input
          id="materials"
          name="materials"
          type="file"
          accept="image/*"
          multiple
          required
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 file:mr-4 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
        />
        <button
          type="submit"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          <UploadCloud className="size-4" aria-hidden="true" />
          Камер/зураг сонгох
        </button>
      </form>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-stone-900">Оруулсан хуудсууд</h3>
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Дараалал
          </span>
        </div>
        {pages.length === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-center text-sm font-medium text-stone-500">
            Одоогоор хуудас оруулаагүй байна.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pages.map((page) => (
              <div key={page.id} className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
                {page.publicUrl && page.mimeType?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.publicUrl}
                    alt={`Хуудас ${page.pageNumber}`}
                    className="h-20 w-[72px] rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-[72px] items-center justify-center rounded-md bg-stone-200">
                    <FileText className="size-6 text-stone-500" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900">Хуудас {page.pageNumber}</p>
                      <p className="truncate text-xs text-stone-500">
                        {page.fileName || "Нэргүй файл"}
                      </p>
                    </div>
                    <span className={getStatusClass(page.status)}>
                      {getStatusText(page.status)}
                    </span>
                  </div>
                  {page.errorMessage ? (
                    <p className="mt-1 text-xs font-medium text-red-700">
                      {page.errorMessage}
                    </p>
                  ) : null}
                  <form action={deleteExamMaterialPageAction} className="mt-3">
                    <input type="hidden" name="pageId" value={page.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Устгах
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function getStatusText(status: string) {
  if (status === "PROCESSING") {
    return "Боловсруулж байна";
  }

  if (status === "PROCESSED") {
    return "Боловсруулсан";
  }

  if (status === "FAILED") {
    return "Алдаа";
  }

  return "Оруулсан";
}

function getStatusClass(status: string) {
  if (status === "PROCESSED") {
    return "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800";
  }

  if (status === "FAILED") {
    return "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800";
  }

  if (status === "PROCESSING") {
    return "inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800";
  }

  return "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800";
}
