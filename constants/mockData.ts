import { Classroom, RecentExam, Student } from "@/types";

export const mockClassrooms: Classroom[] = [
  { id: "10a", name: "10А анги", studentCount: 25, academicYear: "2026 оны хичээлийн жил", lastExam: "Unit Test 3" },
  { id: "10b", name: "10Б анги", studentCount: 28, academicYear: "2026 оны хичээлийн жил", lastExam: "Midterm Math" },
  { id: "11a", name: "11А анги", studentCount: 22, academicYear: "2026 оны хичээлийн жил", lastExam: "Literature Essay" },
];

export const mockRecentExams: RecentExam[] = [
  { id: "e1", title: "Unit Test 3", classroomName: "10A", subject: "Математик", progress: "18/25", status: "active" },
  { id: "e2", title: "Quiz 2", classroomName: "11Б", subject: "Англи хэл", progress: "25/25", status: "completed" },
];

export const mockStudents: Student[] = [
  { id: "s1", name: "Бат-Эрдэнэ А." },
  { id: "s2", name: "Сарангэрэл Б." },
  { id: "s3", name: "Тэмүүлэн Г." },
];