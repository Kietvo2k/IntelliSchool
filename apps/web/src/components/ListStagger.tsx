import { Children, type ReactNode } from 'react';
import { ScrollReveal } from './ScrollReveal.js';
import { STAGGER_MAX } from '../lib/motion.js';

export function ListStagger({ children, className, limit = STAGGER_MAX }: { children: ReactNode; className?: string; limit?: number }) {
  const items = Children.toArray(children);
  if (items.length > limit) {
    return <div className={className}>{children}</div>;
  }
  return (
    <div className={className}>
      {items.map((child, index) => (
        <ScrollReveal key={index} index={index}>{child}</ScrollReveal>
      ))}
    </div>
  );
}
