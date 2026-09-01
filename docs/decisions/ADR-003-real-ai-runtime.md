# ADR-003: AI production ưu tiên OpenAI-compatible

## Status

Accepted — 2026-09-01

## Context

AI đang có extractive/canned fallback và job worker lỗi; test mock không chứng minh
chat, RAG, compose, career hay Thinking hoạt động với provider thật.

## Decision

OpenAI-compatible là runtime chính. Provider status và response evidence là public
contract không lộ secret. Production path không giả kết quả khi key/provider thiếu;
mock chỉ giữ cho unit test. Tenant endpoint phải qua HTTPS allowlist.

## Consequences

- Release cần key/endpoint test thật và capability matrix.
- Structured output, RAG tenant filter, prompt injection/tool/cost guard trở thành
  requirement bắt buộc.
- Anthropic vẫn có thể là adapter sau, nhưng không chặn phase hiện tại.
