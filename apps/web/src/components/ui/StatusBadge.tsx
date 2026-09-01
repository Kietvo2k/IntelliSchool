const toneClass: Record<string, string> = {
  published: 'published',
  draft: 'draft',
  archived: 'archived',
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  ready: 'published',
  processing: 'pending',
  quarantined: 'pending',
};

export function StatusBadge({ tone, children }: { tone: string; children: string }) {
  const className = toneClass[tone.toLowerCase()] ?? 'draft';
  return <span className={`status-badge ${className}`}>{children}</span>;
}
