import { motion, useReducedMotion } from 'motion/react';
import { subjectLabel } from '../../lib/subject-labels.js';
import { DURATION, EASE_OUT } from '../../lib/motion.js';

export interface KnowledgeCanonical {
  strengths?: string[];
  gaps?: string[];
  recommendedFocus?: string[];
  grades?: Record<string, number>;
}

function ChipList({ title, items, tone }: { title: string; items: string[]; tone: 'strong' | 'gap' | 'focus' }) {
  if (items.length === 0) return null;
  return (
    <div className="knowledge-chip-group">
      <p className="eyebrow">{title}</p>
      <ul>
        {items.map((item) => (
          <li key={item} className={`knowledge-chip is-${tone}`}>{subjectLabel(item)}</li>
        ))}
      </ul>
    </div>
  );
}

export function KnowledgeCardView({
  canonical,
  freeText,
}: {
  canonical: KnowledgeCanonical;
  freeText?: string;
}) {
  const reduce = useReducedMotion();
  const grades = Object.entries(canonical.grades ?? {}).filter(([, score]) => Number.isFinite(score));

  return (
    <section className="knowledge-card" aria-labelledby="knowledge-title">
      <h2 id="knowledge-title">Thẻ kiến thức 80/20</h2>
      <p className="muted-copy">Phần chuẩn do hệ thống tổng hợp từ điểm và hồ sơ. Em chỉ sửa 20% ghi chú tự do.</p>
      <ChipList title="Điểm mạnh" items={canonical.strengths ?? []} tone="strong" />
      <ChipList title="Cần bổ sung" items={canonical.gaps ?? []} tone="gap" />
      <ChipList title="Nên tập trung" items={canonical.recommendedFocus ?? []} tone="focus" />
      {grades.length > 0 && (
        <div className="knowledge-bars" aria-label="Điểm theo môn">
          {grades.map(([code, score]) => (
            <div key={code} className="knowledge-bar-row">
              <span>{subjectLabel(code)}</span>
              <span className="knowledge-bar-track">
                <motion.span
                  className="knowledge-bar-fill"
                  initial={false}
                  animate={{ scaleX: Math.max(0, Math.min(1, score / 10)) }}
                  transition={reduce ? { duration: 0 } : { duration: DURATION.base, ease: EASE_OUT }}
                />
              </span>
              <strong>{score.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      )}
      {freeText ? <p className="knowledge-free">{freeText}</p> : null}
    </section>
  );
}
