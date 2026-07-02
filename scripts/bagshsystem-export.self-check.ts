import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  buildBagshSystemWorkbook,
  percentToRomanGrade,
} from "../lib/bagshsystem-export";

async function main() {
  const workbook = buildBagshSystemWorkbook([
    {
      studentName: "Энхтөгс Алтангэрэл",
      registerNumber: "ХБ14240...",
      score: 92,
      maxScore: 100,
      attended: true,
    },
    { studentName: "Бат Болд", registerNumber: "УБ123", score: 80, maxScore: 100, attended: true },
    { studentName: "Дорж Сувд", registerNumber: "УБ124", score: 72, maxScore: 100, attended: true },
    { studentName: "Цэцэг Номин", registerNumber: "УБ125", score: 60, maxScore: 100, attended: true },
    { studentName: "Ган Очир", registerNumber: "УБ126", score: 50, maxScore: 100, attended: true },
    { studentName: "Туяа Сараа", registerNumber: "УБ127", score: 30, maxScore: 100, attended: true },
    { studentName: "Мөнх Энэрэл", registerNumber: "УБ128", score: 20, maxScore: 100, attended: true },
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  const readWorkbook = new ExcelJS.Workbook();

  await readWorkbook.xlsx.load(buffer);

  assert.equal(readWorkbook.worksheets.length, 1);

  const worksheet = readWorkbook.getWorksheet("Дүн");

  assert.ok(worksheet);
  assert.equal(worksheet.getCell("A1").value, "№");
  assert.equal(worksheet.getCell("B1").value, "Овог");
  assert.equal(worksheet.getCell("C1").value, "Нэр");
  assert.equal(worksheet.getCell("D1").value, "Регистр");
  assert.equal(worksheet.getCell("E1").value, "Оноо");
  assert.equal(worksheet.getCell("F1").value, "Хувь");
  assert.equal(worksheet.getCell("G1").value, "Дүн");
  assert.equal(worksheet.getCell("H1").value, "Ирц");
  assert.equal(worksheet.getCell("A2").value, 1);
  assert.equal(worksheet.getCell("D2").value, "ХБ14240...");
  assert.equal(worksheet.getCell("E2").value, 92);
  assert.equal(worksheet.getCell("F2").value, 92);
  assert.equal(worksheet.getCell("H2").value, "Ирсэн");

  assert.equal(percentToRomanGrade(92), "VIII");
  assert.equal(percentToRomanGrade(80), "VII");
  assert.equal(percentToRomanGrade(72), "VI");
  assert.equal(percentToRomanGrade(60), "V");
  assert.equal(percentToRomanGrade(50), "IV");
  assert.equal(percentToRomanGrade(30), "II");
  assert.equal(percentToRomanGrade(20), "I");
  assert.equal(worksheet.getCell("G2").value, "VIII");
  assert.equal(worksheet.getCell("G3").value, "VII");
  assert.equal(worksheet.getCell("G4").value, "VI");
  assert.equal(worksheet.getCell("G5").value, "V");
  assert.equal(worksheet.getCell("G6").value, "IV");
  assert.equal(worksheet.getCell("G7").value, "II");
  assert.equal(worksheet.getCell("G8").value, "I");

  console.info("bagshsystem export self-check ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
