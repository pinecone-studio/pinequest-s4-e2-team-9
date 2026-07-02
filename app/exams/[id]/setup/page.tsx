import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireCurrentUser } from '@/lib/supabase/server';

export default async function ExamSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: examId } = await params;
  const user = await requireCurrentUser();
  const exam = await prisma.exam.findFirst({
    where: { id: examId, ownerUserId: user.id },
    select: { id: true },
  });

  if (!exam) {
    notFound();
  }

  const isNew = false;

  const steps = [
    {
      title: 'Хариултын түлхүүр оруулах',
      description: 'Шалгалтын зөв хариултуудыг оруулна.',
      href: `/exams/${examId}/answer-key`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
        </svg>
      ),
    },
    {
      title: 'Шалгалт оруулах',
      description: 'Сурагчдын шалгалтын хуудсыг оруулж, дүнг гарга.',
      href: `/exams/${examId}/submissions`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50/30 p-8">
      <div className="max-w-3xl mx-auto mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-[#8B5E3C] transition-colors mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Буцах
        </Link>

        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Шалгалтын тохиргоо</h1>
        {isNew && (
          <p className="text-sm text-stone-500 mt-1">
            Шинэ шалгалт амжилттай үүсгэгдлээ. Дараах алхмуудыг гүйцэтгэнэ үү.
          </p>
        )}
      </div>

      <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-[#8B5E3C]/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-lg bg-[#8B5E3C]/10 text-[#8B5E3C] flex items-center justify-center mb-4 group-hover:bg-[#8B5E3C]/20 transition-colors">
              {step.icon}
            </div>
            <h3 className="text-lg font-semibold text-stone-900 mb-1">{step.title}</h3>
            <p className="text-sm text-stone-500">{step.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
