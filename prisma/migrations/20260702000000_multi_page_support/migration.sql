CREATE TABLE "ExamMaterialPage" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "extractionJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamMaterialPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubmissionPage" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "extractionJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionPage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExamQuestion" ADD COLUMN "sourcePageNumber" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "pageCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Submission" ADD COLUMN "gradingDetails" JSONB;

CREATE UNIQUE INDEX "ExamMaterialPage_examId_pageNumber_key" ON "ExamMaterialPage"("examId", "pageNumber");
CREATE INDEX "ExamMaterialPage_examId_idx" ON "ExamMaterialPage"("examId");
CREATE UNIQUE INDEX "SubmissionPage_submissionId_pageNumber_key" ON "SubmissionPage"("submissionId", "pageNumber");
CREATE INDEX "SubmissionPage_submissionId_idx" ON "SubmissionPage"("submissionId");

ALTER TABLE "ExamMaterialPage" ADD CONSTRAINT "ExamMaterialPage_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionPage" ADD CONSTRAINT "SubmissionPage_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
