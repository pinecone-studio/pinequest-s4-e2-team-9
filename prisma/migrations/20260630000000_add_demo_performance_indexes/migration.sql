CREATE INDEX IF NOT EXISTS "Student_classroomId_idx" ON "Student"("classroomId");
CREATE INDEX IF NOT EXISTS "Exam_classroomId_idx" ON "Exam"("classroomId");
CREATE INDEX IF NOT EXISTS "ExamOption_questionId_idx" ON "ExamOption"("questionId");
CREATE INDEX IF NOT EXISTS "Submission_examId_studentId_idx" ON "Submission"("examId", "studentId");
CREATE INDEX IF NOT EXISTS "Submission_examId_status_idx" ON "Submission"("examId", "status");
CREATE INDEX IF NOT EXISTS "SubmissionAnswer_submissionId_question_idx" ON "SubmissionAnswer"("submissionId", "question");
