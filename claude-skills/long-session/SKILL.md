---
name: long-session
description: Giữ session dài / chạy tự động lâu (30 phút trở lên) không bị "trôi ngữ cảnh" (context rot) — neo mục tiêu ra file PROGRESS.md, giữ context sạch và nén tại ranh giới task, checkpoint commit sau mỗi chặng nhỏ đã xanh test, chạy tự động trong worktree riêng. Dùng khi nhận task nhiều bước sẽ chạy lâu, khi user nói "chạy tự động", "làm hết đi", "để nó chạy qua đêm", hoặc khi thấy dấu hiệu quên yêu cầu ban đầu / sửa file không liên quan.
---

# Long Session — cầm cương session dài

Session dài hỏng vì log test, git diff, output tool dồn đầy context → yêu cầu ban đầu bị đẩy ra xa, agent bắt đầu quên mục tiêu và sửa lan man. Các cơ chế dưới đây giữ mục tiêu ở **ổ cứng** thay vì chỉ trong khung chat, và giới hạn thiệt hại khi agent vẫn đi lạc. Bổ trợ cho [[dev-workflow]] và [[strategic-compact]].

## 0. Chạy tự động → worktree riêng

Trước khi để agent tự chạy lâu: làm trong git worktree/branch riêng (EnterWorktree hoặc [[using-git-worktrees]]), không làm thẳng trên working tree của user. Xác nhận repo có test chạy được — không có test thì checkpoint vô nghĩa, báo user trước khi bắt đầu.

## When to Use

- Task cần nhiều bước / nhiều module, dự kiến chạy lâu hoặc tự động.
- User sắp rời máy và muốn agent tự làm tiếp.
- Resume sau `/compact`, sau khi context bị tóm tắt, hoặc ở session mới cho task dở.

KHÔNG cần cho: task một-hai bước, câu hỏi, sửa nhỏ một file.

## 1. Neo mục tiêu: PROGRESS.md

Trước khi code dòng đầu tiên, tạo `PROGRESS.md` ở gốc repo (nếu đã có → đọc nó TRƯỚC, đó là nguồn sự thật):

```markdown
# PROGRESS — <tên task>

## Mục tiêu (nguyên văn yêu cầu của user)
> <dán nguyên văn, không diễn giải>

## Tiêu chí xong
- [ ] <kiểm chứng được: test X pass, lệnh Y chạy ra Z>

## Phạm vi
- Được sửa: <thư mục/file>
- KHÔNG đụng: <những gì ngoài phạm vi>

## Chặng
- [ ] 1. <chặng nhỏ, trọn vẹn> → verify: <lệnh/test>
- [ ] 2. ...

## Quyết định & ghi chú
- <quyết định kiến trúc, lý do, thứ đã thử và bỏ>
```

Quy tắc:
- Xong một chặng → **tự mở file tích `[x]`** và ghi 1 dòng kết quả (commit hash / test pass) ngay, không dồn cuối.
- Trước mỗi chặng mới → đọc lại "Mục tiêu" + "Phạm vi". Sắp sửa file nằm trong "KHÔNG đụng" → dừng, hỏi user.
- Đổi kế hoạch → sửa file trước rồi mới làm, ghi lý do ở "Quyết định".
- `PROGRESS.md` là file làm việc: hỏi user có muốn commit không; mặc định thêm vào `.git/info/exclude` để khỏi lọt vào commit.

## 2. Giữ context sạch, nén tại ranh giới

Ưu tiên theo thứ tự — chặn rác từ gốc rẻ hơn dọn sau:
1. **Đừng để rác vào context**: giao việc tìm kiếm rộng / đọc log dài / debug lan man cho subagent, chỉ nhận kết luận. Chạy test với output gọn (`-q`, `--reporter=dot`, `| tail -50`), grep thay vì đọc cả file.
2. **Chuyển sang việc mới, không liên quan** → cập nhật `PROGRESS.md` đầy đủ, rồi đề xuất user `/clear` + "đọc PROGRESS.md và làm tiếp". Sạch hơn `/compact` vì không phụ thuộc chất lượng bản tóm tắt.
3. **Xong một module nhưng việc tiếp theo cần ngữ cảnh vừa rồi** → cập nhật `PROGRESS.md`, đề xuất `/compact` kèm chỉ dẫn (vd `/compact giữ mục tiêu, quyết định kiến trúc, chặng đang làm; bỏ log test`).

Quy tắc:
- Nén theo **ranh giới task**, không theo đồng hồ — `/compact` là tóm tắt có mất mát, nén thường xuyên = mất chi tiết dồn dần.
- Agent không tự gõ được `/clear`/`/compact` — chỉ đề xuất, và không đề xuất giữa một chặng đang sửa dở.
- Sau khi nén / resume: việc đầu tiên là đọc `PROGRESS.md` và `git log --oneline -10`, rồi mới làm tiếp.

## 3. Checkpoint commit: chặng nhỏ, trọn vẹn, xanh test

- Mỗi chặng là **một bước trọn vẹn**: sau chặng, build + test phải pass. Chặng đụng quá ~3–5 file → cân nhắc tách, nhưng KHÔNG tách một thay đổi nguyên tử (vd đổi tên symbol ở mọi call-site) thành nhiều commit trung gian gãy build.
- Hết chặng: chạy test/lint liên quan → pass mới sang chặng sau. Fail → sửa trong chặng đó, không mang lỗi sang chặng mới.
- Commit checkpoint:
  - Chỉ commit khi user đã cho phép chạy tự động/commit trong task này; chưa có phép → hỏi một lần lúc bắt đầu.
  - Đang ở branch mặc định → tạo branch trước (hoặc đã ở worktree, mục 0).
  - Message nêu chặng: `step 2/5: <việc>`.
- Review khi chạy tự động (ngoại lệ có chủ đích cho quy tắc "review trước mỗi commit" trong CLAUDE.md): commit checkpoint KHÔNG cần Codex; chạy [[codex-impl-review]] trên diff gộp từ mốc trước khi xong mỗi **mốc lớn** (mục "Tiêu chí xong" / module) và luôn trước khi merge/push. Ghi mốc đã review vào `PROGRESS.md`. Session thường (không tự động) → giữ quy tắc review trước mỗi commit.
- Sai thì quay về checkpoint gần nhất (`git revert` / `git reset` về commit chặng trước — hỏi user trước với thao tác phá huỷ), không vá chồng lên đống lỗi.

## Dấu hiệu trôi ngữ cảnh → dừng lại

- Không nhớ nguyên văn yêu cầu mà không mở lại file.
- Đang sửa file ngoài "Phạm vi", hoặc xoá code mà không gắn được với một chặng.
- Lặp lại cách sửa đã ghi là thất bại trong "Quyết định".

Gặp một trong các dấu hiệu trên → đọc lại `PROGRESS.md`, so `git diff` với "Phạm vi", gỡ phần lạc đề, rồi đề xuất `/compact`.
