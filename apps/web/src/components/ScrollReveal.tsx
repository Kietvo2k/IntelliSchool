import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { scrollIn } from '../lib/motion.js';

export function ScrollReveal({
  children,
  index = 0,
  as: Tag = 'div',
  className,
}: {
  children: ReactNode;
  index?: number;
  as?: 'div' | 'li' | 'article' | 'section';
  className?: string;
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion.create(Tag);
  return (
    <MotionTag className={className} {...scrollIn(reduce, index)} style={{ willChange: reduce ? undefined : 'opacity, transform' }}>
      {children}
    </MotionTag>
  );
}
