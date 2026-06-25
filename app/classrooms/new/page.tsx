import Link from 'next/link';
import CreateClassroomForm from '@/components/ui/CreateClassroomForm';

export default function NewClassroomPage() {
  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="max-w-xl mx-auto mb-6">
      
        <Link 
          href="/classrooms" 
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#8B5E3C] transition-colors mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Ангиуд руу буцах
        </Link>

        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Шинэ анги үүсгэх</h1>
        <p className="text-sm text-stone-500 mt-1">
          Шинээр үүсгэх ангийн мэдээллийг оруулна уу.
        </p>
      </div>

   
      <div className="max-w-xl mx-auto">
        <CreateClassroomForm />
      </div>
    </div>
  );
}
