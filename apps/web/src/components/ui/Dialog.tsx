import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({
  titleId, title, children, onClose,
}: {
  titleId: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = panelRef.current;
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea') ?? []).filter((node) => !node.hasAttribute('disabled'));
    const nodes = focusables();
    const firstField = nodes.find((node) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName));
    (firstField ?? nodes[0])?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const nodes = focusables();
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} className="login-dialog motion-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button className="dialog-close" type="button" aria-label="Đóng" onClick={onClose}>×</button>
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    </div>
  );
}
