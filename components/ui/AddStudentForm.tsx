import { UserPlus } from 'lucide-react';
import { createStudentAction } from '@/actions/classroom-actions';
import LoadingSubmitButton from '@/components/ui/loading-submit-button';

interface AddStudentFormProps {
  classroomId: string;
}

export default function AddStudentForm({ classroomId }: AddStudentFormProps) {
  return (
    <form action={createStudentAction} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm max-w-md">
      <h3 className="text-sm font-bold text-stone-900 mb-3">Шинэ сурагч нэмэх</h3>
      <input type="hidden" name="classroomId" value={classroomId} />
      <div className="flex gap-2">
        <input
          type="text"
          name="name"
          placeholder="Сурагчийн бүтэн нэр"
          required
          className="flex-1 px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
        />
        <LoadingSubmitButton
          loadingText="Нэмж байна..."
          className="whitespace-nowrap px-4 py-1.5 text-sm font-medium"
        >
          <UserPlus className="size-4" aria-hidden="true" />
          Нэмэх
        </LoadingSubmitButton>
      </div>
    </form>
  );
}
