/** Bộ 20 câu tư duy phiên bản 2026.1; ẩn correctIndex qua publicAptitudeQuestions. */
export type AptitudeDimension = 'numerical' | 'verbal' | 'logical' | 'spatial' | 'social';
export type AptitudeTrack = 'iq' | 'eq';
export type AptitudeKind = 'mcq' | 'essay';
export type AptitudeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export const APTITUDE_DIMENSIONS: readonly AptitudeDimension[] = ['numerical', 'verbal', 'logical', 'spatial', 'social'];

export interface AptitudeQuestion {
  id: string;
  dimension: AptitudeDimension;
  track: AptitudeTrack;
  kind: AptitudeKind;
  difficulty: AptitudeDifficulty;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export const APTITUDE_QUESTIONS: readonly AptitudeQuestion[] = [
  { id: 'E1', dimension: 'numerical', track: 'iq', kind: 'mcq', difficulty: 'EASY', prompt: 'Dãy 3, 6, 11, 18, 27, … có số hạng tiếp theo là?', choices: ['36', '38', '39', '42'], correctIndex: 1 },
  { id: 'E2', dimension: 'logical', track: 'iq', kind: 'mcq', difficulty: 'EASY', prompt: 'Mọi hình vuông là hình chữ nhật. Hình nào chắc chắn là hình chữ nhật?', choices: ['Mọi hình vuông', 'Mọi hình thoi', 'Mọi hình bình hành', 'Mọi hình tròn'], correctIndex: 0 },
  { id: 'E3', dimension: 'verbal', track: 'iq', kind: 'mcq', difficulty: 'EASY', prompt: '“Bản đồ” quan hệ với “định hướng” như “từ điển” quan hệ gần nhất với?', choices: ['Phát âm', 'Tra cứu', 'Ghi nhớ', 'Dịch chuyển'], correctIndex: 1 },
  { id: 'E4', dimension: 'spatial', track: 'iq', kind: 'mcq', difficulty: 'EASY', prompt: 'Một khối lập phương có 3 mặt kề nhau được tô đỏ. Số mặt không tô đỏ là?', choices: ['1', '2', '3', '4'], correctIndex: 2 },
  { id: 'E5', dimension: 'numerical', track: 'iq', kind: 'mcq', difficulty: 'EASY', prompt: 'Một đội có 5 bạn. Mỗi bạn bắt tay đúng một lần với mọi bạn khác. Có bao nhiêu cái bắt tay?', choices: ['5', '8', '10', '20'], correctIndex: 2 },
  { id: 'M1', dimension: 'numerical', track: 'iq', kind: 'mcq', difficulty: 'MEDIUM', prompt: 'Một số có hai chữ số. Đổi chỗ hai chữ số thì số mới lớn hơn số cũ 27, tổng hai chữ số là 9. Số ban đầu là?', choices: ['27', '36', '45', '63'], correctIndex: 1 },
  { id: 'M2', dimension: 'logical', track: 'iq', kind: 'mcq', difficulty: 'MEDIUM', prompt: 'Bốn bạn A, B, C, D xếp hàng. A đứng trước B, C không đứng đầu, D đứng sau B. Ai có thể đứng thứ hai?', choices: ['A', 'B', 'C', 'D'], correctIndex: 1 },
  { id: 'M3', dimension: 'verbal', track: 'iq', kind: 'mcq', difficulty: 'MEDIUM', prompt: 'Nếu “tất cả P là Q” và “không có Q nào là R”, kết luận nào chắc chắn đúng?', choices: ['Một số P là R', 'Không có P nào là R', 'Mọi R là P', 'Một số Q không là P'], correctIndex: 1 },
  { id: 'M4', dimension: 'spatial', track: 'iq', kind: 'mcq', difficulty: 'MEDIUM', prompt: 'Một hình vuông xoay 90° quanh tâm rồi phản chiếu qua đường chéo chính. Hình thu được so với ban đầu là?', choices: ['Khác kích thước', 'Trùng khít', 'Bị kéo dài', 'Không còn là hình vuông'], correctIndex: 1 },
  { id: 'M5', dimension: 'logical', track: 'iq', kind: 'mcq', difficulty: 'MEDIUM', prompt: 'Ba hộp A, B, C có một hộp chứa phần thưởng. A nói “Phần thưởng không ở B”, B nói “Phần thưởng ở A”, C nói “B nói dối”. Chỉ một câu đúng. Phần thưởng ở đâu?', choices: ['A', 'B', 'C', 'Không xác định'], correctIndex: 1 },
  { id: 'H1', dimension: 'numerical', track: 'iq', kind: 'mcq', difficulty: 'HARD', prompt: 'Dãy số bắt đầu 2, 5, 10, 17, 26. Nếu quy luật tiếp tục, tổng hai số hạng kế tiếp là?', choices: ['73', '80', '87', '90'], correctIndex: 2 },
  { id: 'H2', dimension: 'logical', track: 'iq', kind: 'mcq', difficulty: 'HARD', prompt: 'Có 5 bài thuyết trình P, Q, R, S, T. P trước Q; R ngay sau S; T không đầu/cuối. Thứ tự nào hợp lệ?', choices: ['T-P-S-R-Q', 'P-T-Q-S-R', 'S-T-R-P-Q', 'Q-P-T-S-R'], correctIndex: 1 },
  { id: 'H3', dimension: 'verbal', track: 'iq', kind: 'mcq', difficulty: 'HARD', prompt: 'Mệnh đề “Nếu trời mưa thì sân ướt” đúng. Sân không ướt. Kết luận hợp lệ nhất là?', choices: ['Trời chắc chắn mưa', 'Trời không mưa', 'Sân vừa khô vừa ướt', 'Không thể kết luận'], correctIndex: 1 },
  { id: 'H4', dimension: 'spatial', track: 'iq', kind: 'mcq', difficulty: 'HARD', prompt: 'Một khối hộp 2×3×4 được chia thành các khối lập phương đơn vị. Số khối nằm trên đúng hai mặt ngoài là?', choices: ['8', '12', '16', '20'], correctIndex: 1 },
  { id: 'H5', dimension: 'numerical', track: 'iq', kind: 'mcq', difficulty: 'HARD', prompt: 'Một đồng hồ chạy nhanh 5 phút mỗi giờ. Sau khi chỉnh đúng lúc 8:00, đến khi đồng hồ chỉ 14:00 thì giờ thật là?', choices: ['13:25', '13:31', '13:32', '13:35'], correctIndex: 1 },
  { id: 'H6e', dimension: 'logical', track: 'iq', kind: 'essay', difficulty: 'HARD', prompt: 'Có 12 đồng xu, một đồng xu nhẹ hơn và không có cân chuẩn. Mô tả cách tìm đồng xu nhẹ bằng nhiều nhất ba lần cân đĩa.', choices: [], correctIndex: -1 },
  { id: 'H7e', dimension: 'numerical', track: 'iq', kind: 'essay', difficulty: 'HARD', prompt: 'Một xe đi nửa quãng đường đầu với vận tốc 30 km/h và nửa còn lại với 60 km/h. Giải thích vì sao vận tốc trung bình không phải 45 km/h và tính kết quả.', choices: [], correctIndex: -1 },
  { id: 'H8e', dimension: 'verbal', track: 'iq', kind: 'essay', difficulty: 'HARD', prompt: 'Phân biệt “điều kiện cần” và “điều kiện đủ” bằng một ví dụ tự tạo. Nêu rõ mệnh đề đảo có đúng hay không.', choices: [], correctIndex: -1 },
  { id: 'H9e', dimension: 'spatial', track: 'iq', kind: 'essay', difficulty: 'HARD', prompt: 'Một hình lập phương 4×4×4 được sơn toàn bộ mặt ngoài rồi cắt thành khối nhỏ. Trình bày cách đếm số khối có đúng một mặt được sơn.', choices: [], correctIndex: -1 },
  { id: 'H10e', dimension: 'logical', track: 'iq', kind: 'essay', difficulty: 'HARD', prompt: 'Bốn người cần qua cầu ban đêm với một đèn pin; thời gian lần lượt 1, 2, 7, 10 phút và mỗi lượt tối đa hai người. Tìm thời gian nhỏ nhất và giải thích từng bước.', choices: [], correctIndex: -1 },
];

const QUESTION_BY_ID = new Map(APTITUDE_QUESTIONS.map((question) => [question.id, question]));

export type AptitudeScores = Record<AptitudeDimension, number> & { pendingEssay?: boolean };

export interface ScoreAptitudeOptions {
  essayScores?: Record<string, number>;
}

/** MCQ đúng/sai; essay lấy điểm 0..1 nếu có, không thì chưa tính vào chiều (pending). Chiều trống = 0.5. */
export function scoreAptitude(answers: Record<string, number | string>, options: ScoreAptitudeOptions = {}): AptitudeScores {
  const perDimension = Object.fromEntries(APTITUDE_DIMENSIONS.map((dimension) => [dimension, { points: 0, total: 0 }])) as Record<AptitudeDimension, { points: number; total: number }>;
  let pendingEssay = false;
  for (const [questionId, raw] of Object.entries(answers)) {
    const question = QUESTION_BY_ID.get(questionId);
    if (!question) continue;
    if (question.kind === 'mcq') {
      const choiceIndex = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= question.choices.length) {
        throw new Error(`Lựa chọn không hợp lệ cho câu ${questionId}`);
      }
      perDimension[question.dimension].total += 1;
      if (choiceIndex === question.correctIndex) perDimension[question.dimension].points += 1;
      continue;
    }
    const text = String(raw ?? '').trim();
    if (text.length === 0) continue;
    const scored = options.essayScores?.[questionId];
    if (typeof scored === 'number' && Number.isFinite(scored)) {
      perDimension[question.dimension].total += 1;
      perDimension[question.dimension].points += Math.max(0, Math.min(1, scored));
    } else {
      pendingEssay = true;
    }
  }
  const scores = Object.fromEntries(APTITUDE_DIMENSIONS.map((dimension) => {
    const bucket = perDimension[dimension];
    return [dimension, bucket.total === 0 ? 0.5 : bucket.points / bucket.total];
  })) as unknown as AptitudeScores;
  scores.pendingEssay = pendingEssay;
  return scores;
}

export function publicAptitudeQuestions(): Array<Omit<AptitudeQuestion, 'correctIndex'>> {
  return APTITUDE_QUESTIONS.map(({ correctIndex: _ignored, ...rest }) => rest);
}

export function aptitudeEssayPrompt(question: AptitudeQuestion): string {
  return [
    'Chấm bài tự luận năng lực học sinh THPT Việt Nam.',
    `Chiều: ${question.dimension}. Nhóm: ${question.track === 'iq' ? 'tư duy' : 'đời sống'}.`,
    `Câu hỏi: ${question.prompt}`,
    'Trả lời JSON: {"score":0.0,"rationale":"ngắn"}. score từ 0 đến 1. Không viết gì ngoài JSON.',
  ].join('\n');
}
