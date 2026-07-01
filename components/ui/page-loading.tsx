export default function PageLoading() {
  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="mx-auto max-w-7xl">
        <p className="mb-6 text-sm font-semibold text-stone-600">Ачааллаж байна...</p>
        <div className="mb-8 h-24 rounded-lg border border-stone-200 bg-white shadow-sm" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-lg border border-stone-200 bg-white shadow-sm"
            />
          ))}
        </div>
        <div className="mt-6 h-64 rounded-lg border border-stone-200 bg-white shadow-sm" />
      </div>
    </div>
  );
}
