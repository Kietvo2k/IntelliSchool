import { useEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouteDirection } from '../hooks/useRouteDirection.js';
import { DURATION, EASE_OUT, routeVariants } from '../lib/motion.js';

export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();
  const { type, sign } = useRouteDirection();
  const firstMount = useRef(true);
  const fadeOnly = location.pathname.startsWith('/app/exam');

  useEffect(() => {
    firstMount.current = false;
    if (type === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: reduce ? 'auto' : 'instant' });
  }, [location.pathname, type, reduce]);

  const variants = firstMount.current
    ? reduce
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
          exit: { opacity: 0, transition: { duration: DURATION.exit } },
        }
    : routeVariants(sign, reduce, fadeOnly);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={location.pathname}
        className="page-transition"
        layout={false}
        initial={'initial' in variants ? variants.initial : false}
        animate={'animate' in variants ? variants.animate : { opacity: 1 }}
        exit={'exit' in variants ? variants.exit : undefined}
        style={{ willChange: 'opacity, transform' }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}
