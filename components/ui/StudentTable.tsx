import { UsersRound } from 'lucide-react';

interface StudentTableProps {
  students: {
    id: string;
    name: string;
  }[];
}

export default function StudentTable({ students }: StudentTableProps) {
  if (students.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
        <UsersRound className="mx-auto mb-3 size-8 text-[#8B5E3C]" aria-hidden="true" />
        <h3 className="text-base font-bold text-stone-900">Энэ ангид сурагч бүртгэгдээгүй байна</h3>
        <p className="mt-1 text-sm text-stone-500">
          Хариултын хуудас оруулахын өмнө сурагчдын нэрийг нэмнэ үү.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-stone-200 rounded-xl bg-white shadow-sm">
      <table className="min-w-full divide-y divide-stone-200 text-sm text-left text-stone-600">
        <thead className="bg-stone-50 text-xs font-bold text-stone-700 uppercase tracking-wider">
          <tr>
            <th scope="col" className="px-6 py-3.5 w-16">#</th>
            <th scope="col" className="px-6 py-3.5">Сурагчийн нэр</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-200">
          {students.map((student, index) => (
            <tr key={student.id} className="hover:bg-stone-50/80 transition-colors">
              <td className="px-6 py-3.5 font-medium text-stone-400">{index + 1}</td>
              <td className="px-6 py-3.5 font-semibold text-stone-900">{student.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
