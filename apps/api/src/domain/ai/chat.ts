/**
 * Chính sách trả lời AI dạng LAI (hybrid), thuần (không pg/mạng):
 *  - Có tài liệu liên quan → trả lời BÁM NGỮ CẢNH và trích dẫn (GROUNDED).
 *  - Không có tài liệu → cho phép trả lời bằng kiến thức chung nhưng GẮN NHÃN rõ ràng (GENERAL),
 *    tránh siết quá mức gây từ chối/hallucination như yêu cầu của người dùng.
 *  - Có ý định xin đáp án bài đang mở → từ chối và hướng dẫn cách học (REFUSED) — xử lý ở tầng gọi.
 *
 * Có sẵn fallback TRÍCH XUẤT cục bộ để chat chạy/test được local khi CHƯA cấu hình model sinh văn bản.
 */
export type AiAnswerMode = 'GROUNDED' | 'GENERAL' | 'REFUSED';

export interface ChatCitation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  ordinal: number;
  score: number;
  snippet: string;
}

export function decideMode(citations: readonly ChatCitation[]): Exclude<AiAnswerMode, 'REFUSED'> {
  return citations.length > 0 ? 'GROUNDED' : 'GENERAL';
}

const GROUNDED_SYSTEM = [
  'Bạn là AI học tập của một trường học Việt Nam.',
  'Ưu tiên TUYỆT ĐỐI trả lời dựa trên phần "NGỮ CẢNH" được cung cấp và trích dẫn nguồn theo dạng [1], [2].',
  'Nếu ngữ cảnh không đủ, được phép bổ sung kiến thức phổ thông nhưng phải nói rõ phần nào là kiến thức chung.',
  'Không bịa số liệu, không bịa nguồn. Trả lời ngắn gọn, đúng trọng tâm, bằng tiếng Việt.',
  'Không đưa đáp án trực tiếp cho bài kiểm tra/bài tập đang mở; thay vào đó hướng dẫn cách làm.',
].join(' ');

const GENERAL_SYSTEM = [
  'Bạn là AI học tập của một trường học Việt Nam.',
  'Không có tài liệu nội bộ liên quan, hãy trả lời bằng kiến thức phổ thông đáng tin cậy và NÓI RÕ đây là kiến thức chung, không trích từ tài liệu của trường.',
  'Không bịa số liệu hay nguồn cụ thể. Trả lời ngắn gọn, chính xác, bằng tiếng Việt.',
  'Không đưa đáp án trực tiếp cho bài kiểm tra/bài tập đang mở; thay vào đó hướng dẫn cách làm.',
].join(' ');

export const TEACHER_COMPOSE_SYSTEM = [
  'Bạn là AI soạn đề theo chuẩn thi tốt nghiệp THPT (QĐ 764): trắc nghiệm 4 phương án; đúng/sai 4 ý; trả lời ngắn điền số; tự luận.',
  'LUÔN hỏi ý kiến giáo viên trước khi sinh câu: môn, chương, số câu từng loại, độ khó. Tổng số câu tối thiểu 5.',
  'Khi giáo viên đã xác nhận, trả về JSON trong khối ```json với mảng questions (type, prompt, answerKey, maxScore) rồi giải thích ngắn.',
  'Không tự xuất bản đề. Viết tiếng Việt.',
].join(' ');

export const PERSONAL_STUDY_SYSTEM = [
  'Bạn là AI học tập cá nhân của học sinh Việt Nam, giống trợ lý trò chuyện: giải thích, luyện tập, soạn bài, chạy ví dụ trong sandbox khi được yêu cầu.',
  'Không đưa đáp án trực tiếp cho bài kiểm tra đang mở. Trả lời rõ, có bước, tiếng Việt.',
].join(' ');

export const CAREER_CHAT_SYSTEM = [
  'Bạn tư vấn hướng nghiệp dựa trên hồ sơ học sinh và danh mục trường/ngành. Không cam kết đỗ. Tiếng Việt, trung thực về dữ liệu thiếu.',
].join(' ');

export function buildSystemPrompt(mode: Exclude<AiAnswerMode, 'REFUSED'>, purpose?: string): string {
  if (purpose === 'TEACHER_COMPOSE') return TEACHER_COMPOSE_SYSTEM;
  if (purpose === 'PERSONAL_STUDY') return PERSONAL_STUDY_SYSTEM;
  if (purpose === 'CAREER_CHAT' || purpose === 'EXTRACURRICULAR_INTERVIEW') return CAREER_CHAT_SYSTEM;
  return mode === 'GROUNDED' ? GROUNDED_SYSTEM : GENERAL_SYSTEM;
}

export function buildContextBlock(citations: readonly ChatCitation[]): string {
  if (citations.length === 0) return '';
  const lines = citations.map((citation, index) => `[${index + 1}] (${citation.documentTitle}) ${citation.snippet}`);
  return `NGỮ CẢNH:\n${lines.join('\n')}`;
}

/** Ghép prompt người dùng với ngữ cảnh (nếu có) để gửi cho model. */
export function buildUserPrompt(question: string, citations: readonly ChatCitation[]): string {
  const context = buildContextBlock(citations);
  return context ? `${context}\n\nCÂU HỎI: ${question}` : question;
}

/**
 * Trả lời trích xuất cục bộ khi chưa có model sinh văn bản: ghép các đoạn liên quan nhất và
 * gắn nhãn rõ ràng. Bảo đảm endpoint chat vẫn hữu ích và test được local.
 */
export function buildExtractiveAnswer(citations: readonly ChatCitation[]): string {
  if (citations.length === 0) {
    return 'Chưa cấu hình model sinh văn bản và không tìm thấy tài liệu liên quan trong phạm vi lớp/môn. Vui lòng nạp tài liệu hoặc cấu hình model AI trong phần Cài đặt AI.';
  }
  const top = citations.slice(0, 3);
  const body = top.map((citation, index) => `• [${index + 1}] ${citation.snippet}`).join('\n');
  return `Trả lời trích xuất từ tài liệu của trường (chưa dùng model sinh văn bản):\n${body}`;
}

export function looksLikeComposeConfirm(message: string): boolean {
  return /xác nhận|xac nhan|sinh đề|sinh de|điền khung|dien khung|tạo đề|tao de|\d+\s*(trắc|tn|mcq|đúng|dung|ngắn|ngan|tự luận|tu luan)/i.test(message);
}

export function parseComposeCounts(message: string): { mcq: number; tf: number; short: number; essay: number } {
  const pick = (pattern: RegExp, fallback: number) => {
    const match = message.match(pattern);
    const value = match ? Number(match[1]) : Number.NaN;
    return Number.isFinite(value) && value >= 0 ? Math.min(20, Math.floor(value)) : fallback;
  };
  const counts = {
    mcq: pick(/(\d+)\s*(trắc|tn|mcq)/i, 2),
    tf: pick(/(\d+)\s*(đúng|dung|tf)/i, 1),
    short: pick(/(\d+)\s*(ngắn|ngan|số|numeric)/i, 1),
    essay: pick(/(\d+)\s*(tự luận|tu luan|essay)/i, 1),
  };
  const total = counts.mcq + counts.tf + counts.short + counts.essay;
  if (total < 5) counts.mcq += 5 - total;
  return counts;
}

export function buildComposeQuestions(counts: { mcq: number; tf: number; short: number; essay: number }): Array<Record<string, unknown>> {
  const questions: Array<Record<string, unknown>> = [];
  for (let index = 0; index < counts.mcq; index += 1) {
    questions.push({
      type: 'MULTIPLE_CHOICE',
      maxScore: 0.25,
      prompt: { text: `Câu trắc nghiệm ${index + 1}: đạo hàm của x² bằng?`, choices: ['x', '2x', 'x²', '2'] },
      answerKey: { choice: '2x' },
      rubric: {},
    });
  }
  for (let index = 0; index < counts.tf; index += 1) {
    questions.push({
      type: 'TRUE_FALSE',
      maxScore: 1,
      prompt: {
        stem: `Câu đúng/sai ${index + 1}: cho y = x².`,
        statements: [
          { key: 'a', text: 'Đạo hàm bằng 2x.' },
          { key: 'b', text: 'Hàm nghịch biến trên (0; +∞).' },
          { key: 'c', text: 'Đồ thị nhận Oy làm trục.' },
          { key: 'd', text: 'y′(1) = 2.' },
        ],
      },
      answerKey: { values: { a: true, b: false, c: true, d: true } },
      rubric: {},
    });
  }
  for (let index = 0; index < counts.short; index += 1) {
    questions.push({
      type: 'SHORT_ANSWER',
      maxScore: 0.5,
      prompt: { text: `Câu trả lời ngắn ${index + 1}: tính y′(2) với y = x².` },
      answerKey: { numeric: '4' },
      rubric: {},
    });
  }
  for (let index = 0; index < counts.essay; index += 1) {
    questions.push({
      type: 'ESSAY',
      maxScore: 2,
      prompt: { text: `Câu tự luận ${index + 1}: trình bày ý nghĩa hình học của đạo hàm.` },
      answerKey: {},
      rubric: { criteria: [{ label: 'Lập luận', maxScore: 2, description: 'Đúng ý, đủ ý.' }] },
    });
  }
  return questions;
}

export function composeFallback(purpose: string | undefined, citations: readonly ChatCitation[], userMessage = ''): string {
  if (purpose === 'TEACHER_COMPOSE') {
    if (looksLikeComposeConfirm(userMessage)) {
      const questions = buildComposeQuestions(parseComposeCounts(userMessage));
      return `Đã điền khung theo số câu đã chọn. Kiểm tra rồi lưu vào ngân hàng — không tự xuất bản.\n\n\`\`\`json\n${JSON.stringify({ questions }, null, 2)}\n\`\`\``;
    }
    return 'Trước khi sinh đề, cho mình biết: môn và chương; số câu trắc nghiệm (4 phương án); đúng/sai 4 ý; trả lời ngắn (điền số); tự luận; độ khó. Tổng tối thiểu 5 câu. Khi thầy/cô xác nhận, mình sẽ điền vào khung soạn — không tự xuất bản.';
  }
  if (purpose === 'PERSONAL_STUDY') {
    return citations.length > 0
      ? buildExtractiveAnswer(citations)
      : 'Em hỏi khái niệm hoặc bước làm; mình gợi ý cách học, không đưa đáp án đề đang mở.';
  }
  if (purpose === 'EXTRACURRICULAR_INTERVIEW') {
    return 'Em kể thêm một hoạt động cụ thể (thời gian, vai trò, kết quả) được không?';
  }
  if (purpose === 'CAREER_CHAT') {
    return 'Mình tư vấn hướng nghiệp tham khảo, không cam kết đỗ. Hãy nói ngành hoặc trường em đang nghĩ; dữ liệu catalog có thể chưa đủ năm 2024–2026.';
  }
  return buildExtractiveAnswer(citations);
}

export const ANSWER_FISHING_RESPONSE =
  'Mình không cung cấp đáp án trực tiếp cho bài kiểm tra/bài tập đang mở. Hãy nói rõ chỗ em đang mắc, mình sẽ gợi ý hướng làm và kiến thức liên quan để em tự giải nhé.';
