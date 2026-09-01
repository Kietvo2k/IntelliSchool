import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { EmptyState, ErrorState } from '../components/ui/EmptyState.js';
import { FormField, TextArea, TextInput } from '../components/ui/FormField.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';

interface PendingEssay {
  attemptId: string;
  assignmentItemId: string;
  assignmentTitle: string;
  studentName: string;
  prompt: { text?: string };
  answer: { text?: string };
  maxScore: number;
}

export function EssayGradingPage() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const query = useQuery({
    queryKey: ['pending-essays'],
    queryFn: () => apiRequest<PendingEssay[]>('/api/v1/grading/pending-essays'),
  });

  async function grade(event: FormEvent<HTMLFormElement>, item: PendingEssay) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true); setMessage('');
    try {
      const graded = await apiRequest<{ fullyGraded: boolean }>(`/api/v1/attempts/${item.attemptId}/answers/${item.assignmentItemId}/grade`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('essay-grade'),
        body: { score: Number(form.get('score')), feedback: String(form.get('feedback') ?? '') },
      });
      if (graded.fullyGraded) {
        await apiRequest(`/api/v1/attempts/${item.attemptId}/return`, {
          method: 'POST',
          idempotencyKey: newIdempotencyKey('attempt-return'),
          body: { overallFeedback: String(form.get('overallFeedback') ?? '') },
        });
      }
      setMessage(graded.fullyGraded ? 'Đã trả bài cùng phản hồi tổng thể.' : 'Đã lưu điểm và phản hồi.');
      await query.refetch();
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể lưu điểm.');
    } finally {
      setSending(false);
    }
  }

  const items = query.data ?? [];
  return (
    <>
      <PageHeader eyebrow="Chấm bài" title="Tự luận chờ chấm" lede="Chấm từng câu. Khi đủ điểm, hệ thống trả bài kèm phản hồi tổng thể." />
      {message && <p className={`form-message ${message.startsWith('Đã') ? 'is-success' : 'is-error'}`} role="status">{message}</p>}
      {query.isPending && <EmptyState>Đang tải bài tự luận…</EmptyState>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()}>Chưa thể tải bài tự luận.</ErrorState>}
      {query.isSuccess && items.length === 0 && <EmptyState>Không có bài tự luận chờ chấm.</EmptyState>}
      <div className="workspace-feature-grid">
        {items.map((item) => (
          <article className="workspace-feature" key={`${item.attemptId}-${item.assignmentItemId}`}>
            <p>{item.assignmentTitle} · {item.studentName}</p>
            <h2>{item.prompt.text ?? 'Câu tự luận'}</h2>
            <span>{item.answer.text ?? 'Học sinh chưa nhập nội dung.'}</span>
            <form className="login-form" onSubmit={(event) => void grade(event, item)}>
              <FormField id={`score-${item.assignmentItemId}`} label={`Điểm (tối đa ${item.maxScore})`}>
                <TextInput id={`score-${item.assignmentItemId}`} name="score" type="number" min={0} max={item.maxScore} step={0.1} required />
              </FormField>
              <FormField id={`feedback-${item.assignmentItemId}`} label="Phản hồi">
                <TextArea id={`feedback-${item.assignmentItemId}`} name="feedback" maxLength={10000} rows={4} />
              </FormField>
              <FormField id={`overall-feedback-${item.assignmentItemId}`} label="Phản hồi tổng thể khi trả bài">
                <TextArea id={`overall-feedback-${item.assignmentItemId}`} name="overallFeedback" maxLength={10000} rows={3} />
              </FormField>
              <button className="button button-primary" type="submit" disabled={sending}>Lưu điểm</button>
            </form>
          </article>
        ))}
      </div>
    </>
  );
}
