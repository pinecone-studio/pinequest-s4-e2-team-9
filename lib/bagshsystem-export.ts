import ExcelJS from "exceljs";

export type BagshSystemExportRow = {
  studentName: string;
  registerNumber?: string | null;
  score?: number | null;
  maxScore?: number | null;
  percent?: number | null;
  attended: boolean;
};

const headers = ["№", "Овог", "Нэр", "Регистр", "Оноо", "Хувь", "Дүн", "Ирц"];
const columnWidths = [6, 18, 18, 18, 10, 10, 10, 12];

export function normalizePercent({
  score,
  maxScore,
  percent,
}: {
  score?: number | null;
  maxScore?: number | null;
  percent?: number | null;
}) {
  const savedPercent = finiteNumber(percent);

  if (savedPercent !== null) {
    return clampPercent(savedPercent);
  }

  const safeScore = finiteNumber(score) ?? 0;
  const safeMaxScore = finiteNumber(maxScore);

  return clampPercent(
    safeMaxScore && safeMaxScore > 0 ? (safeScore / safeMaxScore) * 100 : safeScore
  );
}

export function percentToRomanGrade(percent: number) {
  const normalized = clampPercent(percent);

  if (normalized >= 90) return "VIII";
  if (normalized >= 80) return "VII";
  if (normalized >= 70) return "VI";
  if (normalized >= 60) return "V";
  if (normalized >= 50) return "IV";
  if (normalized >= 40) return "III";
  if (normalized >= 30) return "II";

  return "I";
}

export function buildBagshSystemWorkbook(rows: BagshSystemExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Дүн");

  worksheet.addRow(headers);
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true };
  columnWidths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  rows.forEach((row, index) => {
    const name = splitStudentName(row.studentName);
    const score = row.attended ? finiteNumber(row.score) ?? 0 : "";
    const percent = row.attended
      ? normalizePercent({
          score: row.score,
          maxScore: row.maxScore,
          percent: row.percent,
        })
      : "";

    worksheet.addRow([
      index + 1,
      name.lastName,
      name.firstName,
      row.registerNumber ?? "",
      score,
      percent,
      row.attended && typeof percent === "number" ? percentToRomanGrade(percent) : "",
      row.attended ? "Ирсэн" : "Ирээгүй",
    ]);
  });

  return workbook;
}

function splitStudentName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return { lastName: "", firstName: parts[0] ?? "" };
  }

  // ponytail: legacy students only have one display name; add name columns if cleanup must be exact.
  return { lastName: parts[0], firstName: parts.slice(1).join(" ") };
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
