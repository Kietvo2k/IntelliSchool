import type { ReactNode } from 'react';

export function DataTable({
  headers, children, empty,
}: {
  headers: string[];
  children: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="data-table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {children ?? null}
          {empty}
        </tbody>
      </table>
    </div>
  );
}
