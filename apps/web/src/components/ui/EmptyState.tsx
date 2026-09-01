import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="workspace-state" role="status">{children}</div>;
}

export function ErrorState({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="workspace-state is-error" role="alert">
      {children}
      {onRetry && <button type="button" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}
