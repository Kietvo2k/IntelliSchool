import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { useCatalog, type SubjectOption } from '../lib/catalog.js';
import { createIdempotentAction } from '../lib/idempotent-action.js';
import { useSession } from '../lib/SessionContext.js';

type SkillGraphStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
interface SkillGraphSummary {
  id: string;
  subjectId: string;
  subjectName?: string;
  title: string;
  version: number;
  status: SkillGraphStatus;
  skillCount: number;
  createdByName?: string;
  reviewReason?: string;
  approvedByName?: string;
  updatedAt: string;
}

const statusLabel: Record<SkillGraphStatus, string> = {
  DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
};

interface ParsedDefinition {
  skills: Array<{ code: string; name: string; description?: string }>;
  edges: Array<{ prerequisite: string; skill: string }>;
}

/** Cú pháp kỹ năng: mỗi dòng `MÃ | Tên | mô tả`. Cú pháp tiên quyết: mỗi dòng `MÃ_TRƯỚC > MÃ_SAU`. */
function parseDefinition(skillsText: string, edgesText: string): ParsedDefinition {
  const skills = skillsText.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [code, name, description] = line.split('|').map((part) => part.trim());
    return { code: code ?? '', name: name || (code ?? ''), ...(description ? { description } : {}) };
  });
  const edges = edgesText.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [prerequisite, skill] = line.split('>').map((part) => part.trim());
    return { prerequisite: prerequisite ?? '', skill: skill ?? '' };
  });
  return { skills, edges };
}

export function SkillGraphsPage() {
  const { user } = useSession();
  const subjects = useCatalog<SubjectOption>('/api/v1/subjects');
  const [subjectId, setSubjectId] = useState('');
  const [graphs, setGraphs] = useState<SkillGraphSummary[]>([]);
  const [listState, setListState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const createAction = useRef(createIdempotentAction('skill-graph-create', newIdempotencyKey)).current;

  const loadGraphs = useCallback(async (nextSubjectId: string) => {
    setListState('loading');
    setMessage('');
    try {
      const data = await apiRequest<SkillGraphSummary[]>('/api/v1/skill-graphs', { query: { subjectId: nextSubjectId || undefined } });
      setGraphs(data ?? []);
      setListState('idle');
    } catch (error) {
      setListState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải danh sách đồ thị kỹ năng.');
    }
  }, []);

  useEffect(() => { void loadGraphs(''); }, [loadGraphs]);

  async function createGraph(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const definition = parseDefinition(String(form.get('skills') ?? ''), String(form.get('edges') ?? ''));
    if (definition.skills.length === 0) { setState('error'); setMessage('Cần ít nhất một kỹ năng.'); return; }
    const input = { subjectId: String(form.get('subjectId') ?? ''), title: String(form.get('title') ?? ''), definition };
    const ticket = createAction.begin(input);
    if (!ticket) return;
    setState('sending');
    setMessage('');
    try {
      await apiRequest('/api/v1/skill-graphs', {
        method: 'POST',
        idempotencyKey: ticket.key,
        body: input,
      });
      setState('idle');
      setMessage('Đã tạo đồ thị kỹ năng ở trạng thái nháp. Gửi duyệt khi sẵn sàng.');
      formElement.reset();
      createAction.end(input, true);
      void loadGraphs(subjectId).catch(() => setMessage('Đã tạo đồ thị kỹ năng nhưng chưa làm mới được danh sách.'));
    } catch (error) {
      createAction.end(input, false);
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tạo đồ thị kỹ năng.');
    }
  }

  async function act(path: string, prefix: string, body?: unknown, successMessage = 'Đã cập nhật đồ thị kỹ năng.') {
    setState('sending');
    setMessage('');
    try {
      await apiRequest(path, { method: 'POST', idempotencyKey: newIdempotencyKey(prefix), body });
      setState('idle');
      setMessage(successMessage);
      await loadGraphs(subjectId);
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Thao tác chưa thực hiện được.');
    }
  }

  function reviewGraph(graph: SkillGraphSummary, decision: 'APPROVED' | 'REJECTED') {
    let reason: string | undefined;
    if (decision === 'REJECTED') {
      reason = window.prompt('Nêu lý do từ chối đồ thị kỹ năng:') ?? undefined;
      if (!reason || reason.trim().length < 3) { setState('error'); setMessage('Cần nêu lý do từ chối (tối thiểu 3 ký tự).'); return; }
    }
    void act(`/api/v1/skill-graphs/${graph.id}/review`, 'skill-graph-review', { decision, reason }, decision === 'APPROVED' ? 'Đã duyệt đồ thị kỹ năng.' : 'Đã từ chối đồ thị kỹ năng.');
  }

  return (
    <>
      <PageHeader eyebrow="Học tập thích ứng" title="Đồ thị kỹ năng" lede="Soạn cây kỹ năng và quan hệ tiên quyết cho môn học. Đồ thị phải được một giáo viên khác duyệt trước khi dùng để chẩn đoán lỗ hổng kiến thức." />
      {message && <p className={`form-message ${state === 'error' || listState === 'error' ? 'is-error' : 'is-success'}`} role={state === 'error' || listState === 'error' ? 'alert' : 'status'}>{message}</p>}

      <div className="workspace-feature-grid">
        <article className="workspace-feature">
          <p>Tạo đồ thị kỹ năng mới</p>
          <form className="login-form" onSubmit={createGraph}>
            <label htmlFor="graphSubjectId">Môn học</label>
            <select id="graphSubjectId" name="subjectId" required disabled={subjects.state === 'loading'}>
              <option value="">Chọn môn học</option>
              {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
            </select>
            <label htmlFor="graphTitle">Tên đồ thị</label>
            <input id="graphTitle" name="title" required minLength={3} maxLength={200} placeholder="Phân số đến tỉ lệ thức" />
            <label htmlFor="graphSkills">Kỹ năng</label>
            <textarea id="graphSkills" name="skills" rows={5} required aria-describedby="graphSkillsHelp" placeholder={'FRACTION_ADD | Cộng phân số | Cộng hai phân số khác mẫu\nRATIO | Tỉ lệ thức'} />
            <small id="graphSkillsHelp">Mỗi dòng: MÃ | Tên | mô tả (mô tả không bắt buộc).</small>
            <label htmlFor="graphEdges">Quan hệ tiên quyết</label>
            <textarea id="graphEdges" name="edges" rows={3} aria-describedby="graphEdgesHelp" placeholder={'FRACTION_ADD > RATIO'} />
            <small id="graphEdgesHelp">Mỗi dòng: MÃ_TIÊN_QUYẾT &gt; MÃ_PHỤ_THUỘC. Không được tạo vòng lặp.</small>
            <button className="button button-primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Đang lưu…' : 'Tạo bản nháp'}</button>
          </form>
        </article>

        <article className="workspace-feature">
          <p>Lọc theo môn học</p>
          <form className="login-form" onSubmit={(event) => { event.preventDefault(); void loadGraphs(subjectId); }}>
            <label htmlFor="filterGraphSubject">Môn học</label>
            <select id="filterGraphSubject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={subjects.state === 'loading'}>
              <option value="">Tất cả môn học</option>
              {subjects.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
            </select>
            <button className="button button-primary" type="submit">Tải danh sách</button>
          </form>
        </article>
      </div>

      <section aria-labelledby="graph-list-title" style={{ marginTop: '1.5rem' }}>
        <h2 id="graph-list-title">Danh sách đồ thị</h2>
        {listState === 'loading' && <p className="workspace-state" role="status">Đang tải đồ thị kỹ năng…</p>}
        {listState !== 'loading' && graphs.length === 0 && <p className="workspace-state">Chưa có đồ thị kỹ năng nào.</p>}
        {graphs.length > 0 && (
          <ul className="workspace-list">
            {graphs.map((graph) => (
              <li key={graph.id} className="workspace-list-item">
                <div>
                  <strong>{graph.title}</strong> · v{graph.version} · {graph.skillCount} kỹ năng
                  <br />
                  <small>{graph.subjectName ?? 'Môn học'} · {statusLabel[graph.status]}{graph.createdByName ? ` · soạn bởi ${graph.createdByName}` : ''}{graph.approvedByName ? ` · duyệt bởi ${graph.approvedByName}` : ''}</small>
                  {graph.status === 'REJECTED' && graph.reviewReason && <p className="form-message is-error" role="note">Lý do từ chối: {graph.reviewReason}</p>}
                </div>
                <div className="workspace-list-actions">
                  {(graph.status === 'DRAFT' || graph.status === 'REJECTED') && (
                    <button type="button" className="text-link" disabled={state === 'sending'} onClick={() => void act(`/api/v1/skill-graphs/${graph.id}/submit`, 'skill-graph-submit', undefined, 'Đã gửi đồ thị đi duyệt.')}>Gửi duyệt</button>
                  )}
                  {graph.status === 'PENDING_REVIEW' && (
                    <>
                      <button type="button" className="text-link" disabled={state === 'sending'} onClick={() => reviewGraph(graph, 'APPROVED')}>Duyệt</button>
                      <button type="button" className="text-link" disabled={state === 'sending'} onClick={() => reviewGraph(graph, 'REJECTED')}>Từ chối</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {user.role === 'TEACHER' && <p className="workspace-hint">Bạn chỉ duyệt được đồ thị của môn mình được phân công và không thể tự duyệt đồ thị do chính mình soạn.</p>}
      </section>
    </>
  );
}
