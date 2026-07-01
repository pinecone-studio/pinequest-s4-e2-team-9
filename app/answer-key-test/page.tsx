import AnswerKeyReviewLayout from "@/components/exams/answer-key-review-layout";
import AnswerKeyReviewForm from "@/components/exams/answer-key-review-form";
import SubmissionMaterialReviewLayout from "@/components/exams/submission-material-review-layout";
import SubmissionReviewForm from "@/components/exams/submission-review-form";

const questions = [
  {
    id: "question-1",
    number: 1,
    text: "2 + 2 хэд вэ?",
    points: 1,
    options: [
      { id: "option-1-a", label: "A", text: "3", isCorrect: false },
      { id: "option-1-b", label: "B", text: "4", isCorrect: true },
      { id: "option-1-c", label: "C", text: "5", isCorrect: false },
    ],
  },
];

const reviewQuestions = [
  {
    number: 1,
    text: "2 + 2 хэд вэ?",
    points: 1,
    selectedLabel: "B",
    correctLabel: "B",
    options: [
      { label: "A", text: "3" },
      { label: "B", text: "4" },
      { label: "C", text: "5" },
    ],
  },
];

export default function AnswerKeyTestPage() {
  return (
    <div className="min-h-screen space-y-10 bg-stone-50/30 p-8">
      <AnswerKeyReviewLayout
        examId="test-exam-id"
        originalMaterialUrl="/demo-files/exam-material.webp"
        originalMaterialName="exam-material.webp"
        originalMaterialMimeType="image/webp"
      >
        <AnswerKeyReviewForm
          examId="test-exam-id"
          questions={questions}
          hasEmptyContent={false}
        />
      </AnswerKeyReviewLayout>

      <SubmissionMaterialReviewLayout
        materialUrl="/demo-files/student-answer-1.webp"
        materialName="student-answer-1.webp"
        materialMimeType="image/webp"
      >
        <SubmissionReviewForm
          examId="test-exam-id"
          submissionId="test-submission-id"
          questions={reviewQuestions}
        />
      </SubmissionMaterialReviewLayout>
    </div>
  );
}
