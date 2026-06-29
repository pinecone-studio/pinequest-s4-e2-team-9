ALTER TABLE "Classroom" ADD COLUMN "ownerUserId" TEXT;

ALTER TABLE "Exam"
ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "captureToken" TEXT;

CREATE INDEX "Classroom_ownerUserId_idx" ON "Classroom"("ownerUserId");
CREATE INDEX "Exam_ownerUserId_idx" ON "Exam"("ownerUserId");
CREATE UNIQUE INDEX "Exam_captureToken_key" ON "Exam"("captureToken");
