import { createStudentAction } from '@/actions/classroom-actions';

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
        <button
          type="submit"
          className="px-4 py-1.5 text-sm font-medium text-white bg-[#8B5E3C] hover:bg-[#734d31] rounded-lg transition-colors whitespace-nowrap"
        >
          Нэмэх
        </button>
      </div>
    </form>
  );
}
