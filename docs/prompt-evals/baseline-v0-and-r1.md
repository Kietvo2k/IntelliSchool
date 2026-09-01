# Baseline và revision prompt IntelliSchool

Tool: `senior-prompt-engineer/scripts/prompt_optimizer.py --analyze --json`.
Baseline v0 được đo trước khi thêm Output Format; R1 là prompt hiện tại.

| Prompt | v0 token/clarity/structure | R1 token/clarity/structure | Kết quả |
| --- | --- | --- | --- |
| 01 UI | 662 / 92 / 75 | 712 / 92 / 90 | PASS, +7,6% token |
| 02 Backend | 617 / 92 / 75 | 668 / 92 / 90 | PASS, +8,3% token |
| 03 AI | 594 / 95 / 75 | 650 / 95 / 90 | PASS, +9,4% token |
| 04 Release | 484 / 95 / 75 | 519 / 95 / 90 | PASS, +7,2% token |

R1 vượt structure và đã có Output Format. Mọi prompt đều giữ mức tăng token
không quá 10% so với baseline v0.

Không thêm few-shot ví dụ: eval set chưa cho thấy failure cluster cần ví dụ và
prompt action cần giữ ngắn. Có hai warning redundancy không ảnh hưởng contract:
cụm rebrand ở Phase 01 và branch revamp ở Phase 02.

## Gate tiếp theo

Trước mỗi lần sửa prompt, chạy lại analyzer, so với bảng này và retest 14 case
trong `phase-prompt-eval-set.md`; không được mất case pass trước đó.
