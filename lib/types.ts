export type Classroom = {
  id: string;
  name: string;
  subject?: string;
  students: Student[];
  exams?: Exam[];
};

export type Student = {
  id: string;
  name: string;
  classroomId: string;
};

export type Exam = {
  id: string;
  title: string;
  subject: string;
  questionCount: number;
  classroomId: string;
  classroomName?: string;
  materialUrl?: string | null;
  createdAt?: string;
};

export type AnswerKey = {
  question: number;
  answer: "A" | "B" | "C" | "D";
};

export type SubmissionAnswer = {
  question: number;
  selected: "A" | "B" | "C" | "D";
  correct: "A" | "B" | "C" | "D";
  isCorrect: boolean;
};

export type Submission = {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  score: number;
  total: number;
  percentage: number;
  answers: SubmissionAnswer[];
  createdAt?: string;
};