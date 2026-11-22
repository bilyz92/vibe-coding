# Report 2026-10-05 — chạy thử instincts (chế độ chỉ-ghi, KHÔNG sửa skill)

Theo đề xuất `auto-upgrade/proposals/2026-10-05-instincts.md`. Chạy tay. Không bump VERSION, không sửa skill.

## Quét
- Nguồn: 14 memory `type: feedback` trên 5 dự án (`~/.claude/projects/*/memory/`).
- Tín hiệu âm (git log): không có commit `[auto-upgrade]` nào bị revert.
- Bỏ qua 1 memory là thông tin vận hành riêng dự án (không phải hành vi) → để nguyên trong memory.

## Kết quả
| Instinct | Phạm vi | Điểm | Số dự án |
|---|---|---|---|
| verify-runtime-not-just-static | global | 0.7 | 3 |
| brief-subagent-with-repo-gotchas | global | 0.7 | 3 |
| codex-review-before-commit | global | 0.7 | 2 | ← chấm lại, xem cập nhật |
| execute-fix-before-reporting | project | 0.6 | 2 |
| shared-test-db-hazard | project | 0.6 | 2 |
| 5 instinct khác | project | 0.5 | 1 |

`global/` được commit; `projects/` chỉ lưu local (gitignore) theo quyết định của user.

## Ứng viên thăng cấp (≥ 0.8)
Không có → đúng thiết kế: chưa đủ bằng chứng để tự sửa skill.

## Phát hiện từ lần chạy thử
1. **Thang điểm đánh giá thấp lời nhắc lặp lại**: `codex-review-before-commit` chỉ 0.6 dù memory ghi "lặp nguyên văn ≥6 lần". Đề xuất: +0.1 thêm khi memory ghi rõ lặp ≥3 lần.
2. **Xung đột quy tắc**: CLAUDE.md global nói "luôn hỏi trước khi chạy review"; 2 memory dự án nói "tự chạy không cần hỏi". Cần user chọn — instinct không tự giải được.
3. Một số `target_skill` nằm ngoài phạm vi được sửa (plugin superpowers, CLAUDE.md) → chỉ đề xuất được, đúng HARD CONSTRAINT #1.

## Cập nhật 2026-10-05 (sau khi user quyết)
- Xung đột #2: user chọn **tự chạy /codex-impl-review không cần hỏi** → sửa `~/.claude/CLAUDE.md` (chỉ ngoại lệ cho impl-review; review khác vẫn hỏi).
- Thang điểm #1: áp dụng **+0.1 khi memory ghi rõ lặp ≥3 lần** (đã ghi vào proposal §3.3). Chấm lại: chỉ 1 memory đủ điều kiện → `codex-review-before-commit` 0.6 → **0.7**, 2 dự án → thăng lên **global**.
- Vẫn chưa có ứng viên ≥ 0.8 → không sửa skill.
