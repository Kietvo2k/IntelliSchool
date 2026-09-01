import { ArrowRight, BookOpenCheck, BotMessageSquare, BriefcaseBusiness, Building2, CheckCircle2, ClipboardCheck, Compass, LockKeyhole, Menu, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { APPLE_EASE, MotionReveal } from '../components/MotionReveal.js';
import { BrandLogo } from '../components/BrandLogo.js';

const rooms = [
  {
    icon: BookOpenCheck,
    title: 'Lớp học',
    tone: 'classroom',
    text: 'Bài giảng, bài tập, sổ điểm theo môn. Giáo viên giao việc; học sinh nộp và xem điểm của mình.',
    preview: (
      <div className="bento-preview preview-classroom" aria-hidden="true">
        <div className="preview-topline">
          <span className="preview-tag">Môn Toán · 12A1</span>
          <span className="preview-status-pill">Đã nộp bài</span>
        </div>
        <div className="preview-assignment">
          <div className="assignment-info">
            <strong>Bài tập: Khảo sát hàm số & Tích phân</strong>
            <small>Hạn nộp: 22:00 hôm nay</small>
          </div>
          <div className="score-badge">9.5<span>/10</span></div>
        </div>
        <div className="preview-bar-group">
          <div className="preview-bar"><span style={{ width: '85%' }} /></div>
          <div className="preview-bar-label"><span>Tiến độ lớp</span><b>28/34 học sinh</b></div>
        </div>
      </div>
    ),
  },
  {
    icon: Compass,
    title: 'Định hướng',
    tone: 'career',
    text: 'Trắc nghiệm RIASEC & Năng lực, tính xác suất đỗ đại học theo điểm học bạ và gợi ý học bổng 2025/2026.',
    preview: (
      <div className="bento-preview preview-career" aria-hidden="true">
        <div className="preview-topline">
          <span className="preview-tag">Gợi ý ngành nghề</span>
          <span className="match-pill">88% Phù hợp</span>
        </div>
        <div className="career-recommendation">
          <strong>Khoa học Máy tính / AI</strong>
          <span>ĐH Bách Khoa TP.HCM</span>
        </div>
        <div className="career-traits">
          <span className="trait-chip">Tổ hợp A00, A01</span>
          <span className="trait-chip">Điểm chuẩn: 26.8</span>
          <span className="trait-chip highlight">Xác suất: An toàn</span>
        </div>
      </div>
    ),
  },
  {
    icon: ShieldCheck,
    title: 'Quản trị',
    tone: 'admin',
    text: 'Hiệu trưởng giữ quyền duyệt thành viên. Phân vùng dữ liệu an toàn, ghi nhật ký bảo mật minh bạch.',
    preview: (
      <div className="bento-preview preview-admin" aria-hidden="true">
        <div className="preview-topline">
          <span className="preview-tag">Kiểm toán trường học</span>
          <span className="school-badge-code">SP-NDU12A</span>
        </div>
        <div className="audit-item">
          <div className="audit-avatar">HT</div>
          <div className="audit-text">
            <strong>Duyệt hồ sơ giáo viên & lớp học</strong>
            <small>Hiệu trưởng duyệt · 08:30</small>
          </div>
          <span className="verified-badge">✓ Đã duyệt</span>
        </div>
        <div className="preview-lock-banner">
          <LockKeyhole size={13} />
          <span>Cô lập dữ liệu RLS theo từng trường</span>
        </div>
      </div>
    ),
  },
] as const;

const openSteps = [
  { n: '01', title: 'Gửi yêu cầu', text: 'Hiệu trưởng điền tên trường, họ tên, email công việc và tỉnh thành.' },
  { n: '02', title: 'Admin duyệt', text: 'Đội ngũ nền tảng xác thực thông tin trường và phê duyệt.' },
  { n: '03', title: 'Nhận thư kích hoạt', text: 'Email riêng gửi hiệu trưởng. Trường cấp tài khoản cho thầy cô và học sinh.' },
];

const navLinks = [
  { href: '#platform', label: 'Việc trong trường' },
  { href: '#security', label: 'Riêng từng trường' },
  { to: '/auth/school-request', label: 'Mở trường' },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
  return (
    <>
      {navLinks.map((item) => (
        'to' in item
          ? <Link key={item.label} to={item.to} onClick={onNavigate}>{item.label}</Link>
          : <a key={item.label} href={item.href} onClick={onNavigate}>{item.label}</a>
      ))}
    </>
  );
}

function SchoolWindow({ reduceMotion }: { reduceMotion: boolean | null }) {
  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 480], [0, 20]);

  return (
    <motion.div className="hero-panel-shift" style={reduceMotion ? undefined : { y: parallaxY }}>
      <div className="hero-ambient-glow" aria-hidden="true" />
      <motion.div
        className="hero-panel hero-panel-3d"
        aria-label="Cửa sổ lớp 12A1 trường Nguyễn Du"
        initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.24, delay: 0.08, ease: APPLE_EASE }}
      >
        <div className="panel-chrome">
          <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>THPT Nguyễn Du (TP.HCM) · Không gian số</span>
          <span className="live-dot">Đang hoạt động</span>
        </div>

        <div className="progress-card">
          <div className="progress-card-header">
            <div>
              <span className="panel-kicker">Lớp 12A1 · Môn Toán</span>
              <strong>Ôn tập hàm số & tích phân</strong>
            </div>
            <div className="floating-metric-chip">
              <Sparkles size={14} />
              <span>Điểm TB: <b>8.6</b></span>
            </div>
          </div>
          <div className="progress-track" aria-hidden="true">
            <motion.span
              className="progress-fill"
              initial={reduceMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: 0.82 }}
              transition={{ duration: 0.3, delay: 0.12, ease: APPLE_EASE }}
            />
          </div>
          <div className="progress-card-footer">
            <small>28/34 học sinh đã hoàn thành bài</small>
            <small className="progress-percent">82%</small>
          </div>
        </div>

        {/* Live AI Assistant Interactive Mockup Box */}
        <div className="ai-snippet-box">
          <div className="ai-snippet-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <BotMessageSquare size={15} /> AI học tập · Giải đáp môn Toán
            </span>
            <span className="showcase-stat-badge">
              <Sparkles size={12} /> Trích dẫn bài giảng
            </span>
          </div>
          <p className="ai-snippet-body">
            “Đạo hàm f'(x₀) thể hiện hệ số góc của tiếp tuyến đồ thị hàm số tại điểm M(x₀, f(x₀))…”
          </p>
          <div className="ai-citation-chip">
            <BookOpenCheck size={12} /> Bài 1: Khảo sát hàm số (Sách giáo khoa 12)
          </div>
        </div>

        <div className="panel-grid">
          {[
            { icon: UsersRound, value: '12', label: 'Lớp học', sub: 'Đang hoạt động' },
            { icon: ClipboardCheck, value: '98%', label: 'Bài nộp đúng hạn', sub: 'Tuần này' },
            { icon: BriefcaseBusiness, value: '04', label: 'Hồ sơ hướng nghiệp', sub: 'Gợi ý mới' },
          ].map((tile, index) => {
            const Icon = tile.icon;
            return (
              <motion.div
                key={tile.label}
                className="panel-stat-tile"
                initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, delay: 0.08 + index * 0.04, ease: APPLE_EASE }}
              >
                <div className="tile-icon-wrap"><Icon size={20} aria-hidden="true" /></div>
                <b>{tile.value}</b>
                <span>{tile.label}</span>
                <small>{tile.sub}</small>
              </motion.div>
            );
          })}
        </div>
        <p className="panel-note"><LockKeyhole size={15} aria-hidden="true" /> Dữ liệu lớp này chỉ lưu hành nội bộ trường THPT Nguyễn Du.</p>
      </motion.div>
    </motion.div>
  );
}

export function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (location.hash === '#request') navigate('/auth/school-request', { replace: true });
  }, [location.hash, navigate]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Đi tới nội dung chính</a>
      <header className="topbar-wrap">
        <div className="topbar">
          <Link className="brand" to="/" aria-label="Smart Path Platform trang chủ">
            <BrandLogo size="sm" subtitle="Nền tảng trường số" />
          </Link>
          <nav className="topbar-nav" aria-label="Điều hướng chính">
            <NavLinks />
          </nav>
          <div className={`topbar-menu${menuOpen ? ' is-open' : ''}`}>
            <button className="topbar-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="mobile-site-navigation" onClick={() => setMenuOpen((current) => !current)}>
              <Menu size={20} aria-hidden="true" />
              Mục lục
            </button>
            {menuOpen && <nav id="mobile-site-navigation" aria-label="Mục lục trang"><NavLinks onNavigate={() => setMenuOpen(false)} /></nav>}
          </div>
          <div className="topbar-actions">
            <Link className="button button-login" to="/auth/login">Đăng nhập</Link>
            <Link className="button button-primary" to="/auth/school-request">Gửi yêu cầu <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </header>
      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <MotionReveal tone="landing" index={0}>
              <p className="eyebrow">Nền tảng trường số · THPT</p>
            </MotionReveal>
            <MotionReveal tone="landing" index={1} variant="clip-up">
              <h1 id="hero-title">Dạy, học và hướng nghiệp trong <em>chỗ của trường.</em></h1>
            </MotionReveal>
            <MotionReveal tone="landing" index={2}>
              <p className="hero-lede">Hiệu trưởng gửi yêu cầu. Thầy cô soạn bài, giao bài, mở ca thi thử. Học sinh làm quiz và xem gợi ý ngành. Dữ liệu trường này không sang trường kia.</p>
            </MotionReveal>
            <MotionReveal tone="landing" index={3}>
              <div className="hero-actions">
                <Link className="button button-primary" to="/auth/school-request">Gửi yêu cầu mở trường <ArrowRight size={18} aria-hidden="true" /></Link>
                <Link className="text-link" to="/auth/login">Đăng nhập tài khoản</Link>
              </div>
              <ul className="trust-list" aria-label="Hai trường đang chạy thử">
                <li><CheckCircle2 size={17} aria-hidden="true" /> THPT Nguyễn Du, TP. Hồ Chí Minh</li>
                <li><CheckCircle2 size={17} aria-hidden="true" /> THPT Lê Quý Đôn, TP. Hồ Chí Minh</li>
              </ul>
            </MotionReveal>
          </div>
          <SchoolWindow reduceMotion={reduceMotion} />
        </section>

        <section className="platform-section" id="platform" aria-labelledby="platform-title">
          <MotionReveal tone="landing" when="view">
            <div className="section-heading">
              <p className="eyebrow">Ba việc trong cùng một trường</p>
              <h2 id="platform-title">Lớp học buổi sáng. Hướng nghiệp khi cần. Quản trị suốt ngày.</h2>
            </div>
          </MotionReveal>
          <div className="path-grid">
            {rooms.map(({ icon: Icon, title, text, tone, preview }, index) => (
              <MotionReveal key={title} tone="landing" when="view" index={index}>
                <article className={`path-card is-${tone}`}>
                  <div className="path-card-header">
                    <div className="path-icon-badge"><Icon size={26} aria-hidden="true" /></div>
                    <h3>{title}</h3>
                  </div>
                  <p>{text}</p>
                  {preview}
                </article>
              </MotionReveal>
            ))}
          </div>
        </section>

        <section className="security-section" id="security" aria-labelledby="security-title">
          <MotionReveal tone="landing" when="view">
            <div className="section-heading">
              <p className="eyebrow">Ranh giới giữa các trường</p>
              <h2 id="security-title">Học sinh Nguyễn Du không thấy dữ liệu Lê Quý Đôn.</h2>
            </div>
          </MotionReveal>
          <MotionReveal tone="landing" when="view" index={1} variant="scale-in">
            <div className="school-pair-container">
              <div className="school-pair" aria-hidden="true">
                <article className="mini-school">
                  <div className="mini-school-chrome">
                    <span className="window-dots"><i /><i /><i /></span>
                    <span className="mini-status-pill">Khu vực riêng</span>
                  </div>
                  <strong>THPT Nguyễn Du</strong>
                  <span>TP. Hồ Chí Minh · lớp 12A1</span>
                  <div className="mini-school-meta">
                    <span>Mã: <code>SP-NDU</code></span>
                    <span>34 học sinh</span>
                  </div>
                </article>
                <div className="school-isolation-barrier">
                  <div className="barrier-shield">
                    <LockKeyhole size={18} />
                  </div>
                  <p className="school-pair-gap">Không thấy nhau</p>
                  <div className="barrier-line" />
                </div>
                <article className="mini-school">
                  <div className="mini-school-chrome">
                    <span className="window-dots"><i /><i /><i /></span>
                    <span className="mini-status-pill">Khu vực riêng</span>
                  </div>
                  <strong>THPT Lê Quý Đôn</strong>
                  <span>TP. Hồ Chí Minh · lớp 12B2</span>
                  <div className="mini-school-meta">
                    <span>Mã: <code>SP-LQD</code></span>
                    <span>36 học sinh</span>
                  </div>
                </article>
              </div>
            </div>
          </MotionReveal>
          <MotionReveal tone="landing" when="view" index={2}>
            <div className="security-points">
              <p><Building2 aria-hidden="true" size={22} /><span><b>Một trường, một khu</b>Lớp, điểm, hồ sơ hướng nghiệp nằm trong trường đó.</span></p>
              <p><ShieldCheck aria-hidden="true" size={22} /><span><b>Hiệu trưởng giữ cửa</b>Giáo viên và học sinh vào sau khi được duyệt. Không tự đăng ký rồi vào lớp.</span></p>
              <p><LockKeyhole aria-hidden="true" size={22} /><span><b>Có nhật ký bảo mật</b>Ghi ai duyệt tài khoản, ai mở lớp, lúc nào.</span></p>
            </div>
          </MotionReveal>
        </section>

        <section className="request-section" aria-labelledby="open-school-title">
          <div className="request-intro">
            <MotionReveal tone="landing" when="view">
              <p className="eyebrow">Mở trường trên Smart Path</p>
              <h2 id="open-school-title">Ba bước. Form một lần. Email kích hoạt gửi hiệu trưởng.</h2>
              <ol className="open-steps">
                {openSteps.map((step) => (
                  <li key={step.n}>
                    <span>{step.n}</span>
                    <div>
                      <b>{step.title}</b>
                      <p>{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </MotionReveal>
          </div>
          <MotionReveal tone="landing" when="view" index={1} variant="scale-in">
            <div className="request-cta">
              <p>Form nằm trên trang riêng. Hiệu trưởng điền xong, admin nền tảng duyệt rồi gửi email kích hoạt.</p>
              <Link className="button button-primary" to="/auth/school-request">Đi tới form mở trường <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link className="text-link request-login" to="/auth/login">Đã có tài khoản? Đăng nhập</Link>
            </div>
          </MotionReveal>
        </section>
      </main>
      <footer>
        <p>Smart Path Platform · THPT Nguyễn Du và THPT Lê Quý Đôn đang dùng bản thử.</p>
        <p className="footer-links">
          <Link to="/auth/login">Đăng nhập</Link>
          <Link to="/auth/school-request">Mở trường</Link>
        </p>
      </footer>
    </div>
  );
}
