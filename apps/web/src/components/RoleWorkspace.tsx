import { BarChart3, BookOpenCheck, BriefcaseBusiness, Building2, ClipboardCheck, GraduationCap, LogOut, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';

export type WorkspaceRole = 'PLATFORM_ADMIN' | 'SCHOOL_OWNER' | 'TEACHER' | 'STUDENT';

export interface SessionUser {
  userId: string;
  role: WorkspaceRole;
  schoolId?: string;
  email: string;
  displayName: string;
}

interface DashboardMetric { id: string; label: string; value: number; }
interface DashboardData { title?: string; metrics?: DashboardMetric[]; }

const roleNavigation: Record<WorkspaceRole, Array<{ label: string; icon: typeof BookOpenCheck }>> = {
  PLATFORM_ADMIN: [{ label: 'Duyệt trường', icon: Building2 }, { label: 'Audit & bảo mật', icon: ShieldCheck }, { label: 'Dữ liệu catalog', icon: BarChart3 }],
  SCHOOL_OWNER: [{ label: 'Tổng quan trường', icon: Building2 }, { label: 'Giáo viên & lớp', icon: UsersRound }, { label: 'Báo cáo trường', icon: BarChart3 }],
  TEACHER: [{ label: 'Bài giảng', icon: BookOpenCheck }, { label: 'Bài tập', icon: ClipboardCheck }, { label: 'Học sinh cần quan tâm', icon: UsersRound }],
  STUDENT: [{ label: 'Bài học', icon: BookOpenCheck }, { label: 'Bài tập', icon: ClipboardCheck }, { label: 'Hướng nghiệp', icon: BriefcaseBusiness }],
};

const featureCopy: Record<WorkspaceRole, Array<{ kicker: string; title: string; text: string; icon: typeof BookOpenCheck }>> = {
  PLATFORM_ADMIN: [
    { kicker: 'Điều hành', title: 'Duyệt trường có kiểm soát', text: 'Mỗi trường chỉ được kích hoạt sau khi admin xác nhận, có audit cho mọi thay đổi.', icon: ShieldCheck },
    { kicker: 'Pilot', title: 'Theo dõi hai trường thử nghiệm', text: 'Xem trạng thái tenant, quota lớp, trial và các cảnh báo vận hành.', icon: Building2 },
  ],
  SCHOOL_OWNER: [
    { kicker: 'Nhà trường', title: 'Vận hành theo từng lớp', text: 'Phân công chủ nhiệm và bộ môn, theo dõi tiến độ mà không trộn dữ liệu giữa trường.', icon: Building2 },
    { kicker: 'Báo cáo', title: 'Nhìn đủ, không vượt quyền', text: 'Tổng hợp điểm, tiến độ và tín hiệu cần hỗ trợ để hiệu trưởng có thể điều phối.', icon: BarChart3 },
  ],
  TEACHER: [
    { kicker: 'Lớp học', title: 'Bài giảng và đánh giá', text: 'Soạn bài, ngân hàng câu hỏi, trắc nghiệm, đúng-sai, trả lời ngắn và tự luận có quy trình chấm rõ ràng.', icon: ClipboardCheck },
    { kicker: 'Trợ lý định hướng', title: 'Tín hiệu có bằng chứng', text: 'AI gợi ý học sinh cần hỗ trợ và lộ trình học; giáo viên vẫn là người đưa ra quyết định cuối cùng.', icon: Sparkles },
  ],
  STUDENT: [
    { kicker: 'Học tập', title: 'Lộ trình adaptive minh bạch', text: 'Xem bài học, bài tập, lịch ôn và lý do gợi ý dựa trên bằng chứng học tập đã được duyệt.', icon: GraduationCap },
    { kicker: 'Tương lai', title: 'Khám phá hướng nghiệp', text: 'RIASEC, năng lực, ngành, trường, học bổng và nguyện vọng được kết nối với kết quả học tập.', icon: BriefcaseBusiness },
  ],
};

function apiUrl(path: string): string {
  return `${import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3002'}${path}`;
}

export function RoleWorkspace({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  async function loadDashboard() {
    setState('loading');
    try {
      const response = await fetch(apiUrl('/api/v1/dashboard'), { credentials: 'include' });
      if (!response.ok) throw new Error('Không thể tải dữ liệu workspace.');
      const payload = await response.json() as { data?: DashboardData };
      setDashboard(payload.data ?? {});
      setState('ready');
    } catch {
      setState('error');
    }
  }

  useEffect(() => { void loadDashboard(); }, []);

  const metrics = dashboard?.metrics ?? [];
  return (
    <main className="workspace-shell" id="main-content">
      <header className="workspace-topbar">
        <a className="brand" href="#workspace" aria-label="Smart Path Platform workspace">
          <span className="brand-mark"><GraduationCap aria-hidden="true" size={22} /></span><span>Smart Path Platform</span>
        </a>
        <div className="workspace-account"><span><b>{user.displayName}</b><small>{user.role.replaceAll('_', ' ')}</small></span><button className="icon-button" type="button" onClick={onLogout} aria-label="Đăng xuất"><LogOut size={18} aria-hidden="true" /></button></div>
      </header>
      <div className="workspace-layout" id="workspace">
        <aside className="workspace-nav" aria-label="Điều hướng workspace">
          <p className="workspace-school">{user.schoolId ? 'Không gian trường học' : 'Nền tảng quản trị'}</p>
          {roleNavigation[user.role].map(({ label, icon: Icon }, index) => <button className={index === 0 ? 'nav-item is-active' : 'nav-item'} key={label} type="button"><Icon size={18} aria-hidden="true" />{label}</button>)}
        </aside>
        <section className="workspace-main" aria-live="polite">
          <p className="eyebrow">{user.role === 'TEACHER' ? 'Lớp học được phân công' : user.role === 'STUDENT' ? 'Không gian học tập cá nhân' : 'Smart Path pilot'}</p>
          <h1>{dashboard?.title ?? (user.role === 'TEACHER' ? 'Không gian giảng dạy' : user.role === 'STUDENT' ? 'Nhịp học của em' : user.role === 'SCHOOL_OWNER' ? 'Tổng quan trường' : 'Điều hành nền tảng')}</h1>
          {state === 'loading' && <div className="workspace-state" aria-busy="true">Đang tải dữ liệu riêng của bạn…</div>}
          {state === 'error' && <div className="workspace-state is-error" role="alert">Chưa thể tải dashboard. <button type="button" onClick={() => void loadDashboard()}>Thử lại</button></div>}
          {state === 'ready' && <div className="metric-grid">{metrics.map((metric) => <article className="metric-card" key={metric.id}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</div>}
          <div className="workspace-feature-grid">
            {featureCopy[user.role].map(({ kicker, title, text, icon: Icon }) => <article className="workspace-feature" key={title}><Icon size={23} aria-hidden="true" /><p>{kicker}</p><h2>{title}</h2><span>{text}</span></article>)}
          </div>
        </section>
      </div>
    </main>
  );
}
