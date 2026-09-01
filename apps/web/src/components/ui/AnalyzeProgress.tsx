import { motion, useReducedMotion } from 'motion/react';
import { DURATION, EASE_OUT } from '../../lib/motion.js';

export function AnalyzeProgress({
  tasks,
  currentIndex,
}: {
  tasks: Array<{ id: string; label: string }>;
  currentIndex: number;
}) {
  const reduce = useReducedMotion();
  const progress = tasks.length === 0 ? 0 : Math.min(1, (currentIndex + 1) / tasks.length);
  return (
    <div className="analyze-progress" role="status" aria-live="polite">
      <p>Đang phân tích {Math.min(currentIndex + 1, tasks.length)}/{tasks.length}</p>
      <div className="analyze-progress-track">
        <motion.span
          className="analyze-progress-fill"
          animate={{ scaleX: progress }}
          transition={reduce ? { duration: 0 } : { duration: DURATION.base, ease: EASE_OUT }}
        />
      </div>
      <ol>
        {tasks.map((task, index) => (
          <li key={task.id} className={index < currentIndex ? 'is-done' : index === currentIndex ? 'is-current' : ''}>
            {task.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
