'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { mockClassrooms, mockStudents } from '../../../constants/mockData';
import { Student } from '../../../types';
import StudentTable from '../../../components/ui/StudentTable';
import AddStudentForm from '../../../components/ui/AddStudentForm';

export default function ClassroomDetailPage() {
  const params = useParams();
  const classroomId = params.id as string;

  const classroom = mockClassrooms.find((c) => c.id === classroomId) ?? null;
  const [students, setStudents] = useState<Student[]>(mockStudents);

  const handleAddStudent = (name: string) => {
    const newStudent: Student = {
      id: `s-${Date.now()}`, 
      name: name,
    };
    setStudents((prev) => [...prev, newStudent]);
  };


  const handleRemoveStudent = (id: string) => {
    if (confirm('Энэ сурагчийг ангиас хасахдаа итгэлтэй байна уу?')) {
      setStudents((prev) => prev.filter((student) => student.id !== id));
    }
  };

  if (!classroom) {
    return (
      <div className="min-h-screen bg-stone-50/30 p-8 flex items-center justify-center">
        <p className="text-stone-500 text-sm">Ангийн мэдээлэл олдсонгүй.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="max-w-5xl mx-auto">
        
        
        <div className="mb-8">
          <Link 
            href="/classrooms" 
            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#8B5E3C] transition-colors mb-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Ангиуд руу буцах
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-6">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-2">{classroom.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-500">
                <span className="flex items-center gap-1.5">
                  <strong>Хичээлийн жил:</strong> {classroom.academicYear}
                </span>
                <span className="text-stone-300">•</span>
                <span className="flex items-center gap-1.5">
                  <strong>Нийт сурагч:</strong> {students.length}
                </span>
              </div>
            </div>
          </div>
        </div>

       
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
        
          <div className="lg:col-span-1">
            <AddStudentForm onAddStudent={handleAddStudent} />
          </div>

  
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Сурагчдын жагсаалт ({students.length})</h2>
            <StudentTable students={students} onRemoveStudent={handleRemoveStudent} />
          </div>

        </div>

      </div>
    </div>
  );
}