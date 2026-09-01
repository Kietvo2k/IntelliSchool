import { createContext, useContext } from 'react';
import type { SessionUser } from './session.js';

export interface SessionContextValue {
  user: SessionUser;
  updateUser?: (user: Partial<SessionUser>) => void;
  logout: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used within a SessionContext provider.');
  return context;
}

export function useOptionalSession(): SessionContextValue | null {
  return useContext(SessionContext);
}
