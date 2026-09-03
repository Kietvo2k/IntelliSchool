import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BookOpenCheck, Building2, ClipboardCheck, ClipboardPen, CreditCard, Radar, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
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

function shortcutsFor(role: string) {
  if (role === 'PLATFORM_ADMIN') {
    return [
      { to: '/app/school-requests', label: 'Duyệt mở trường', icon: Building2 },
      { to: '/app/schools', label: 'Danh sách trường', icon: Building2 },
      { to: '/app/admin-users', label: 'Quản lý người dùng', icon: UsersRound },
      { to: '/app/audit-log', label: 'Nhật ký bảo mật', icon: ShieldCheck },
    ];
  }
  if (role === 'SCHOOL_OWNER') {
    return [
      { to: '/app/classes', label: 'Lớp & giáo viên', icon: UsersRound },
      { to: '/app/registrations', label: 'Duyệt đăng ký', icon: UsersRound },
      { to: '/app/billing', label: 'Gói dịch vụ', icon: CreditCard },
      { to: '/app/progress', label: 'Báo cáo tiến độ', icon: BarChart3 },
    ];
  }
  if (role === 'TEACHER') {
    return [
      { to: '/app/lessons', label: 'Soạn bài giảng', icon: BookOpenCheck },
      { to: '/app/assignments', label: 'Giao bài tập', icon: ClipboardCheck },
      { to: '/app/gradebook', label: 'Sổ điểm lớp', icon: BarChart3 },
      { to: '/app/ai-assistant', label: 'Trợ lý soạn bài AI', icon: Sparkles },
    ];
  }
  return [
    { to: '/app/exam', label: 'Phòng thi thử CBT', icon: ClipboardPen },
    { to: '/app/assignments', label: 'Bài tập của em', icon: ClipboardCheck },
    { to: '/app/ai-study', label: 'AI Gia sư học tập', icon: Sparkles },
    { to: '/app/career-quiz', label: 'Khám phá ngành nghề', icon: Radar },
  ];
}

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
  const shortcuts = shortcutsFor(user.role);
  const greeting = user.displayName ? `Xin chào ${user.displayName.split(' ').slice(-2).join(' ')}.` : '';

  return (
    <>
      <PageHeader eyebrow={user.schoolId ? 'Không gian trường học' : 'IntelliSchool pilot'} title={query.data?.title ?? roleTitle[user.role]} lede={`${greeting} Việc hôm nay của bạn nằm dưới đây.`.trim()} />
      
      {/* Quick Action Shortcuts */}
      <nav aria-label="Lối tắt nhanh" className="mb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shortcuts.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-600 hover:text-teal-700 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <Icon size={18} aria-hidden="true" />
              </div>
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

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
              <h2 className="font-display text-2xl font-semibold mb-3">Việc hôm nay</h2>
              <ul className="workspace-list">
                {highlights.map((item, index) => (
                  <ScrollReveal as="li" className={`workspace-list-item highlight-${item.tone}`} key={item.id} index={index}>
                    <div>
                      <strong className="block text-slate-900">{item.title}</strong>
                      <small className="text-slate-500">{item.tone === 'warn' ? 'Cần xử lý sớm' : 'Việc nên làm tiếp'}</small>
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
