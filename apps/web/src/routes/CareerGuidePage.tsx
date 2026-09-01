import { PageHeader } from '../components/ui/PageHeader.js';

export function CareerGuidePage() {
  return (
    <>
      <PageHeader eyebrow="Hướng nghiệp" title="Bắt đầu đúng cách" lede="Em đi theo từng bước để nhận gợi ý có căn cứ. Kết quả là tham khảo, không thay thế quyết định của em, gia đình và thầy cô." />
      <section className="workspace-feature">
        <h2>Lộ trình 4 bước</h2>
        <ol>
          <li>Khám phá năng lực, RIASEC, hoạt động và điểm học trên lớp.</li>
          <li>Chọn nghề/ngành em muốn tìm hiểu; xem lý do và dữ liệu phía sau gợi ý.</li>
          <li>Chọn tổ hợp có đủ điểm, rồi lọc trường/ngành đang chấp nhận tổ hợp đó.</li>
          <li>Lưu nguyện vọng và tạo kế hoạch học; AI chỉ hỗ trợ giải thích và lập việc cần làm.</li>
        </ol>
      </section>
      <section className="workspace-feature">
        <h2>Ba loại điểm cần tách riêng</h2>
        <p><strong>Môn học:</strong> Toán, Văn, Anh, Sử, Lý, Hóa, Sinh, Địa, GDKTPL, Tin, Công nghệ trên LMS.</p>
        <p><strong>Thi tốt nghiệp:</strong> Văn + Toán bắt buộc và hai môn tự chọn.</p>
        <p><strong>Tổ hợp xét tuyển:</strong> từng ngành–trường công bố trong đề án; hệ thống ghi rõ mã, môn, năm và nguồn dữ liệu.</p>
      </section>
      <section className="workspace-feature">
        <h2>Lưu ý về dữ liệu</h2>
        <p>Điểm chuẩn và phương thức tuyển sinh có thể đổi theo năm. Khi thiếu nguồn hoặc thiếu điểm môn, hệ thống để trống thay vì đoán.</p>
        <p>Em có thể bỏ qua bước không muốn chia sẻ; chỉ tỉnh/thành và mục tiêu là bắt buộc để xếp hạng kết quả.</p>
      </section>
    </>
  );
}
