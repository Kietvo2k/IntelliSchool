import { lazy, Suspense, type ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { apiUrl, ensureApiBase } from './lib/api.js';
import { SessionContext } from './lib/SessionContext.js';
import type { SessionUser } from './lib/session.js';
import { GlobalLoadingIndicator } from './components/GlobalLoadingIndicator.js';
import { APPLE_EASE, DURATION } from './lib/motion.js';
import { AuthPage } from './routes/AuthPage.js';
import { LandingPage } from './routes/LandingPage.js';
import { NotFoundPage } from './routes/NotFoundPage.js';
import { SchoolRequestPage } from './routes/SchoolRequestPage.js';
import { UnauthorizedGuardPage } from './routes/UnauthorizedGuardPage.js';
import './styles.css';
import './app.css';

const WorkspaceRoutes = lazy(async () => ({ default: (await import('./routes/WorkspaceRoutes.js')).WorkspaceRoutes }));

function WorkspaceFallback() {
  return (
    <div className="workspace-skeleton" role="status">
      <div className="skeleton-spinner" aria-hidden="true" />
      <span>Đang mở không gian làm việc…</span>
    </div>
  );
}

function PublicEnter({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: APPLE_EASE }}
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  );
}

const knownPublicPaths = new Set([
  '/',
  '/auth/school-request',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/activate',
  '/auth/reset-password',
]);

export function App() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [session, setSession] = useState<'loading' | 'ready'>('loading');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void ensureApiBase()
      .then(() => fetch(apiUrl('/api/v1/auth/session'), { credentials: 'include' }))
      .then(async (response) => response.ok ? response.json() as Promise<{ data?: { user?: SessionUser } }> : null)
      .then((payload) => { if (payload?.data?.user) setSessionUser(payload.data.user); })
      .catch(() => undefined)
      .finally(() => setSession('ready'));
  }, []);

  async function logout() {
    await ensureApiBase();
    await fetch(apiUrl('/api/v1/auth/logout'), { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setSessionUser(null);
    navigate('/', { replace: true });
  }

  function onAuthenticated(user: SessionUser) {
    setSessionUser(user);
    setSession('ready');
    navigate('/app', { replace: true });
  }

  return (
    <>
      <GlobalLoadingIndicator />
      {sessionUser ? (
        <SessionContext.Provider value={{ user: sessionUser, updateUser: (patch) => setSessionUser((current) => current ? { ...current, ...patch } : current), logout: () => void logout() }}>
          <Suspense fallback={<WorkspaceFallback />}>
            <WorkspaceRoutes />
          </Suspense>
        </SessionContext.Provider>
      ) : session === 'loading' && (location.pathname.startsWith('/app') || location.pathname.startsWith('/auth/')) ? (
        <WorkspaceFallback />
      ) : location.pathname.startsWith('/app') ? (
        <PublicEnter><UnauthorizedGuardPage targetPath={location.pathname} /></PublicEnter>
      ) : location.pathname === '/' ? (
        <PublicEnter><LandingPage /></PublicEnter>
      ) : location.pathname === '/auth/school-request' ? (
        <PublicEnter><SchoolRequestPage /></PublicEnter>
      ) : location.pathname.startsWith('/auth/') && knownPublicPaths.has(location.pathname) ? (
        <PublicEnter><AuthPage onAuthenticated={onAuthenticated} /></PublicEnter>
      ) : (
        <PublicEnter><NotFoundPage /></PublicEnter>
      )}
    </>
  );
}
