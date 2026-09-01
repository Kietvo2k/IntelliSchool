import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_KEY = 'smartpath-scroll';

function readMap(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, number> : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, number>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

/** Pathname-keyed scroll restore for BrowserRouter (RR ScrollRestoration needs a data router). */
export function PathScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef<Record<string, number>>(readMap());
  const prevPath = useRef(location.pathname);
  const firstMount = useRef(true);

  useLayoutEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      prevPath.current = location.pathname;
      return;
    }

    const previous = prevPath.current;
    if (previous !== location.pathname) {
      positions.current[previous] = window.scrollY;
      writeMap(positions.current);
    }

    if (navType === 'POP') {
      window.scrollTo({ top: positions.current[location.pathname] ?? 0, left: 0, behavior: 'auto' });
    }

    prevPath.current = location.pathname;
  }, [location.pathname, navType]);

  return null;
}
