import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-8 border-b border-stone-200 pb-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? (
            <p className="mb-1 text-sm font-semibold text-[#8B5E3C]">{eyebrow}</p>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
              {description}
            </p>
          ) : null}
          {children}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
