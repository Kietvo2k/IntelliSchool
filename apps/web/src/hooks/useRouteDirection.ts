import { useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { getNavDirection } from '../lib/motion.js';

export function useRouteDirection(): { type: 'PUSH' | 'POP' | 'REPLACE'; sign: 1 | -1 } {
  const location = useLocation();
  const navType = useNavigationType();
  const previous = useRef(location.pathname);
  const sign = getNavDirection(previous.current, location.pathname);
  previous.current = location.pathname;
  const type = navType === 'POP' ? 'POP' : navType === 'REPLACE' ? 'REPLACE' : 'PUSH';
  return { type, sign: type === 'POP' ? ((-sign) as 1 | -1) : sign };
}
