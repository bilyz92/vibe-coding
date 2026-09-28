---
name: auto-upgrade
description: Playbook cho agent chạy ngầm theo cron — tổng hợp kiến thức mới về AI coding agent/Claude Code, đối chiếu với hệ skill hiện có, rồi tự nâng cấp CÓ GIỚI HẠN (tối đa 1 thay đổi/lần, chỉ trong ~/.claude/skills, commit git tách biệt để rollback). Dùng khi được cron gọi headless, hoặc khi user muốn chạy tay một vòng nâng cấp.
---

# Auto-Upgrade — vòng tự tổng hợp & nâng cấp skill

> **Kim chỉ nam: Tự học · tự nâng cấp · tự cải tiến — KHÔNG phá vỡ cấu trúc.**
> Học cái mới và cải tiến liên tục, nhưng luôn cộng dồn (bồi đắp) chứ không đập đi xây lại: thay đổi nhỏ, có thể đảo ngược, giữ nguyên bộ khung skill/agent hiện có. Thay đổi phá vỡ cấu trúc (gỡ/gộp/viết lại) → chỉ ĐỀ XUẤT, chờ người duyệt.

Agent nền quét kiến thức mới, tìm MỘT cải tiến cụ thể cho hệ skill, áp dụng an toàn, commit tách biệt. Git là mạng an toàn — mọi thay đổi rollback được. Tuân kỷ luật verification trong CLAUDE.md project.

## When to Use

- Cron gọi headless (định kỳ hàng tuần).
- User chạy tay `/auto-upgrade` để làm một vòng có giám sát.

## HARD CONSTRAINTS — vi phạm = dừng ngay, không commit

1. **Chỉ ghi trong `~/.claude/skills/`.** TUYỆT ĐỐI không đụng `~/.claude/settings*.json`, project repo, hay bất kỳ nơi nào khác.
2. **Tối đa 1 thay đổi skill mỗi lần chạy.** Ít hơn là tốt. Không có gì đáng đổi → KHÔNG làm gì (không commit rỗng).
3. **Không xoá / không ghi đè phá huỷ** skill có sẵn. Chỉ được: tạo skill mới, hoặc append/sửa surgical một skill. Sửa lớn → chỉ ghi đề xuất ra report, KHÔNG tự áp dụng.
4. **Không chạy lệnh phá huỷ** (rm -rf, reset --hard, push --force, sudo, cài package global...).
5. **Mỗi thay đổi = 1 commit riêng** prefix `[auto-upgrade]`, kèm lý do. Để `git revert` dễ.
6. **Không chạm branch/repo khác.** Chỉ commit trong repo `~/.claude/skills`.

## Process

1. **Đọc bối cảnh** → verify: `git -C ~/.claude/skills log --oneline -10` + đọc report gần nhất trong `auto-upgrade/reports/` + `auto-upgrade/backlog.md` (việc hoãn có trigger). Nếu backlog có việc tới hạn trigger → ưu tiên đề xuất việc đó (KHÔNG tự thực hiện nếu là destructive như gỡ/gộp skill — chờ user duyệt).
2. **Quét kiến thức mới** → dùng WebSearch tìm cập nhật đáng chú ý về: Claude Code features/skills, kỹ thuật agent (TDD/review/planning), best practice Next.js/Prisma liên quan HRM. Giới hạn 3-5 truy vấn.
3. **Đối chiếu hệ hiện có** → verify: liệt kê skill hiện có (`ls ~/.claude/skills`), xác định đúng MỘT khoảng trống/cải tiến cụ thể, kiểm chứng được. Nếu không có gì rõ ràng → nhảy tới bước 6 (ghi report "no-op").
4. **Áp dụng 1 thay đổi** (trên `master`) → tạo skill mới HOẶC sửa surgical, đúng cấu trúc chuẩn (frontmatter → When to Use → Process → Rationalizations → Red Flags → Verification). Verify: frontmatter hợp lệ, không đụng file ngoài phạm vi. (No-op → bỏ qua 4-8, chỉ ghi report.)
5. **Commit + bump VERSION** → đọc `auto-upgrade/VERSION` (số nguyên) → N = cũ+1 → ghi N vào file. `git add <file vừa đổi> auto-upgrade/VERSION` rồi commit prefix `[auto-upgrade] v<N>: …`. Verify: `git status` sạch, diff chỉ gồm thay đổi chủ ý.
6. **Ghi report** → tạo `auto-upgrade/reports/YYYY-MM-DD.md`: quét gì, quyết định, lý do, **version N** + commit hash. Commit report riêng.
7. **Đánh dấu branch version (điểm khôi phục)** → tạo branch `auto-upgrade/v<N>` trỏ vào HEAD hiện tại (`git branch auto-upgrade/v<N>`). Đây là snapshot để "dùng ver cũ" sau này. Master vẫn là bản mới nhất đang dùng.
8. **Auto-push** (nếu có remote) → `git push origin master` VÀ `git push -u origin auto-upgrade/v<N>` (fast-forward, KHÔNG `--force`). Nếu master bị từ chối → `git pull --rebase` rồi push lại; xung đột không tự giải → dừng, báo user. **Verify BẮT BUỘC:** `git ls-remote origin -h refs/heads/master refs/heads/auto-upgrade/v<N>` — cả hai khớp `git rev-parse master` mới báo "đã đẩy". No-op → không push.

> **Dùng lại version cũ:** `git -C ~/.claude/skills checkout auto-upgrade/v<N>` rồi restart Claude → skills về đúng version đó. Về bản mới nhất: `git checkout master`.

## Rationalizations — các cớ cần phản bác

| Cái cớ | Phản bác |
|--------|----------|
| "Đổi luôn 3 skill cho hiệu quả" | Vi phạm giới hạn 1-thay-đổi; nhiều thay đổi/lần khó review và rollback. |
| "Skill cũ viết dở, viết lại hết" | Ghi đè phá huỷ bị cấm; đề xuất ra report để user tự quyết. |
| "Tin này hay, cứ tạo skill cho chắc" | Chỉ tạo khi có khoảng trống THẬT + kiểm chứng được; không tạo skill đầu cơ. |
| "Không có gì đổi nhưng cứ commit cho có hoạt động" | Commit rỗng làm nhiễu lịch sử; no-op là kết quả hợp lệ, ghi report là đủ. |
| "Sửa settings.json tí cho tiện" | Ngoài phạm vi tuyệt đối; dừng ngay. |

## Red Flags — dừng lại

- Định ghi file ngoài `~/.claude/skills/`.
- Định xoá hoặc ghi đè toàn bộ một skill có sẵn.
- Hơn 1 thay đổi skill trong một lần chạy.
- Commit gộp nhiều thay đổi không liên quan.
- Tạo skill mà không chỉ ra được khoảng trống cụ thể nó lấp.

## Verification checklist

- [ ] Đã đọc report + git log gần nhất, không lặp việc cũ.
- [ ] ≤ 1 thay đổi skill; nếu không có gì đáng đổi thì no-op + report.
- [ ] Chỉ ghi trong `~/.claude/skills/`; không đụng settings/repo khác.
- [ ] Không xoá/ghi đè phá huỷ skill có sẵn.
- [ ] Frontmatter skill mới hợp lệ.
- [ ] Mỗi thay đổi 1 commit prefix `[auto-upgrade]`, diff sạch.
- [ ] Report ngày hôm nay đã ghi (đổi gì / vì sao / version N / commit hash).
- [ ] Đã bump `auto-upgrade/VERSION` + tạo branch `auto-upgrade/v<N>` (điểm khôi phục).
- [ ] Đã push master + branch version (KHÔNG --force) và ls-remote KHỚP mới báo "đã đẩy".
