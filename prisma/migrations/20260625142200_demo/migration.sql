/*
  Warnings:

  - You are about to drop the column `correctAnswer` on the `AnswerKey` table. All the data in the column will be lost.
  - You are about to drop the column `points` on the `AnswerKey` table. All the data in the column will be lost.
  - You are about to drop the column `questionNumber` on the `AnswerKey` table. All the data in the column will be lost.
  - You are about to drop the column `teacherId` on the `Classroom` table. All the data in the column will be lost.
  - You are about to drop the column `pointPerQuestion` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `teacherId` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `totalScore` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `displayName` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `aiConfidence` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `blankCount` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `correctCount` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `needsReview` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `teacherConfirmed` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `totalScore` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `wrongCount` on the `Submission` table. All the data in the column will be lost.
  - You are about to alter the column `score` on the `Submission` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `confidence` on the `SubmissionAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `correctAnswer` on the `SubmissionAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `detectedAnswer` on the `SubmissionAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `pointsAwarded` on the `SubmissionAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `questionNumber` on the `SubmissionAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `teacherOverrideAnswer` on the `SubmissionAnswer` table. All the data in the column will be lost.
  - You are about to drop the `Teacher` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `answer` to the `AnswerKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `AnswerKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `correct` to the `SubmissionAnswer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `SubmissionAnswer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `selected` to the `SubmissionAnswer` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Classroom" DROP CONSTRAINT "Classroom_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_teacherId_fkey";

-- DropIndex
DROP INDEX "AnswerKey_examId_questionNumber_key";

-- DropIndex
DROP INDEX "SubmissionAnswer_submissionId_questionNumber_key";

-- AlterTable
ALTER TABLE "AnswerKey" DROP COLUMN "correctAnswer",
DROP COLUMN "points",
DROP COLUMN "questionNumber",
ADD COLUMN     "answer" TEXT NOT NULL,
ADD COLUMN     "question" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Classroom" DROP COLUMN "teacherId",
ADD COLUMN     "subject" TEXT;

-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "pointPerQuestion",
DROP COLUMN "status",
DROP COLUMN "teacherId",
DROP COLUMN "totalScore",
ADD COLUMN     "materialUrl" TEXT;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "displayName",
DROP COLUMN "updatedAt",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "aiConfidence",
DROP COLUMN "blankCount",
DROP COLUMN "correctCount",
DROP COLUMN "needsReview",
DROP COLUMN "status",
DROP COLUMN "teacherConfirmed",
DROP COLUMN "totalScore",
DROP COLUMN "updatedAt",
DROP COLUMN "wrongCount",
ADD COLUMN     "total" INTEGER NOT NULL,
ALTER COLUMN "score" DROP DEFAULT,
ALTER COLUMN "score" SET DATA TYPE INTEGER,
ALTER COLUMN "percentage" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SubmissionAnswer" DROP COLUMN "confidence",
DROP COLUMN "correctAnswer",
DROP COLUMN "detectedAnswer",
DROP COLUMN "pointsAwarded",
DROP COLUMN "questionNumber",
DROP COLUMN "teacherOverrideAnswer",
ADD COLUMN     "correct" TEXT NOT NULL,
ADD COLUMN     "question" INTEGER NOT NULL,
ADD COLUMN     "selected" TEXT NOT NULL;

-- DropTable
DROP TABLE "Teacher";
