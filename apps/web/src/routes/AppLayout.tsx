import { BarChart3, Book, BookOpenCheck, BotMessageSquare, BriefcaseBusiness, Building2, ChevronDown, ClipboardCheck, ClipboardPen, CreditCard, FolderUp, GraduationCap, LibraryBig, LogOut, PanelLeftClose, PanelLeftOpen, Radar, School, Sparkles, UsersRound, Waypoints } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../lib/SessionContext.js';
import type { WorkspaceRole } from '../lib/session.js';
import { BrandLogo } from '../components/BrandLogo.js';
import { PageTransition } from '../components/PageTransition.js';
import { SoftRefresh } from '../components/SoftRefresh.js';

interface NavItem { to: string; label: string; icon: typeof BookOpenCheck; end?: boolean }
interface NavGroup { id: string; label: string; collapsible?: boolean; items: NavItem[] }

const lmsItems: NavItem[] = [
  { to: '/app/lessons', label: 'Bài giảng', icon: BookOpenCheck },
  { to: '/app/digital-library', label: 'Thư viện số', icon: FolderUp },
  { to: '/app/question-banks', label: 'Ngân hàng câu hỏi', icon: BookOpenCheck },
  { to: '/app/assignments', label: 'Bài tập', icon: ClipboardCheck },
  { to: '/app/gradebook', label: 'Sổ điểm', icon: BarChart3 },
  { to: '/app/grading', label: 'Chấm tự luận', icon: ClipboardCheck },
  { to: '/app/progress', label: 'Báo cáo tiến độ', icon: BarChart3 },
];

const adaptiveItems: NavItem[] = [
  { to: '/app/skill-graphs', label: 'Đồ thị kỹ năng', icon: Waypoints },
  { to: '/app/adaptive', label: 'Lớp theo nhu cầu', icon: Waypoints },
];

const teacherAiItems: NavItem[] = [
  { to: '/app/ai-settings', label: 'Cấu hình AI', icon: Sparkles },
  { to: '/app/ai-assistant', label: 'Soạn bài AI', icon: BotMessageSquare },
  { to: '/app/ai-knowledge', label: 'Kho tri thức AI', icon: LibraryBig },
];

function navigationFor(role: WorkspaceRole, homeroomClassIds: string[]): NavGroup[] {
  if (role === 'PLATFORM_ADMIN') {
    return [
      { id: 'home', label: 'Tổng quan', items: [{ to: '/app', label: 'Tổng quan', icon: BarChart3, end: true }] },
      {
        id: 'ops', label: 'Vận hành', items: [
          { to: '/app/school-requests', label: 'Duyệt trường', icon: Building2 },
          { to: '/app/schools', label: 'Trường học', icon: Building2 },
          { to: '/app/admin-users', label: 'Người dùng', icon: UsersRound },
          { to: '/app/admin-billing', label: 'Gói dịch vụ', icon: CreditCard },
          { to: '/app/audit-log', label: 'Nhật ký bảo mật', icon: ClipboardCheck },
          { to: '/app/careers', label: 'Danh mục hướng nghiệp', icon: BriefcaseBusiness },
        ],
      },
      { id: 'account', label: 'Tài khoản', items: [{ to: '/app/profile', label: 'Hồ sơ & bảo mật', icon: Book }] },
    ];
  }

  if (role === 'SCHOOL_OWNER') {
    return [
      { id: 'home', label: 'Tổng quan', items: [{ to: '/app', label: 'Tổng quan', icon: Building2, end: true }] },
      {
        id: 'school', label: 'Trường', items: [
          { to: '/app/classes', label: 'Lớp & giáo viên', icon: UsersRound },
          { to: '/app/registrations', label: 'Duyệt đăng ký', icon: UsersRound },
          { to: '/app/billing', label: 'Gói dịch vụ', icon: CreditCard },
        ],
      },
      { id: 'class', label: 'Giảng dạy', items: lmsItems },
      { id: 'adaptive', label: 'Học tập thích ứng', items: [...adaptiveItems, { to: '/app/skill-drafts', label: 'Skill nháp', icon: Waypoints }] },
      { id: 'ai', label: 'Soạn bài AI', items: teacherAiItems },
      { id: 'career', label: 'Hướng nghiệp', items: [{ to: '/app/careers', label: 'Danh mục nghề', icon: BriefcaseBusiness }] },
      { id: 'exam-ops', label: 'Thi thử', items: [{ to: '/app/proctor', label: 'Giám thị thi thử', icon: ClipboardPen }] },
      { id: 'account', label: 'Tài khoản', items: [{ to: '/app/profile', label: 'Hồ sơ', icon: Book }] },
    ];
  }

  if (role === 'TEACHER') {
    const groups: NavGroup[] = [
      { id: 'home', label: 'Tổng quan', items: [{ to: '/app', label: 'Tổng quan', icon: BookOpenCheck, end: true }] },
      {
        id: 'class',
        label: 'Giảng dạy',
        items: [
          { to: '/app/classes', label: 'Lớp', icon: UsersRound },
          { to: '/app/lessons', label: 'Bài giảng', icon: BookOpenCheck },
          { to: '/app/digital-library', label: 'Thư viện số', icon: FolderUp },
          { to: '/app/question-banks', label: 'Ngân hàng câu hỏi', icon: BookOpenCheck },
          { to: '/app/assignments', label: 'Bài tập', icon: ClipboardCheck },
          { to: '/app/proctor', label: 'Thi', icon: ClipboardPen },
          { to: '/app/gradebook', label: 'Sổ điểm', icon: BarChart3 },
          { to: '/app/grading', label: 'Chấm tự luận', icon: ClipboardCheck },
          { to: '/app/progress', label: 'Báo cáo tiến độ', icon: BarChart3 },
          { to: '/app/messages', label: 'Tin nhắn', icon: BotMessageSquare },
          { to: '/app/ai-assistant', label: 'Soạn bài AI', icon: Sparkles },
        ],
      },
    ];
    groups.push({
      id: 'adaptive', label: 'Học tập thích ứng', items: [...adaptiveItems, { to: '/app/skill-drafts', label: 'Skill nháp', icon: Waypoints }],
    });
    if (homeroomClassIds.length > 0) {
      groups.push({
        id: 'homeroom',
        label: 'Lớp chủ nhiệm',
        items: [{ to: '/app/homeroom', label: 'Học sinh chủ nhiệm', icon: UsersRound }],
      });
    }
    groups.push({ id: 'account', label: 'Tài khoản', items: [{ to: '/app/profile', label: 'Hồ sơ', icon: Book }] });
    return groups;
  }

  return [
    { id: 'home', label: 'Tổng quan', items: [{ to: '/app', label: 'Tổng quan', icon: GraduationCap, end: true }] },
    {
      id: 'learn', label: 'Học', items: [
        { to: '/app/lessons', label: 'Bài giảng', icon: BookOpenCheck },
        { to: '/app/digital-library', label: 'Thư viện số', icon: FolderUp },
        { to: '/app/assignments', label: 'Bài tập', icon: ClipboardCheck },
        { to: '/app/exam', label: 'Phòng thi', icon: ClipboardPen },
        { to: '/app/grades', label: 'Điểm của em', icon: BarChart3 },
        { to: '/app/my-path', label: 'Lộ trình của em', icon: Waypoints },
        { to: '/app/messages', label: 'Tin nhắn', icon: BotMessageSquare },
        { to: '/app/ai-study', label: 'AI học tập', icon: Sparkles },
      ],
    },
    {
      id: 'career', label: 'Hướng nghiệp', items: [
        { to: '/app/career-dashboard', label: 'Bảng hướng nghiệp', icon: BriefcaseBusiness },
        { to: '/app/career-quiz', label: 'Khám phá', icon: Radar },
        { to: '/app/career-results', label: 'Kết quả', icon: Radar },
        { to: '/app/career-schools', label: 'Trường gợi ý', icon: School },
        { to: '/app/aspirations', label: 'Nguyện vọng', icon: BriefcaseBusiness },
        { to: '/app/career-ai', label: 'Phân tích AI', icon: Sparkles },
        { to: '/app/career-guide', label: 'Hướng dẫn', icon: BookOpenCheck },
      ],
    },
    { id: 'account', label: 'Tài khoản', items: [{ to: '/app/profile', label: 'Hồ sơ', icon: Book }] },
  ];
}

function Group({ group, onNavigate }: { group: NavGroup; onNavigate?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <p className="workspace-school">
        <button
          type="button"
          className="workspace-school-btn"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          <span>{group.label}</span>
          <ChevronDown size={14} aria-hidden="true" className={open ? 'rotate-180 transition-transform duration-200' : 'transition-transform duration-200'} />
        </button>
      </p>
      <div className={`nav-group-accordion ${open ? 'is-open' : 'is-collapsed'}`}>
        <div className="nav-group-inner">
          {group.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onNavigate} className={({ isActive }) => (isActive ? 'nav-item is-active' : 'nav-item')} title={label}>
              <Icon size={18} aria-hidden="true" className="nav-item-icon" />
              <span className="nav-item-text">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const { user, logout } = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const mobileNavToggleRef = useRef<HTMLButtonElement>(null);
  const groups = navigationFor(user.role, user.homeroomClassIds ?? []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
      if (event.key !== 'Tab' || !mobileNavRef.current) return;
      const focusable = Array.from(mobileNavRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.classList.add('workspace-navigation-open');
    document.addEventListener('keydown', onKeyDown);
    const firstFocusable = mobileNavRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])');
    const mobileNavToggle = mobileNavToggleRef.current;
    firstFocusable?.focus();
    return () => {
      document.body.classList.remove('workspace-navigation-open');
      document.removeEventListener('keydown', onKeyDown);
      mobileNavToggle?.focus();
    };
  }, [mobileNavOpen]);

  return (
    <main className={`workspace-shell${mobileNavOpen ? ' is-mobile-nav-open' : ''}`}>
      <a className="skip-link" href="#main-content">Đi tới nội dung chính</a>
      <header className={`workspace-topbar${scrolled ? ' is-scrolled' : ''}`}>
        <SoftRefresh />
        <div className="workspace-topbar-left">
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="mobile-nav-toggle"
            ref={mobileNavToggleRef}
            onClick={() => setMobileNavOpen(true)}
            aria-label="Mở điều hướng"
            aria-expanded={mobileNavOpen}
            aria-controls="workspace-navigation"
          >
            <PanelLeftOpen size={18} aria-hidden="true" />
          </button>
          <a className="brand" href="#workspace" aria-label="Smart Path Platform workspace">
            <BrandLogo size="sm" subtitle={user.schoolId ? 'Không gian trường học' : 'Nền tảng quản trị'} />
          </a>
        </div>
        <div className="workspace-account">
          <span><b>{user.displayName}</b><small>{user.schoolId ? 'Trường học thành viên' : 'Quản trị viên'}</small></span>
          <button className="icon-button" type="button" onClick={logout} aria-label="Đăng xuất"><LogOut size={18} aria-hidden="true" /></button>
        </div>
      </header>
      <div className={`workspace-layout ${sidebarCollapsed ? 'is-collapsed' : ''}`} id="workspace">
        {mobileNavOpen && <button className="workspace-nav-scrim" type="button" aria-label="Đóng điều hướng" onClick={() => setMobileNavOpen(false)} />}
        <aside ref={mobileNavRef} id="workspace-navigation" className="workspace-nav" aria-label="Điều hướng workspace" tabIndex={-1}>
          <div className="workspace-nav-mobile-header">
            <strong>Điều hướng</strong>
            <button className="icon-button" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Đóng điều hướng"><PanelLeftClose size={18} aria-hidden="true" /></button>
          </div>
          {groups.map((group) => <Group key={group.id} group={group} onNavigate={() => setMobileNavOpen(false)} />)}
        </aside>
        <section className="workspace-main" id="main-content" tabIndex={-1} aria-live="polite">
          {children ?? <PageTransition />}
        </section>
      </div>
    </main>
  );
}
