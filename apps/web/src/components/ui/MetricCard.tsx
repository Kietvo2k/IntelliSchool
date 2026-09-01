export function MetricCard({ label, value, unit = '' }: { label: string; value: string | number; unit?: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}{unit}</strong>
    </article>
  );
}
