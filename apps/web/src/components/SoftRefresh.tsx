import { useIsFetching } from '@tanstack/react-query';

export function SoftRefresh() {
  const fetching = useIsFetching();
  const pending = useIsFetching({ predicate: (query) => query.state.status === 'pending' });
  if (fetching === 0 || pending > 0) return null;
  return <div className="soft-refresh-bar" role="status" aria-label="Đang làm mới dữ liệu" />;
}
