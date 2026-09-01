import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { APPLE_EASE, DURATION, VIEWPORT_ONCE } from '../lib/motion.js';

export { APPLE_EASE };

export type MotionRevealVariant = 'fade-up' | 'clip-up' | 'scale-in' | 'fade' | 'slide-x' | 'pop';

export function MotionReveal({
  children,
  index = 0,
  tone = 'app',
  when = 'mount',
  variant = 'fade-up',
}: {
  children: ReactNode;
  index?: number;
  tone?: 'app' | 'landing';
  when?: 'mount' | 'view';
  variant?: MotionRevealVariant;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;

  const delay = Math.min(index, 6) * 0.04;
  const duration = tone === 'landing' ? DURATION.base : DURATION.base;

  if (variant === 'clip-up') {
    const inner = { y: 0, opacity: 1 };
    const from = { y: '100%', opacity: 0 };
    const transition = { duration, delay, ease: APPLE_EASE };
    return (
      <div className="motion-clip">
        {when === 'view' ? (
          <motion.div initial={from} whileInView={inner} viewport={VIEWPORT_ONCE} transition={transition}>
            {children}
          </motion.div>
        ) : (
          <motion.div initial={from} animate={inner} transition={transition}>
            {children}
          </motion.div>
        )}
      </div>
    );
  }

  const hidden =
    variant === 'scale-in' || variant === 'pop' ? { opacity: 0, y: 12, scale: 0.96 }
      : variant === 'slide-x' ? { opacity: 0, x: 16, y: 0, scale: 1 }
        : variant === 'fade' ? { opacity: 0, y: 0, scale: 1 }
          : { opacity: 0, y: 16, scale: 1 };
  const visible = { opacity: 1, y: 0, x: 0, scale: 1 };
  const transition = { duration, delay, ease: APPLE_EASE };

  if (when === 'view') {
    return (
      <motion.div initial={hidden} whileInView={visible} viewport={VIEWPORT_ONCE} transition={transition}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div initial={hidden} animate={visible} transition={transition}>
      {children}
    </motion.div>
  );
}
