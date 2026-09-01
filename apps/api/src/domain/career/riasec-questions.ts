/** 30 câu RIASEC (5 câu mỗi chiều). Port nội dung SCDP, không đọc path gốc lúc runtime. */
export interface RiasecQuestion {
  id: string;
  text: string;
  group: 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
}

export const RIASEC_QUESTIONS: readonly RiasecQuestion[] = [
  { id: 'R1', group: 'R', text: 'Em thích làm việc với máy móc, công cụ hoặc thiết bị kỹ thuật.' },
  { id: 'R2', group: 'R', text: 'Em thích các hoạt động ngoài trời và công việc chân tay.' },
  { id: 'R3', group: 'R', text: 'Em có khả năng sửa chữa hoặc lắp ráp đồ vật.' },
  { id: 'R4', group: 'R', text: 'Em thích công việc đòi hỏi kỹ năng thực hành cụ thể hơn là lý thuyết.' },
  { id: 'R5', group: 'R', text: 'Em cảm thấy thoải mái khi làm việc trong môi trường mang tính chất vật lý.' },
  { id: 'I1', group: 'I', text: 'Em thích tìm hiểu nguyên nhân và cách thức hoạt động của sự vật.' },
  { id: 'I2', group: 'I', text: 'Em thích giải quyết các bài toán phức tạp hoặc câu đố logic.' },
  { id: 'I3', group: 'I', text: 'Em thích đọc sách và nghiên cứu các chủ đề khoa học.' },
  { id: 'I4', group: 'I', text: 'Em có xu hướng phân tích dữ liệu và tìm ra quy luật.' },
  { id: 'I5', group: 'I', text: 'Em thích làm thí nghiệm hoặc kiểm tra giả thuyết.' },
  { id: 'A1', group: 'A', text: 'Em thích sáng tạo và thể hiện bản thân qua nghệ thuật.' },
  { id: 'A2', group: 'A', text: 'Em thích thiết kế, vẽ vời hoặc viết lách.' },
  { id: 'A3', group: 'A', text: 'Em coi trọng cái đẹp và sự độc đáo trong công việc.' },
  { id: 'A4', group: 'A', text: 'Em thích làm việc trong môi trường tự do, không gò bó.' },
  { id: 'A5', group: 'A', text: 'Em có trí tưởng tượng phong phú và thích nghĩ ra ý tưởng mới.' },
  { id: 'S1', group: 'S', text: 'Em thích giúp đỡ và hỗ trợ người khác.' },
  { id: 'S2', group: 'S', text: 'Em thích làm việc nhóm và giao tiếp với mọi người.' },
  { id: 'S3', group: 'S', text: 'Em thích dạy học, tư vấn hoặc chăm sóc người khác.' },
  { id: 'S4', group: 'S', text: 'Em dễ đồng cảm và thấu hiểu cảm xúc của người khác.' },
  { id: 'S5', group: 'S', text: 'Em thích tham gia các hoạt động cộng đồng và xã hội.' },
  { id: 'E1', group: 'E', text: 'Em thích lãnh đạo và dẫn dắt nhóm.' },
  { id: 'E2', group: 'E', text: 'Em thích thuyết phục và đàm phán với người khác.' },
  { id: 'E3', group: 'E', text: 'Em thích cạnh tranh và đạt được mục tiêu kinh doanh.' },
  { id: 'E4', group: 'E', text: 'Em tự tin khi nói trước đám đông và trình bày ý tưởng.' },
  { id: 'E5', group: 'E', text: 'Em thích khởi xướng dự án và chấp nhận rủi ro có tính toán.' },
  { id: 'C1', group: 'C', text: 'Em thích làm việc theo quy trình và hệ thống rõ ràng.' },
  { id: 'C2', group: 'C', text: 'Em chú trọng đến chi tiết và độ chính xác trong công việc.' },
  { id: 'C3', group: 'C', text: 'Em thích tổ chức và sắp xếp dữ liệu, hồ sơ.' },
  { id: 'C4', group: 'C', text: 'Em thích công việc ổn định và có cấu trúc.' },
  { id: 'C5', group: 'C', text: 'Em có khả năng quản lý thời gian và tuân thủ thời hạn.' },
];
