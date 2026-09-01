import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useRequestTracker } from '../lib/requestTracker.js';

export function GlobalLoadingIndicator() {
  const tracker = useRequestTracker();
  const queryFetching = useIsFetching();
  const queryMutating = useIsMutating();

  const isPending = tracker.isPending || queryFetching > 0 || queryMutating > 0;
  const isSlow = tracker.isSlow;
  const isVerySlow = tracker.isVerySlow;

  return (
    <>
      {isPending && (
        <div className="top-loading-bar-container" aria-hidden="true">
          <div className="top-loading-bar" />
        </div>
      )}

      {isSlow && (
        <div
          className={`slow-request-toast ${isVerySlow ? 'is-warning' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="slow-request-spinner" aria-hidden="true" />
          <span>
            {isVerySlow
              ? 'Tác vụ đang mất nhiều thời gian hơn thông thường do khối lượng dữ liệu. Vui lòng đợi…'
              : 'Hệ thống đang xử lý, vui lòng đợi trong giây lát…'}
          </span>
        </div>
      )}
    </>
  );
}
