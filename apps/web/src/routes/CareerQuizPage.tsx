import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AnalyzeProgress } from '../components/ui/AnalyzeProgress.js';
import { ChatShell } from '../components/ui/ChatShell.js';
import { type ChatBubble } from '../components/ui/ChatThread.js';
import { GradeChip } from '../components/ui/GradeChip.js';
import { LetterChoice } from '../components/ui/LetterChoice.js';
import { PageHeader } from '../components/ui/PageHeader.js';
import { PathwayStepper } from '../components/ui/PathwayStepper.js';
import { apiRequest, ApiRequestError, newIdempotencyKey } from '../lib/api.js';
import { DURATION, EASE_IN, EASE_OUT } from '../lib/motion.js';
import { useOptionalSession } from '../lib/SessionContext.js';
import { VIETNAM_PROVINCES } from '../lib/vietnam-provinces.js';

interface RiasecQuestion { id: string; text: string; group: string }
interface ExtraQuestion { id: string; text: string; category: string }
interface AptitudeQuestion { id: string; dimension: string; prompt: string; choices: string[]; kind?: 'mcq' | 'essay'; track?: 'iq' | 'eq'; difficulty?: 'EASY' | 'MEDIUM' | 'HARD' }
interface CareerMatch { id: string; title: string; score: number; advisory: boolean }
interface Recommendations { disclaimer: string; riasec: { code: string; scores: Record<string, number> }; aptitude: Record<string, number>; matches: CareerMatch[] }

const SUBJECTS = [
  { id: 'TOAN', label: 'Toán' },
  { id: 'VAN', label: 'Ngữ văn' },
  { id: 'ANH', label: 'Ngoại ngữ 1' },
  { id: 'LY', label: 'Vật lí' },
  { id: 'HOA', label: 'Hóa học' },
  { id: 'SINH', label: 'Sinh học' },
  { id: 'SU', label: 'Lịch sử' },
  { id: 'DIA', label: 'Địa lí' },
  { id: 'GDKTPL', label: 'GDKTPL' },
  { id: 'TIN', label: 'Tin học' },
];

const STEPS = [
  { id: 'intro', label: 'Giới thiệu' },
  { id: 'aptitude', label: 'Năng lực' },
  { id: 'holland', label: 'Holland / RIASEC' },
  { id: 'extra', label: 'Hoạt động & trải nghiệm' },
  { id: 'grades', label: 'Điểm học' },
  { id: 'profile', label: 'Hồ sơ' },
];

const SKIPPABLE = ['aptitude', 'holland', 'extra', 'grades'];
const LIKERT = ['Rất không phù hợp', 'Không phù hợp', 'Bình thường', 'Phù hợp', 'Rất phù hợp'];
const PRIORITY_KEYS = [
  { id: 'major', label: 'Ngành phù hợp' },
  { id: 'tuition', label: 'Học phí' },
  { id: 'location', label: 'Vị trí' },
  { id: 'quality', label: 'Chất lượng đào tạo' },
  { id: 'jobs', label: 'Cơ hội việc làm' },
] as const;
const ANALYZE_TASKS = [
  { id: 'ACADEMIC_ANALYST', label: 'Phân tích học tập' },
  { id: 'TREND_DETECTOR', label: 'Phát hiện xu hướng' },
  { id: 'SUBJECT_RECOMMENDER', label: 'Đề xuất môn học' },
  { id: 'MARKET_ANALYST', label: 'Phân tích thị trường' },
  { id: 'ADMISSION_STRATEGIST', label: 'Chiến lược tuyển sinh' },
  { id: 'COMPETITIVENESS_ANALYST', label: 'Phân tích cạnh tranh' },
  { id: 'STUDY_PLAN_ADVISOR', label: 'Kế hoạch học tập' },
  { id: 'EXTRACURRICULAR_ADVISOR', label: 'Tư vấn ngoại khóa' },
  { id: 'SCHOLARSHIP_FINDER', label: 'Tìm học bổng' },
  { id: 'RISK_ASSESSOR', label: 'Đánh giá rủi ro' },
];
const FALLBACK_RIASEC: RiasecQuestion[] = [
  { id: 'R1', text: 'Em thích làm việc với máy móc, dụng cụ, sửa chữa.', group: 'R' },
  { id: 'I1', text: 'Em thích tìm hiểu nguyên nhân, thí nghiệm, phân tích số liệu.', group: 'I' },
  { id: 'A1', text: 'Em thích vẽ, viết, nhạc hoặc thiết kế.', group: 'A' },
  { id: 'S1', text: 'Em thích giúp người khác học hoặc giải quyết khó khăn.', group: 'S' },
  { id: 'E1', text: 'Em thích thuyết phục, tổ chức nhóm, dẫn dắt dự án.', group: 'E' },
  { id: 'C1', text: 'Em thích sắp xếp dữ liệu, theo quy trình rõ ràng.', group: 'C' },
];
const FALLBACK_EXTRA: ExtraQuestion[] = [
  { id: 'ec_sports', category: 'sports', text: 'Em có tham gia hoạt động thể thao nào không? Hãy kể tên môn và tần suất tập luyện.' },
  { id: 'ec_clubs', category: 'clubs', text: 'Em có tham gia câu lạc bộ nào ở trường không? Đó là CLB gì và đã tham gia được bao lâu?' },
  { id: 'ec_competition', category: 'competition', text: 'Em đã từng tham gia cuộc thi học thuật hoặc kỳ thi nào chưa? Nếu có, hãy kể tên và thành tích.' },
  { id: 'ec_leadership', category: 'leadership', text: 'Em có kinh nghiệm lãnh đạo không? Ví dụ lớp trưởng, bí thư đoàn, trưởng nhóm dự án.' },
  { id: 'ec_volunteer', category: 'volunteer', text: 'Em có tham gia hoạt động tình nguyện hay công tác xã hội nào không?' },
  { id: 'ec_arts', category: 'arts', text: 'Em có sở thích hoặc năng khiếu nghệ thuật nào không? Ví dụ vẽ, âm nhạc, nhảy, viết, thiết kế.' },
  { id: 'ec_work', category: 'work', text: 'Em đã từng đi làm thêm, thực tập, hoặc tham gia dự án thực tế nào chưa?' },
  { id: 'ec_skills', category: 'skills', text: 'Em có kỹ năng đặc biệt nào không? Ví dụ ngoại ngữ, lập trình, thuyết trình, phần mềm chuyên ngành.' },
  { id: 'ec_certificates', category: 'certificates', text: 'Em có chứng chỉ, bằng khen, hoặc giải thưởng nào đã đạt được không?' },
  { id: 'ec_other', category: 'other', text: 'Còn điều gì khác về bản thân mà em muốn chia sẻ thêm không?' },
];

interface Draft {
  step: number;
  skippedSteps: string[];
  aptitudeIndex: number;
  aptitudeAnswers: Record<string, number | string>;
  aptitudeSkipped: string[];
  riasecAnswers: Record<string, number>;
  extraAnswers: Record<string, string>;
  extraIndex: number;
  extraDone: boolean;
  interview: ChatBubble[];
  followUps: number;
  interviewSession: string | null;
  province: string;
  studyGoal: string;
  studyGoalType: 'career' | 'school' | 'undecided' | '';
  preferredStudyRegion: 'near_home' | 'same_region' | 'nationwide' | '';
  preferredSchoolType: 'any' | 'public' | 'private' | 'international' | '';
  schoolPriority: Record<string, number>;
  tuitionBudgetVnd: string;
  householdIncomeVnd: string;
  chosenBlocks: string[];
  chosenSubjects: string[];
}

function emptyDraft(): Draft {
  return {
    step: 0,
    skippedSteps: [],
    aptitudeIndex: 0,
    aptitudeAnswers: {},
    aptitudeSkipped: [],
    riasecAnswers: {},
    extraAnswers: {},
    extraIndex: 0,
    extraDone: false,
    interview: [],
    followUps: 0,
    interviewSession: null,
    province: '',
    studyGoal: '',
    studyGoalType: '',
    preferredStudyRegion: '',
    preferredSchoolType: '',
    schoolPriority: { major: 3, tuition: 3, location: 3, quality: 3, jobs: 3 },
    tuitionBudgetVnd: '',
    householdIncomeVnd: '',
    chosenBlocks: [],
    chosenSubjects: [],
  };
}

function readDraft(key: string): Draft {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return emptyDraft();
    return { ...emptyDraft(), ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    return emptyDraft();
  }
}

export function CareerQuizPage() {
  const navigate = useNavigate();
  const session = useOptionalSession();
  const reduce = useReducedMotion();
  const storageKey = `smartpath-career-quiz:${session?.user.userId ?? 'anon'}`;
  const [draft] = useState(() => (typeof sessionStorage === 'undefined' ? emptyDraft() : readDraft(storageKey)));
  const [step, setStep] = useState(draft.step);
  const [skippedSteps, setSkippedSteps] = useState<string[]>(draft.skippedSteps);
  const [riasecQuestions, setRiasecQuestions] = useState<RiasecQuestion[]>([]);
  const [extraQuestions, setExtraQuestions] = useState<ExtraQuestion[]>([]);
  const [aptitudeQuestions, setAptitudeQuestions] = useState<AptitudeQuestion[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [prefillGrades, setPrefillGrades] = useState<Record<string, number>>({});
  const [aptitudeIndex, setAptitudeIndex] = useState(draft.aptitudeIndex);
  const [aptitudeAnswers, setAptitudeAnswers] = useState<Record<string, number | string>>(draft.aptitudeAnswers);
  const [aptitudeSkipped, setAptitudeSkipped] = useState<string[]>(draft.aptitudeSkipped);
  const [riasecAnswers, setRiasecAnswers] = useState<Record<string, number>>(draft.riasecAnswers);
  const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>(draft.extraAnswers);
  const [extraIndex, setExtraIndex] = useState(draft.extraIndex);
  const [extraDone, setExtraDone] = useState(draft.extraDone);
  const [province, setProvince] = useState(draft.province);
  const [studyGoal, setStudyGoal] = useState(draft.studyGoal);
  const [studyGoalType, setStudyGoalType] = useState<Draft['studyGoalType']>(draft.studyGoalType);
  const [preferredStudyRegion, setPreferredStudyRegion] = useState<Draft['preferredStudyRegion']>(draft.preferredStudyRegion);
  const [preferredSchoolType, setPreferredSchoolType] = useState<Draft['preferredSchoolType']>(draft.preferredSchoolType);
  const [schoolPriority, setSchoolPriority] = useState<Record<string, number>>(draft.schoolPriority);
  const [tuitionBudgetVnd, setTuitionBudgetVnd] = useState(draft.tuitionBudgetVnd);
  const [householdIncomeVnd, setHouseholdIncomeVnd] = useState(draft.householdIncomeVnd);
  const [chosenBlocks, setChosenBlocks] = useState<string[]>(draft.chosenBlocks);
  const [chosenSubjects, setChosenSubjects] = useState<string[]>(draft.chosenSubjects ?? []);
  const [interview, setInterview] = useState<ChatBubble[]>(draft.interview);
  const [interviewSession, setInterviewSession] = useState<string | null>(draft.interviewSession);
  const [followUps, setFollowUps] = useState(draft.followUps);
  const [interviewSending, setInterviewSending] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeIndex, setAnalyzeIndex] = useState(0);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    const payload: Draft = {
      step, skippedSteps, aptitudeIndex, aptitudeAnswers, aptitudeSkipped, riasecAnswers, extraAnswers, extraIndex, extraDone,
      interview, followUps, interviewSession, province, studyGoal, studyGoalType, preferredStudyRegion,
      preferredSchoolType, schoolPriority, tuitionBudgetVnd, householdIncomeVnd, chosenBlocks, chosenSubjects,
    };
    sessionStorage.setItem(storageKey, JSON.stringify(payload));
  }, [storageKey, step, skippedSteps, aptitudeIndex, aptitudeAnswers, aptitudeSkipped, riasecAnswers, extraAnswers, extraIndex, extraDone, interview, followUps, interviewSession, province, studyGoal, studyGoalType, preferredStudyRegion, preferredSchoolType, schoolPriority, tuitionBudgetVnd, householdIncomeVnd, chosenBlocks, chosenSubjects]);

  useEffect(() => {
    void Promise.all([
      apiRequest<{ questions: RiasecQuestion[] }>('/api/v1/career/riasec/questions'),
      apiRequest<{ questions: ExtraQuestion[] }>('/api/v1/career/extracurricular/questions'),
      apiRequest<{ questions: AptitudeQuestion[] }>('/api/v1/career/aptitude/questions'),
      apiRequest<Recommendations>('/api/v1/career/recommendations').catch(() => null),
      apiRequest<{
        classroomGrades?: Record<string, number>;
        province?: string;
        studyGoal?: string;
        studyGoalType?: string;
        preferredStudyRegion?: string;
        preferredSchoolType?: string;
        schoolPriority?: Record<string, number>;
        tuitionBudgetVnd?: number | null;
        householdIncomeVnd?: number | null;
        chosenBlocks?: string[];
        chosenSubjects?: string[];
      }>('/api/v1/career/profile').catch(() => null),
      apiRequest<Array<{ subjectCode: string; score: number }>>('/api/v1/transcripts').catch(() => []),
      apiRequest<{ version: string; answers: Record<string, number | string>; skippedIds: string[]; currentIndex: number }>('/api/v1/career/assessments/aptitude/draft').catch(() => null),
    ]).then(([riasec, extra, aptitude, recs, profile, transcripts, aptitudeDraft]) => {
      setRiasecQuestions(riasec?.questions?.length ? riasec.questions : FALLBACK_RIASEC);
      setExtraQuestions(extra?.questions?.length ? extra.questions : FALLBACK_EXTRA);
      setAptitudeQuestions(aptitude?.questions ?? []);
      if (recs) setRecommendations(recs);
      const fromTranscript: Record<string, number> = {};
      for (const row of transcripts ?? []) {
        if (!fromTranscript[row.subjectCode]) fromTranscript[row.subjectCode] = row.score;
      }
      setPrefillGrades({ ...fromTranscript, ...(profile?.classroomGrades ?? {}) });
      if (profile?.province && !province) setProvince(profile.province);
      if (profile?.studyGoal && !studyGoal) setStudyGoal(profile.studyGoal);
      if (profile?.studyGoalType && !studyGoalType) setStudyGoalType(profile.studyGoalType as Draft['studyGoalType']);
      if (profile?.preferredStudyRegion && !preferredStudyRegion) setPreferredStudyRegion(profile.preferredStudyRegion as Draft['preferredStudyRegion']);
      if (profile?.preferredSchoolType && !preferredSchoolType) setPreferredSchoolType(profile.preferredSchoolType as Draft['preferredSchoolType']);
      if (profile?.schoolPriority) setSchoolPriority((current) => ({ ...current, ...profile.schoolPriority }));
      if (profile?.tuitionBudgetVnd && !tuitionBudgetVnd) setTuitionBudgetVnd(String(profile.tuitionBudgetVnd));
      if (profile?.householdIncomeVnd && !householdIncomeVnd) setHouseholdIncomeVnd(String(profile.householdIncomeVnd));
      if (profile?.chosenBlocks?.length && chosenBlocks.length === 0) setChosenBlocks(profile.chosenBlocks);
      if (profile?.chosenSubjects?.length && chosenSubjects.length === 0) setChosenSubjects(profile.chosenSubjects);
      if (aptitudeDraft?.version === '2026.1') {
        setAptitudeAnswers(aptitudeDraft.answers ?? {});
        setAptitudeSkipped(aptitudeDraft.skippedIds ?? []);
        setAptitudeIndex(Math.max(0, Math.min(19, aptitudeDraft.currentIndex ?? 0)));
      }
    }).catch((error) => {
      setRiasecQuestions(FALLBACK_RIASEC);
      setExtraQuestions(FALLBACK_EXTRA);
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải trắc nghiệm.');
    });
    // Restore-only fields; do not reset step on F5.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== 1 || aptitudeQuestions.length === 0) return;
    if (Object.keys(aptitudeAnswers).length === 0 && aptitudeSkipped.length === 0) return;
    const timer = window.setTimeout(() => {
      void apiRequest('/api/v1/career/assessments/aptitude/draft', {
        method: 'PATCH',
        idempotencyKey: newIdempotencyKey('aptitude-draft'),
        body: { version: '2026.1', answers: aptitudeAnswers, skippedIds: aptitudeSkipped, currentIndex: aptitudeIndex },
      }).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [step, aptitudeQuestions.length, aptitudeAnswers, aptitudeSkipped, aptitudeIndex]);

  useEffect(() => {
    if (step !== 3) return;
    const questions = extraQuestions.length ? extraQuestions : FALLBACK_EXTRA;
    if (interview.length === 0 && questions[0]) {
      setInterview([{ id: `extra-${questions[0].id}`, role: 'ASSISTANT', content: questions[0].text }]);
    }
  }, [step, extraQuestions, interview.length]);

  const hollandItems = riasecQuestions.length ? riasecQuestions : FALLBACK_RIASEC;
  const extraItems = extraQuestions.length ? extraQuestions : FALLBACK_EXTRA;
  const currentAptitude = aptitudeQuestions[aptitudeIndex];
  const aptitudeTrack = currentAptitude?.track === 'eq' ? 'Đời sống' : 'Tư duy';
  const trackQuestions = aptitudeQuestions.filter((question) => (currentAptitude?.track ?? 'iq') === (question.track ?? 'iq'));
  const trackIndex = Math.max(0, trackQuestions.findIndex((question) => question.id === currentAptitude?.id));
  const aptitudeComplete = aptitudeQuestions.length > 0 && aptitudeQuestions.every((question) => Object.prototype.hasOwnProperty.call(aptitudeAnswers, question.id) || aptitudeSkipped.includes(question.id));
  const emptyGradeSubjects = SUBJECTS.filter((subject) => !Number.isFinite(prefillGrades[subject.id]));
  const hasMinimumProfile = province.trim().length > 0;
  const extraCounter = extraDone
    ? `Đã xong 10 câu · Follow-up ${followUps}/5`
    : `Câu ${Math.min(extraIndex + 1, extraItems.length)}/${extraItems.length} · Follow-up ${followUps}/5`;

  const pathwaySteps = useMemo(
    () => STEPS.map((item, index) => ({ ...item, done: index < step || skippedSteps.includes(item.id) })),
    [step, skippedSteps],
  );

  function skipTo(index: number) {
    const ids = STEPS.slice(1, index).map((item) => item.id).filter((id) => SKIPPABLE.includes(id));
    setSkippedSteps((current) => [...new Set([...current, ...ids])]);
    setStep(index);
  }

  function skipCurrent() {
    const id = STEPS[step]?.id;
    if (id && SKIPPABLE.includes(id)) setSkippedSteps((current) => [...new Set([...current, id])]);
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  async function post(path: string, prefix: string, body: unknown, success: string) {
    setState('sending');
    setMessage('');
    try {
      await apiRequest(path, { method: 'POST', idempotencyKey: newIdempotencyKey(prefix), body });
      setState('idle');
      setMessage(success);
      const recs = await apiRequest<Recommendations>('/api/v1/career/recommendations').catch(() => null);
      if (recs) setRecommendations(recs);
      return true;
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể lưu.');
      return false;
    }
  }

  async function submitAptitude() {
    if (!aptitudeComplete) {
      setMessage('Hãy trả lời hoặc bỏ qua từng câu trước khi lưu năng lực.');
      return;
    }
    const ok = await post('/api/v1/career/assessments/aptitude', 'aptitude', { answers: aptitudeAnswers, skippedIds: aptitudeSkipped }, 'Đã ghi nhận năng lực.');
    if (ok) setStep(2);
  }

  async function submitRiasec() {
    const answers: Record<string, number> = {};
    for (const item of hollandItems) {
      const value = riasecAnswers[item.id];
      if (typeof value === 'number') answers[item.id] = value;
    }
    if (Object.keys(answers).length === 0) {
      skipCurrent();
      return;
    }
    const ok = await post('/api/v1/career/assessments/riasec', 'riasec', { answers }, 'Đã lưu Holland / RIASEC.');
    if (ok) setStep(3);
  }

  async function saveExtra(answers: Record<string, string>) {
    const filled = Object.fromEntries(Object.entries(answers).filter(([, value]) => value.trim().length > 0));
    if (Object.keys(filled).length === 0) return true;
    return post('/api/v1/career/assessments/extracurricular', 'extra', { answers: filled }, 'Đã lưu hoạt động ngoại khóa.');
  }

  async function finishExtra(answers: Record<string, string>) {
    setExtraDone(true);
    await saveExtra(answers);
    setInterview((current) => [...current, { id: `extra-done-${Date.now()}`, role: 'ASSISTANT', content: 'Cảm ơn em. Mình hỏi thêm tối đa 5 câu cho rõ hơn — em có thể kết thúc bất cứ lúc nào.' }]);
  }

  async function sendInterview(text: string) {
    if (!extraDone) {
      const question = extraItems[extraIndex];
      const nextAnswers = question ? { ...extraAnswers, [question.id]: text } : extraAnswers;
      setExtraAnswers(nextAnswers);
      setInterview((current) => [...current, { id: `u-${Date.now()}`, role: 'USER', content: text }]);
      const nextIndex = extraIndex + 1;
      if (nextIndex >= extraItems.length) {
        await finishExtra(nextAnswers);
        return;
      }
      setExtraIndex(nextIndex);
      const next = extraItems[nextIndex];
      if (next) setInterview((current) => [...current, { id: `extra-${next.id}`, role: 'ASSISTANT', content: next.text }]);
      return;
    }
    if (followUps >= 5) {
      setMessage('Đã đủ 5 câu hỏi thêm.');
      return;
    }
    setInterviewSending(true);
    setInterview((current) => [...current, { id: `u-${Date.now()}`, role: 'USER', content: text }]);
    try {
      const reply = await apiRequest<{ sessionId: string; message: { id: string; content: string } }>('/api/v1/ai/chat', {
        method: 'POST',
        idempotencyKey: newIdempotencyKey('extra-interview'),
        body: { message: text, sessionId: interviewSession, purpose: 'EXTRACURRICULAR_INTERVIEW' },
      });
      setInterviewSession(reply.sessionId);
      setInterview((current) => [...current, { id: reply.message.id, role: 'ASSISTANT', content: reply.message.content }]);
      setFollowUps((count) => count + 1);
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa hỏi thêm được.');
    } finally {
      setInterviewSending(false);
    }
  }

  async function submitGrades(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const classroomGrades: Record<string, number> = { ...prefillGrades };
    for (const subject of emptyGradeSubjects) {
      const value = Number(form.get(subject.id));
      if (Number.isFinite(value) && value > 0) classroomGrades[subject.id] = value;
    }
    setState('sending');
    try {
      await apiRequest('/api/v1/career/profile', { method: 'PATCH', idempotencyKey: newIdempotencyKey('grades'), body: { classroomGrades } });
      setState('idle');
      setMessage('Đã lưu điểm học trên lớp. Điểm này không dùng làm tổ hợp xét tuyển ĐH.');
      setPrefillGrades(classroomGrades);
      setStep(5);
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể lưu điểm học.');
    }
  }

  async function saveProfileAndAnalyze() {
    if (!hasMinimumProfile) {
      setState('error');
      setMessage('Cần chọn tỉnh/thành trước khi xem kết quả. Mục tiêu học tập có thể để trống.');
      return;
    }
    setState('sending');
    setMessage('');
    try {
      await apiRequest('/api/v1/career/profile', {
        method: 'PATCH',
        idempotencyKey: newIdempotencyKey('career-profile'),
        body: {
          province,
          studyGoal,
          studyGoalType: studyGoalType || undefined,
          preferredStudyRegion: preferredStudyRegion || undefined,
          preferredSchoolType: preferredSchoolType || undefined,
          schoolPriority,
          tuitionBudgetVnd: tuitionBudgetVnd ? Number(tuitionBudgetVnd) : undefined,
          householdIncomeVnd: householdIncomeVnd ? Number(householdIncomeVnd) : undefined,
          chosenBlocks,
          chosenSubjects,
        },
      });
      setAnalyzing(true);
      setAnalyzeIndex(0);
      try {
        await apiRequest('/api/v1/career/ai/analyze', { method: 'POST', idempotencyKey: newIdempotencyKey('post-quiz'), body: { mode: 'post_quiz' } });
      } finally {
        // The task list is a truthful waiting indicator; only advance it when the backend returns.
        setAnalyzeIndex(ANALYZE_TASKS.length - 1);
      }
      setAnalyzing(false);
      setState('idle');
      navigate('/app/career-results');
    } catch (error) {
      setAnalyzing(false);
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa lưu được hồ sơ hoặc nhà trường chưa cấu hình AI.');
    }
  }

  const transition = reduce
    ? { duration: 0 }
    : { duration: DURATION.base, ease: EASE_OUT };

  return (
    <>
      <PageHeader
        eyebrow="Hướng nghiệp"
        title="Khám phá bản thân"
        lede="Lộ trình vàng có thể bỏ qua hầu hết bước. Kết quả SIMGR chỉ để tham khảo, không phải tư vấn tuyển sinh bắt buộc."
      />
      <PathwayStepper
        steps={pathwaySteps}
        current={step}
        onSelect={setStep}
      />
      {message && <p className={`form-message ${state === 'error' ? 'is-error' : 'is-success'}`} role="status">{message}</p>}

      <div className="quiz-step-stage">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={step}
          className="quiz-step-panel"
          layout={false}
          initial={reduce ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? undefined : { opacity: 0, x: -12, transition: { duration: DURATION.exit, ease: EASE_IN } }}
          transition={transition}
        >
          {step === 0 && (
            <section className="workspace-feature">
              <h2>Em làm gì trước?</h2>
              <ol>
                <li>Năng lực: 20 câu tư duy (5 dễ, 5 trung bình, 10 khó; có câu giải thích).</li>
                <li>Holland / RIASEC — nhóm tính cách nghề, không gọi là sở thích tự do.</li>
                <li>Hoạt động &amp; trải nghiệm dạng chat, rồi tối đa 5 câu hỏi thêm.</li>
                <li>Điểm học trên lớp (prefill học bạ), tách với môn thi tốt nghiệp và tổ hợp ĐH.</li>
                <li>Hồ sơ: tỉnh và mục tiêu là bắt buộc khi xem kết quả.</li>
              </ol>
              <div className="quiz-actions">
                <button className="button button-primary" type="button" onClick={() => setStep(1)}>Bắt đầu</button>
                <button className="button button-quiet" type="button" onClick={() => skipTo(5)}>Bỏ qua tới hồ sơ</button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="workspace-feature aptitude-frame" aria-labelledby="aptitude-title">
              <h2 id="aptitude-title">Năng lực SCDP</h2>
              <p>Một câu một khung. Em có thể bỏ qua câu hoặc cả bước.</p>
              {currentAptitude ? (
                <>
                  <p className="eyebrow">{aptitudeTrack} · Câu {trackIndex + 1}/{trackQuestions.length || 20} · {currentAptitude.difficulty === 'EASY' ? 'Dễ' : currentAptitude.difficulty === 'MEDIUM' ? 'Trung bình' : 'Khó'}</p>
                  <div className="aptitude-progress" aria-hidden="true">
                    <motion.span animate={{ scaleX: trackQuestions.length ? (trackIndex + 1) / trackQuestions.length : 0 }} style={{ transformOrigin: 'left center' }} />
                  </div>
                  <p>{currentAptitude.prompt}</p>
                  {(currentAptitude.kind ?? 'mcq') === 'essay' || currentAptitude.choices.length === 0 ? (
                    <label>
                      Bài làm (tối đa 800 ký tự)
                      <textarea
                        rows={6}
                        maxLength={800}
                        value={String(aptitudeAnswers[currentAptitude.id] ?? '')}
                        onChange={(event) => setAptitudeAnswers((current) => ({ ...current, [currentAptitude.id]: event.target.value }))}
                      />
                    </label>
                  ) : (
                    <LetterChoice
                      name={currentAptitude.id}
                      choices={currentAptitude.choices}
                      value={typeof aptitudeAnswers[currentAptitude.id] === 'number' ? aptitudeAnswers[currentAptitude.id] as number : null}
                      onChange={(index) => setAptitudeAnswers((current) => ({ ...current, [currentAptitude.id]: index }))}
                    />
                  )}
                  <div className="quiz-actions">
                    <button className="button button-quiet" type="button" disabled={aptitudeIndex === 0} onClick={() => setAptitudeIndex((value) => Math.max(0, value - 1))}>Câu trước</button>
                    <button className="button button-quiet" type="button" disabled={aptitudeIndex >= aptitudeQuestions.length - 1} onClick={() => setAptitudeIndex((value) => Math.min(aptitudeQuestions.length - 1, value + 1))}>Câu tiếp</button>
                     <button className="button button-quiet" type="button" onClick={() => { if (currentAptitude) setAptitudeSkipped((current) => current.includes(currentAptitude.id) ? current : [...current, currentAptitude.id]); setAptitudeIndex((value) => Math.min(aptitudeQuestions.length - 1, value + 1)); }}>Bỏ qua câu</button>
                     <button className="button button-primary" type="button" disabled={state === 'sending' || !aptitudeComplete} onClick={() => void submitAptitude()}>Lưu năng lực</button>
                    <button className="button button-quiet" type="button" onClick={skipCurrent}>Bỏ qua bước này</button>
                  </div>
                </>
              ) : (
                <p>Đang tải câu hỏi… <button className="button button-quiet" type="button" onClick={skipCurrent}>Bỏ qua bước này</button></p>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="workspace-feature" aria-labelledby="riasec-title">
              <h2 id="riasec-title">Holland / RIASEC</h2>
              <p>Chọn mức 1–5. Bỏ trống cả bước vẫn xem được gợi ý nghề.</p>
              {hollandItems.map((item) => (
                <fieldset key={item.id} style={{ border: 0, padding: 0, margin: '0 0 1rem' }}>
                  <legend>{item.text}</legend>
                  <div className="likert-row" role="radiogroup" aria-label={item.text}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`likert-btn${riasecAnswers[item.id] === value ? ' is-on' : ''}`}
                        aria-pressed={riasecAnswers[item.id] === value}
                        aria-label={`${value} · ${LIKERT[value - 1]}`}
                        onClick={() => setRiasecAnswers((current) => ({ ...current, [item.id]: value }))}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="quiz-actions">
                <button className="button button-primary" type="button" disabled={state === 'sending'} onClick={() => void submitRiasec()}>Lưu Holland / RIASEC</button>
                <button className="button button-quiet" type="button" onClick={skipCurrent}>Bỏ qua bước này</button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="workspace-feature">
                <h2>Hoạt động &amp; trải nghiệm</h2>
              <p className="muted-copy">{extraCounter}. Chat lần lượt; không hiện JSON.</p>
              <ChatShell
                messages={interview}
                sending={interviewSending}
                onSend={sendInterview}
                placeholder="Kể một hoạt động cụ thể…"
                submitLabel="Gửi"
                footerNote={<p className="muted-copy">AI chỉ trích hoạt động, không chấm điểm tự do.</p>}
              />
              <div className="quiz-actions">
                {!extraDone && <button className="button button-quiet" type="button" onClick={() => void finishExtra(extraAnswers)}>Kết thúc sớm</button>}
                <button className="button button-primary" type="button" onClick={() => setStep(4)}>Tiếp tục điểm học</button>
                <button className="button button-quiet" type="button" onClick={skipCurrent}>Bỏ qua bước này</button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="workspace-feature">
              <h2>Điểm học trên lớp</h2>
              <p>Điểm học lớp, không phải tổ hợp ĐH. Ô đã có số lấy từ học bạ/sổ điểm; em chỉ điền chỗ trống.</p>
              {Object.keys(prefillGrades).length > 0 && (
                <div className="grade-chip-row">
                  {SUBJECTS.filter((subject) => Number.isFinite(prefillGrades[subject.id])).map((subject) => (
                    <GradeChip key={subject.id} code={subject.id} score={prefillGrades[subject.id]!} />
                  ))}
                </div>
              )}
              {emptyGradeSubjects.length === 0 ? (
                <p>Học bạ đã đủ môn GDPT. Em có thể sang hồ sơ.</p>
              ) : (
                <form className="login-form" onSubmit={(event) => void submitGrades(event)}>
                  {emptyGradeSubjects.map((subject) => (
                    <div key={subject.id}>
                      <label htmlFor={`grade-${subject.id}`}>{subject.label}</label>
                      <input id={`grade-${subject.id}`} name={subject.id} type="number" min={0} max={10} step={0.1} />
                    </div>
                  ))}
                  <button className="button button-primary" type="submit" disabled={state === 'sending'}>Lưu điểm học</button>
                </form>
              )}
              <div className="quiz-actions">
                <button className="button button-quiet" type="button" onClick={skipCurrent}>Bỏ qua bước này</button>
                {emptyGradeSubjects.length === 0 && <button className="button button-primary" type="button" onClick={() => setStep(5)}>Sang hồ sơ</button>}
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="workspace-feature" aria-labelledby="consent-title">
              <h2 id="consent-title">Hồ sơ &amp; chia sẻ</h2>
              <p>Mặc định hồ sơ của em là riêng tư. Cần tỉnh và mục tiêu để xem kết quả.</p>
              <form className="login-form" onSubmit={(event) => { event.preventDefault(); void saveProfileAndAnalyze(); }}>
                <label htmlFor="province">Tỉnh/thành</label>
                <select id="province" value={province} onChange={(event) => setProvince(event.target.value)} required>
                  <option value="">Chọn tỉnh</option>
                  {VIETNAM_PROVINCES.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <label htmlFor="studyGoal">Mục tiêu học tập (tùy chọn)</label>
                <input id="studyGoal" value={studyGoal} onChange={(event) => setStudyGoal(event.target.value)} maxLength={240} />
                <label htmlFor="studyGoalType">Loại mục tiêu</label>
                <select id="studyGoalType" value={studyGoalType} onChange={(event) => setStudyGoalType(event.target.value as Draft['studyGoalType'])}>
                  <option value="">Chưa chọn</option>
                  <option value="career">Theo nghề</option>
                  <option value="school">Theo trường</option>
                  <option value="undecided">Chưa quyết</option>
                </select>
                <label htmlFor="preferredStudyRegion">Vùng học</label>
                <select id="preferredStudyRegion" value={preferredStudyRegion} onChange={(event) => setPreferredStudyRegion(event.target.value as Draft['preferredStudyRegion'])}>
                  <option value="">Chưa chọn</option>
                  <option value="near_home">Gần nhà</option>
                  <option value="same_region">Cùng miền</option>
                  <option value="nationwide">Toàn quốc</option>
                </select>
                <label htmlFor="preferredSchoolType">Loại trường</label>
                <select id="preferredSchoolType" value={preferredSchoolType} onChange={(event) => setPreferredSchoolType(event.target.value as Draft['preferredSchoolType'])}>
                  <option value="">Chưa chọn</option>
                  <option value="any">Bất kỳ</option>
                  <option value="public">Công lập</option>
                  <option value="private">Tư thục</option>
                  <option value="international">Quốc tế</option>
                </select>
                <label htmlFor="tuitionBudgetVnd">Học phí tối đa (VND / năm)</label>
                <input id="tuitionBudgetVnd" type="number" min={0} value={tuitionBudgetVnd} onChange={(event) => setTuitionBudgetVnd(event.target.value)} />
                <label htmlFor="householdIncomeVnd">Thu nhập hộ (tùy chọn)</label>
                <input id="householdIncomeVnd" type="number" min={0} value={householdIncomeVnd} onChange={(event) => setHouseholdIncomeVnd(event.target.value)} />
                <fieldset>
                  <legend>Môn em có thể thi (tùy chọn)</legend>
                  {SUBJECTS.map((subject) => (
                    <label key={subject.id} className="exam-block-option">
                      <input
                        type="checkbox"
                        checked={chosenSubjects.includes(subject.id)}
                        onChange={(event) => setChosenSubjects((current) => event.target.checked ? [...current, subject.id] : current.filter((item) => item !== subject.id))}
                      />
                      <span><strong>{subject.label}</strong><small>Để hệ thống tự tìm tổ hợp phù hợp</small></span>
                    </label>
                  ))}
                </fieldset>
                <div className="priority-sliders">
                  {PRIORITY_KEYS.map((item) => (
                    <label key={item.id} htmlFor={`prio-${item.id}`}>
                      {item.label}: {schoolPriority[item.id] ?? 3}/5
                      <input
                        id={`prio-${item.id}`}
                        type="range"
                        min={1}
                        max={5}
                        value={schoolPriority[item.id] ?? 3}
                        onChange={(event) => setSchoolPriority((current) => ({ ...current, [item.id]: Number(event.target.value) }))}
                      />
                    </label>
                  ))}
                </div>
                <p className="muted-copy profile-visibility-note">Phạm vi xem hồ sơ được nhà trường quản lý theo phân quyền nội bộ; em không cần bật công tắc thủ công.</p>
                {analyzing && <AnalyzeProgress tasks={ANALYZE_TASKS} currentIndex={analyzeIndex} />}
                <button className="button button-primary" type="submit" disabled={state === 'sending' || analyzing || !hasMinimumProfile}>
                  {analyzing ? 'Đang phân tích…' : 'Lưu hồ sơ và xem kết quả'}
                </button>
              </form>
              {recommendations && hasMinimumProfile && (
                <p><Link className="button button-quiet" to="/app/career-results">Xem kết quả SIMGR đã có</Link></p>
              )}
            </section>
          )}
        </motion.div>
      </AnimatePresence>
      </div>
    </>
  );
}
