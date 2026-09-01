# Port SCDP + phòng thi CBT — thiết kế

Ngày: 2026-08-25. Nguồn SCDP chỉ đọc. Kit giấy–xanh Smart Path.

## LLM

Key không vào DB. Env: `AI_PROVIDER`, `AI_OPENAI_BASE_URL` (`/v1`), `AI_OPENAI_API_KEY`, `AI_OPENAI_MODEL`, `AI_ANTHROPIC_BASE_URL`, `AI_ANTHROPIC_API_KEY`, `AI_ANTHROPIC_MODEL`. Alias cũ `AI_BASE_URL` / `AI_API_KEY` vẫn đọc.

## Ba lớp môn

1. LMS: môn GDPT 2018 (`MATH`, `LIT`, `ENG`, …).
2. Thi TN: 4 môn (Văn, Toán + 2 tự chọn) — `exam_records.source = GRADUATION`.
3. Tổ hợp ĐH: 98 mã 2025 + CSV nhận `^[A-Z][0-9]{2}$`. Mỗi ngành–trường nhiều block (`institution_major_exam_blocks`).

## Gói trường

`TRIAL`/`ACTIVE`/`FREE`: đủ quiz, AI, phòng thi. `SUSPENDED`: catalog + kết quả đã lưu.

## Phòng thi

`delivery_mode = EXAM`. Chrome `.cbt-*` chỉ `/app/exam/*`. Timer server, autosave, integrity log. Không webcam, không giả danh Bộ.
