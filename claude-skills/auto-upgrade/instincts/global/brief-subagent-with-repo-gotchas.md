---
id: brief-subagent-with-repo-gotchas
trigger: "giao việc cho subagent trong repo có bẫy riêng (lệnh test đặc biệt, luật git, cách poll tool)"
action: "ghi THẲNG bẫy đó + lệnh đúng vào prompt giao việc; không trông subagent tự phát hiện"
confidence: 0.7
scope: global
project_count: 3
first_seen: 2026-08-05
last_seen: 2026-09-24
target_skill: _agents/planner.md
status: active
origin_commit: 
processed_events: []
---
## Evidence
- 2026-08-05 | proj:P1 | sess:449b696c | +1 | repeat3:no | subagent dùng sai lệnh kiểm thử đặc thù của repo → không có bằng chứng nhưng vẫn báo hoàn thành
- 2026-09-05 | proj:P2 | sess:bdb884f2 | +1 | repeat3:no | subagent dùng thao tác version-control làm mất code chưa commit của việc khác
- 2026-09-24 | proj:P5 | sess:d7d944a1 | +1 | repeat3:no | subagent dùng sai cơ chế chờ kết quả công cụ → treo lâu
