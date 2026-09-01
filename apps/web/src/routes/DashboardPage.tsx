import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api.js';
import { useSession } from '../lib/SessionContext.js';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { MetricCard } from '../components/ui/MetricCard.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { ScrollReveal } from '../components/ScrollReveal.js';

interface DashboardMetric { id: string; label: string; value: number; }
interface DashboardHighlight { id: string; title: string; href: string; tone: 'info' | 'warn'; }
interface DashboardData { title?: string; metrics?: DashboardMetric[]; highlights?: DashboardHighlight[]; }

const percentIds = new Set(['completion', 'average-score', 'average', 'lessons']);

const roleTitle: Record<string, string> = {
  PLATFORM_ADMIN: 'Điều hành nền tảng',
  SCHOOL_OWNER: 'Tổng quan trường',
  TEACHER: 'Không gian giảng dạy',
  STUDENT: 'Nhịp học của em',
};

function MetricSkeleton() {
  return (
    <div className="metric-grid" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <article key={index} className="metric-card skeleton-card" style={{ animationDelay: `${index * 40}ms` }}>
          <span className="skeleton-line" />
          <strong className="skeleton-line skeleton-line-lg" />
        </article>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<DashboardData>('/api/v1/dashboard'),
  });

  const metrics = query.data?.metrics ?? [];
  const highlights = query.data?.highlights ?? [];
  const greeting = user.displayName ? `Xin chào ${user.displayName.split(' ').slice(-2).join(' ')}.` : '';

  return (
    <>
      <PageHeader eyebrow={user.schoolId ? 'Không gian trường học' : 'Smart Path pilot'} title={query.data?.title ?? roleTitle[user.role]} lede={`${greeting} Việc hôm nay của bạn nằm dưới đây.`.trim()} />
      {query.isPending && <MetricSkeleton />}
      {query.isError && <ErrorState onRetry={() => void query.refetch()}>Chưa thể tải dashboard.</ErrorState>}
      {query.isSuccess && metrics.length > 0 && (
        <div className="metric-grid">
          {metrics.slice(0, 6).map((metric, index) => (
            <ScrollReveal key={metric.id} index={index}>
              <MetricCard label={metric.label} value={metric.value} unit={percentIds.has(metric.id) ? '%' : ''} />
            </ScrollReveal>
          ))}
        </div>
      )}
      {query.isSuccess && (
        highlights.length === 0
          ? <EmptyState>Chưa có việc cần xử lý.</EmptyState>
          : (
            <section aria-label="Việc hôm nay">
              <h2 className="font-display text-2xl">Việc hôm nay</h2>
              <ul className="workspace-list">
                {highlights.map((item, index) => (
                  <ScrollReveal as="li" className={`workspace-list-item highlight-${item.tone}`} key={item.id} index={index}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.tone === 'warn' ? 'Cần xử lý sớm' : 'Việc nên làm tiếp'}</small>
                    </div>
                    <Link className="ws-btn ws-btn-primary" to={item.href}>Mở</Link>
                  </ScrollReveal>
                ))}
              </ul>
            </section>
          )
      )}
    </>
  );
}
