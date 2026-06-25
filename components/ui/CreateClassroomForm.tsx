import Link from 'next/link';
import { createClassroomAction } from '@/actions/classroom-actions';

export default function CreateClassroomForm() {
  return (
    <form action={createClassroomAction} className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm max-w-xl mx-auto">
      <div className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-stone-700 mb-1.5">
            Ангийн нэр <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            placeholder="Жишээ: 11А анги"
            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:border-[#8B5E3C] text-stone-900"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
          <Link
            href="/classrooms"
            className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Цуцлах
          </Link>
          <button
            type="submit"
            className="px-5 py-2 text-sm font-medium text-white bg-[#8B5E3C] hover:bg-[#734d31] rounded-lg transition-colors shadow-sm"
          >
            Анги үүсгэх
          </button>
        </div>
      </div>
    </form>
  );
}
