import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow, title, lede, actions, compact = false,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <header className={`page-header ${compact ? 'page-header--compact' : 'mb-8'} flex flex-wrap items-start justify-between gap-4`}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="max-w-[18ch]">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
