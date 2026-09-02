# AI study UI and response limits — 2026-09-02

## Thay đổi

- UI học sinh không còn hiển thị banner provider/model/token/request sau response thành công.
- UI học sinh không còn hiển thị block `KẾT QUẢ CHẠY`; tool trace vẫn chạy server-side.
- `AI_TIMEOUT_MS` local là 120 giây; provider adapter vẫn hard cap 120 giây.
- `AI_MAX_OUTPUT_TOKENS` local là 4.000; provider config vẫn hard cap 12.000 token.

## Evidence

- UI live sau request đạo hàm: không có `Provider:`, `Token:`, `Request:` hoặc `KẾT QUẢ CHẠY`.
- Provider/model/usage/request ID vẫn được ghi trong `ai_usage_logs` và admin audit log.
- `npm run verify`: API 234 pass, 1 skip; web 64 pass; exit 0.
- Container `smartclass-platform-app-1`: healthy, web port `5176`.
