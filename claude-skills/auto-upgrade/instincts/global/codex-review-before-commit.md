---
id: codex-review-before-commit
trigger: "sắp commit thay đổi code"
action: "tự chạy /codex-impl-review (không hỏi) → sửa → lặp tới APPROVE → mới commit"
confidence: 0.7
scope: global
project_count: 2
first_seen: 2026-08-11
last_seen: 2026-09-05
target_skill: dev-workflow
status: active
origin_commit: 
processed_events: []
---
## Evidence
- 2026-09-05 | proj:P2 | sess:bdb884f2 | +1 | repeat3:no | dự án Next.js/Prisma: memory feedback, ghi "nhắc nhiều lần" (không có con số)
- 2026-08-11 | proj:P3 | sess:5c018e64 | +1 | repeat3:yes | dự án Rails: memory feedback, ghi lặp nguyên văn ≥6 lần trong 1 phiên

## Notes
- 2026-10-05: user chốt "tự chạy không cần hỏi" → đã sửa CLAUDE.md chung (ngoại lệ tự chạy review trước commit), hết xung đột.
