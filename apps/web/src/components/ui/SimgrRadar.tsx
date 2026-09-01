import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DURATION, EASE_OUT } from '../../lib/motion.js';

export const SIMGR_AXES = [
  { key: 'strengths', label: 'Năng lực' },
  { key: 'interests', label: 'Sở thích' },
  { key: 'market', label: 'Thị trường' },
  { key: 'growth', label: 'Tăng trưởng' },
  { key: 'risk', label: 'Rủi ro' },
] as const;

export const RIASEC_AXES = [
  { key: 'R', label: 'Thực tế (R)' },
  { key: 'I', label: 'Nghiên cứu (I)' },
  { key: 'A', label: 'Nghệ thuật (A)' },
  { key: 'S', label: 'Xã hội (S)' },
  { key: 'E', label: 'Quản lý (E)' },
  { key: 'C', label: 'Quy củ (C)' },
] as const;

export type RadarAxis = { key: string; label: string };

function point(index: number, value: number, size: number, count: number): [number, number] {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 36;
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return [cx + Math.cos(angle) * radius * value, cy + Math.sin(angle) * radius * value];
}

export function SimgrRadar({
  scores,
  axes = SIMGR_AXES,
  caption = 'Biểu đồ SIMGR. Nhãn chữ, không chỉ màu.',
}: {
  scores: Record<string, number>;
  axes?: readonly RadarAxis[];
  caption?: string;
}) {
  const reduce = useReducedMotion();
  const [tip, setTip] = useState<string | null>(null);
  const size = 280;
  const rings = [0.2, 0.4, 0.6, 0.8, 1];
  const count = axes.length;
  const polygon = axes.map((axis, index) => point(index, Math.max(0, Math.min(1, scores[axis.key] ?? 0.5)), size, count).join(',')).join(' ');

  return (
    <figure className="simgr-radar">
      <svg className="radar-chart" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={caption}>
        {rings.map((ring) => (
          <polygon
            key={ring}
            fill="none"
            stroke="#dcd9cc"
            strokeWidth="1"
            points={axes.map((_, index) => point(index, ring, size, count).join(',')).join(' ')}
          />
        ))}
        {axes.map((axis, index) => {
          const [x, y] = point(index, 1, size, count);
          return <line key={axis.key} x1={size / 2} y1={size / 2} x2={x} y2={y} stroke="#dcd9cc" />;
        })}
        <motion.polygon
          fill="#1e543c22"
          stroke="#1e543c"
          strokeWidth="2"
          points={polygon}
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={reduce ? { duration: 0 } : { duration: DURATION.radar, ease: EASE_OUT }}
        />
        {axes.map((axis, index) => {
          const value = Math.max(0, Math.min(1, scores[axis.key] ?? 0.5));
          const [x, y] = point(index, 1.18, size, count);
          return (
            <text
              key={axis.key}
              x={x}
              y={y}
              textAnchor="middle"
              fontSize="11"
              fill="#123726"
              onMouseEnter={() => setTip(`${axis.label}: ${Math.round(value * 100)}%`)}
              onMouseLeave={() => setTip(null)}
              onFocus={() => setTip(`${axis.label}: ${Math.round(value * 100)}%`)}
              onBlur={() => setTip(null)}
              tabIndex={0}
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
      <figcaption>
        {tip ?? caption}
      </figcaption>
      <ul className="simgr-legend">
        {axes.map((axis) => (
          <li key={axis.key}><b>{axis.label}</b>: {Math.round((scores[axis.key] ?? 0.5) * 100)}%</li>
        ))}
      </ul>
    </figure>
  );
}
