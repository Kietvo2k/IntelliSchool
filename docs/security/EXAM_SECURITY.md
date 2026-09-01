# Bảo mật đề thi và integrity CBT

## Quyết định

Phase 2 thay cơ chế ba strike bằng incident server-authoritative. Mục tiêu là
không phạt sai khi Chrome/password manager hoặc file picker gây tín hiệu ngắn,
nhưng vẫn chặn rời phòng thi kéo dài.

## State machine

\`\`\`text
ACTIVE
  └─ fullscreen/focus mất → GRACE (0–5s)
       ├─ khôi phục hợp lệ → ACTIVE, đóng incident
       └─ hết grace → WARNING (5–30s), UI hiện progress/countdown
            ├─ khôi phục hợp lệ → ACTIVE, giữ audit
            └─ đủ 30s liên tục → LOCKED
LOCKED
  └─ giám thị có quyền + lý do + idempotency → ACTIVE
\`\`\`

- Network loss và attachment picker có exemption server-issued không tạo incident.
- Tín hiệu blur/visibility/fullscreen cùng một đợt phải dùng một \`incidentId\`.
- Server tạo timestamp, \`graceEndsAt\` và \`lockAt\`; client chỉ hiển thị.
- LOCKED dừng chỉnh sửa nhưng **không tự nộp**. Đáp án đã lưu được giữ nguyên.
- Giám thị mở khóa phải kiểm assignment/role, ghi reason/audit và không xóa event.

## Hợp đồng API đích

- Integrity response: \`state\`, \`incidentId\`, \`graceEndsAt\`, \`lockAt\`,
  \`remainingMs\`, \`lockedAt\`, \`serverNow\`.
- API đóng incident khi focus/fullscreen phục hồi.
- \`POST /api/v1/exams/sessions/:id/unlock\`: yêu cầu reason, idempotency; chỉ
  proctor/teacher/owner có quyền trên ca thi.
- Heartbeat trả thêm server time và integrity snapshot; background finalizer khóa
  incident hết 30s ngay cả khi browser biến mất.

## Mã hóa exam snapshot

Khi publish exam, tạo snapshot bất biến chứa prompt, answer key và rubric dưới
AES-256-GCM. Snapshot lưu \`ciphertext\`, \`nonce\`, \`authTag\`, \`keyVersion\`, hash
metadata và reference assignment/version.

- Keyring nằm ngoài repo qua secret file/mount; \`.env.example\` chỉ chứa placeholder.
- Key version active dùng để encrypt; key cũ giữ read-only đến khi backfill/decrypt
  verification hoàn tất.
- Thiếu key, sai auth tag hoặc key version không hợp lệ phải fail-closed.
- API học sinh chỉ nhận prompt đã giải mã server-side cho session hợp lệ; không
  bao giờ nhận answer key/rubric.
- Migration forward-only, backfill idempotent, audit key rotation và test rollback.

## Kịch bản phải kiểm

4,9s grace, 5s warning, 29,9s còn mở, 30s lock, restore, duplicate signal,
network loss, attachment exemption, password-manager popup, proctor unlock, RLS
cross-tenant, ciphertext không lộ plaintext và key rotation.
