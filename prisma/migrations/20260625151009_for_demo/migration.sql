/*
  Warnings:

  - A unique constraint covering the columns `[examId,question]` on the table `AnswerKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AnswerKey_examId_question_key" ON "AnswerKey"("examId", "question");
