export interface Student {
  id: string;
  name: string;
  status?: "шалгагдсан" | "хүлээгдэж байна" | "REVIEW хэрэгтэй"; 
}

export interface Classroom {
  id: string;
  name: string;
  studentCount: number;
  academicYear: string; 
  lastExam?: string; 
}

export interface RecentExam {
  id: string;
  title: string;
  classroomName: string;
  subject: string;
  progress: string; 
  status: "active" | "completed";
}