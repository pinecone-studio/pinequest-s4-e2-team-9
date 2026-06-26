import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/layout/page-header';
import CreateClassroomForm from '@/components/ui/CreateClassroomForm';

export default function NewClassroomPage() {
  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="max-w-xl mx-auto mb-6">
        <PageHeader
          title="Шинэ анги үүсгэх"
          description="Шинээр үүсгэх ангийн мэдээллийг оруулна уу."
        >
          <Link
            href="/classrooms"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#8B5E3C] transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Ангиуд руу буцах
          </Link>
        </PageHeader>
      </div>

   
      <div className="max-w-xl mx-auto">
        <CreateClassroomForm />
      </div>
    </div>
  );
}
