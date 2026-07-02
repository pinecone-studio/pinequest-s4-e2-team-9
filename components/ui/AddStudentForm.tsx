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
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-stone-700">
            Овог
            <input
              type="text"
              name="lastName"
              required
              className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
          </label>
          <label className="block text-sm font-semibold text-stone-700">
            Нэр
            <input
              type="text"
              name="firstName"
              required
              className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
            />
          </label>
        </div>
        <label className="block text-sm font-semibold text-stone-700">
          Регистрийн дугаар
          <input
            type="text"
            name="registerNumber"
            className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#8B5E3C] focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
          />
        </label>
        <LoadingSubmitButton
          loadingText="Нэмж байна..."
          className="w-full px-4 py-2 text-sm font-medium"
        >
          <UserPlus className="size-4" aria-hidden="true" />
          Нэмэх
        </LoadingSubmitButton>
      </div>
    </form>
  );
}
