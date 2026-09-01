import type { ReactNode } from 'react';

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="admin-filter" role="search">
      {children}
    </div>
  );
}
