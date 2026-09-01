import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DURATION, EASE_OUT } from '../../lib/motion.js';

export function PathwayStepper({
  steps,
  current,
  onSelect,
}: {
  steps: Array<{ id: string; label: string; done?: boolean }>;
  current: number;
  onSelect?: (index: number) => void;
}) {
  const reduce = useReducedMotion();
  const [vertical, setVertical] = useState(false);
  const progress = steps.length <= 1 ? 1 : Math.max(0, Math.min(1, current / (steps.length - 1)));

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const sync = () => setVertical(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <nav className="pathway-stepper" aria-label="Lộ trình khám phá">
      <div className="pathway-line" aria-hidden="true">
        <span className="pathway-line-base" />
        <motion.span
          className="pathway-line-fill"
          initial={false}
          animate={vertical ? { scaleY: progress, scaleX: 1 } : { scaleX: progress, scaleY: 1 }}
          transition={reduce ? { duration: 0 } : { duration: DURATION.pathway, ease: EASE_OUT }}
        />
      </div>
      <ol className="pathway-nodes">
        {steps.map((step, index) => {
          const done = Boolean(step.done) || index < current;
          const active = index === current;
          return (
            <li key={step.id}>
              <button
                type="button"
                className={`pathway-node${done ? ' is-done' : ''}${active ? ' is-current' : ''}`}
                aria-current={active ? 'step' : undefined}
                disabled={!active && !done}
                aria-disabled={!active && !done ? true : undefined}
                onClick={() => onSelect?.(index)}
              >
                <motion.span
                  className="pathway-dot"
                  aria-hidden="true"
                  animate={active && !reduce ? { scale: [1, 1.08, 1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: reduce ? 0 : 0.7, ease: EASE_OUT }}
                >
                  {done && !active ? '✓' : index + 1}
                </motion.span>
                <span className="pathway-label">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
