---
id: verify-runtime-not-just-static
trigger: "sắp báo 'xong' cho thay đổi có hành vi runtime (server action, UI/chart, migration DB)"
action: "kiểm chứng trên hệ thật — chạy app/browser/screenshot hoặc query DB thật; tsc/lint/`migrate status` xanh KHÔNG đủ"
confidence: 0.7
scope: global
project_count: 3
first_seen: 2026-08-06
last_seen: 2026-10-05
target_skill: dev-workflow
status: active
origin_commit: 
processed_events: []
---
## Evidence
- 2026-08-06 | proj:P1 | sess:96a977e6 | +1 | repeat3:no | dự án web Next.js: lỗi chỉ xuất hiện lúc chạy thật, lọt qua nhiều lượt review và kiểm tra tĩnh, chỉ lộ khi thao tác trên browser
- 2026-09-07 | proj:P2 | sess:bdb884f2 | +1 | repeat3:no | dự án Prisma: thay đổi schema DB được công cụ báo đã áp dụng nhưng thực tế chưa có trong DB
- 2026-10-05 | proj:P3 | sess:c90c078b | +1 | repeat3:no | dự án Rails: lỗi hiển thị biểu đồ/JS chỉ bắt được khi render browser + chụp màn hình
