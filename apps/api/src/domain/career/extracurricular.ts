export interface ExtracurricularQuestion {
  id: string;
  text: string;
  category: string;
}

export const EXTRACURRICULAR_QUESTIONS: readonly ExtracurricularQuestion[] = [
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
