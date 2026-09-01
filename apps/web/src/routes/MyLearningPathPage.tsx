import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError } from '../lib/api.js';

interface PathStep { skillCode: string; skillName: string; unmetPrerequisites: string[]; }
interface ReviewItem { skillCode: string; skillName: string; dueAt: string; reason: string; due: boolean; }
interface SubjectPlan {
  subjectId: string;
  subjectName: string;
  status: 'ACTIONABLE' | 'NEEDS_MORE_EVIDENCE' | 'ON_TRACK' | 'DISMISSED_BY_TEACHER';
  rootSkillCode: string | null;
  rootSkillName: string | null;
  path: PathStep[];
  reviews: ReviewItem[];
  teacherNote: string | null;
}
interface PlanResponse { generatedAt: string; plans: SubjectPlan[]; }

const reviewReasonLabel: Record<string, string> = {
  REMEDIATE_SOON: 'Ôn lại sớm',
  RECOVERY_CHECK: 'Kiểm tra lại',
  SPACED_REVIEW: 'Ôn ngắt quãng',
};

export function MyLearningPathPage() {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [state, setState] = useState<'loading' | 'idle' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<PlanResponse>('/api/v1/adaptive/my')
      .then((result) => { if (active) { setData(result); setState('idle'); } })
      .catch((error) => { if (active) { setState('error'); setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải lộ trình học tập.'); } });
    return () => { active = false; };
  }, []);

  return (
    <>
      <PageHeader eyebrow="Học tập thích ứng" title="Lộ trình của em" lede="Lộ trình ôn tập dựa trên bài làm đã chấm, sắp theo thứ tự kiến thức nền trước. Mỗi bước đều nêu lý do dựa trên bằng chứng thật." />
      {state === 'loading' && <p className="workspace-state" role="status">Đang tải lộ trình…</p>}
      {state === 'error' && <p className="form-message is-error" role="alert">{message}</p>}
      {state === 'idle' && data && data.plans.length === 0 && (
        <p className="workspace-state">Chưa có lộ trình ôn tập. Hãy hoàn thành bài tập để hệ thống hiểu rõ điểm cần ôn.</p>
      )}
      {state === 'idle' && data && data.plans.map((plan) => (
        <section key={plan.subjectId} aria-labelledby={`plan-${plan.subjectId}`} className="workspace-feature" style={{ marginTop: '1.25rem' }}>
          <h2 id={`plan-${plan.subjectId}`}>{plan.subjectName}</h2>
          {plan.status === 'ON_TRACK' && <p>Em đang theo kịp môn này. Tiếp tục duy trì nhé!</p>}
          {plan.status === 'NEEDS_MORE_EVIDENCE' && <p>Cần thêm bài làm để xác định điểm cần ôn. Hãy hoàn thành thêm bài tập.</p>}
          {plan.status === 'DISMISSED_BY_TEACHER' && <p>Giáo viên đã xem và quyết định em không cần ôn thêm ở môn này{plan.teacherNote ? `: ${plan.teacherNote}` : '.'}</p>}
          {plan.status === 'ACTIONABLE' && (
            <>
              {plan.rootSkillName && <p><strong>Điểm cần ôn trước tiên:</strong> {plan.rootSkillName}</p>}
              {plan.path.length > 0 && (
                <ol>
                  {plan.path.map((step) => (
                    <li key={step.skillCode}>
                      {step.skillName}
                      {step.unmetPrerequisites.length > 0 && <small> · cần ôn kiến thức nền trước: {step.unmetPrerequisites.join(', ')}</small>}
                    </li>
                  ))}
                </ol>
              )}
              {plan.reviews.length > 0 && (
                <>
                  <h3>Việc ôn tập</h3>
                  <ul>
                    {plan.reviews.map((review) => (
                      <li key={review.skillCode}>
                        {review.skillName} · {reviewReasonLabel[review.reason] ?? review.reason} · {review.due ? 'đến hạn hôm nay' : `hạn ${new Date(review.dueAt).toLocaleDateString('vi-VN')}`}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      ))}
    </>
  );
}
