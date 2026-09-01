interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}

export function Pagination({ page, totalPages, totalItems, onChange, disabled = false }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Phân trang">
      <p aria-live="polite">Trang {page} trên {totalPages}<span className="sr-only">. Tổng cộng {totalItems} mục</span></p>
      <div>
        <button className="button button-quiet" type="button" aria-label="Trang trước" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Trang trước</button>
        <button className="button button-primary" type="button" aria-label="Trang sau" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>Trang sau</button>
      </div>
    </nav>
  );
}
