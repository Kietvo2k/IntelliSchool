import { motion, useReducedMotion } from 'motion/react';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

export function LetterChoice({
  name,
  choices,
  value,
  onChange,
  disabled,
  variant = 'lms',
}: {
  name: string;
  choices: string[];
  value?: number | string | null;
  onChange: (index: number, choice: string) => void;
  disabled?: boolean;
  variant?: 'lms' | 'cbt';
}) {
  const reduce = useReducedMotion();
  const selectedIndex = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? choices.findIndex((choice) => choice === value)
      : -1;

  return (
    <div className={`letter-choice letter-choice-${variant}`} role="radiogroup" aria-label="Lựa chọn">
      {choices.slice(0, 4).map((choice, index) => {
        const selected = selectedIndex === index;
        return (
          <motion.label
            key={`${name}-${index}`}
            className={`letter-choice-item${selected ? ' is-selected' : ''}`}
            whileTap={disabled || reduce ? undefined : { scale: 0.97 }}
            animate={selected && !reduce ? { scale: 1.02 } : { scale: 1 }}
            transition={{ type: reduce ? 'tween' : 'spring', stiffness: 420, damping: 28, duration: reduce ? 0 : undefined }}
          >
            <input
              type="radio"
              name={name}
              value={index}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(index, choice)}
            />
            <span className="letter-choice-key" aria-hidden="true">{LETTERS[index]}</span>
            <span className="letter-choice-text">{choice}</span>
          </motion.label>
        );
      })}
    </div>
  );
}
