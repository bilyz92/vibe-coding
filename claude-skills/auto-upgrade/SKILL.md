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
7. **Instinct riêng tư.** `auto-upgrade/instincts/projects/` chỉ lưu local (gitignore) — kể cả file đã `archived`/`promoted`. File trong `instincts/global/` được commit nên KHÔNG ghi tên dự án/khách hàng, code hay secret — chỉ mô tả hành vi + ngày + số dự án. Ghi/sửa file instinct không tính là "thay đổi skill" ở luật #2.

## Process

> **Chạy headless qua `run.sh`:** runner đã làm phần đồng bộ ở bước 0 (fetch + ff-only) và thay bước 8: KHÔNG push master, mà chuyển commit mới sang nhánh `auto-upgrade/run-<giờ>`, đưa master local về bản trước khi chạy, rồi đẩy nhánh đó kèm yêu cầu tạo MR vào master chờ người duyệt (chỉ khi claude thoát 0 và mọi commit chỉ đụng `*.md`/`VERSION`; đụng script → chỉ giữ nhánh local). Agent KHÔNG có quyền git mạng (fetch/pull/push/ls-remote), chỉ đọc được repo skills + thư mục memory, WebFetch chỉ tới các miền trong `WEB_DOMAINS` của `run.sh` — bỏ các phần mạng, chỉ ghi kết quả vào report.

0. **Điều kiện tiên quyết** → `git -C ~/.claude/skills branch --show-current` PHẢI là `master` và `git status --porcelain` rỗng; nếu không → DỪNG, không ghi/commit gì, chỉ in lý do (runner ghi vào log). Rồi đồng bộ TRƯỚC khi làm gì: nếu có remote `origin` (`git remote get-url origin` thành công) → `git fetch origin` + `git pull --ff-only origin master`; không có remote → chạy local, bỏ bước 8. Pull ff-only thất bại (local và remote đã rẽ nhánh) → DỪNG, ghi `git rev-list --left-right --count master...origin/master` vào log/output và báo **cần user xử lý tay** — KHÔNG tự rebase/merge/reset.
1. **Đọc bối cảnh** → verify: `git -C ~/.claude/skills log --oneline -10` + đọc report gần nhất trong `auto-upgrade/reports/` + `auto-upgrade/backlog.md` (việc hoãn có trigger). Nếu backlog có việc tới hạn trigger → ưu tiên đề xuất việc đó (KHÔNG tự thực hiện nếu là destructive như gỡ/gộp skill — chờ user duyệt).
1.5. **Cập nhật instincts** (chỉ ĐỌC nguồn, chỉ ghi trong `auto-upgrade/instincts/`; KHÔNG xoá/di chuyển file — runner không có quyền đó) →
   - **Nguồn:** memory `type: feedback` trong `~/.claude/projects/*/memory/*.md`; git log repo skills. Thông tin vận hành riêng dự án (không phải hành vi) → bỏ qua, để nguyên trong memory.
   - **File:** 1 hành vi nguyên tử = 1 file theo `id`, KHÔNG tách theo dự án. `instincts/projects/<id>.md` (local, gitignore) có frontmatter `id, trigger, action, confidence, scope: project, status, projects: [...], first_seen, last_seen, target_skill, origin_commit, processed_events: [...]`.
   - **Evidence có cấu trúc** (mục `## Evidence`, mỗi dòng 1 sự kiện): `- <YYYY-MM-DD> | proj:<Pn> | sess:<8 ký tự đầu originSessionId> | <+1 hoặc -1> | repeat3:<yes|no> | <mô tả ngắn>` (dòng −1 thay `sess:` bằng `event:<commit hash>`). `Pn` = mã dự án ẩn danh tra trong `instincts/projects/_project-refs.md` (local, gitignore; dự án mới → thêm Pn kế tiếp). Ghi chú không tính điểm → mục `## Notes` riêng.
   - **Điểm — tính lại TỪ ĐẦU mỗi lần chạy từ Evidence đã ghi (không cộng/trừ dồn):**
     `confidence = min(0.9, 0.5 + 0.1 × (số bằng chứng độc lập − 1) + 0.1 × [có ≥1 memory ghi RÕ con số lặp lại ≥3 lần] − 0.2 × số_sự_kiện_âm − 0.1 × floor(số ngày từ last_seen / 60))`. Thưởng lặp lại tính **1 lần/instinct**. Đếm từ dòng Evidence: bằng chứng độc lập = số `sess:` khác nhau trong các dòng `+1`; thưởng lặp lại khi có ≥1 dòng `+1` mang `repeat3:yes`; sự kiện âm = số dòng `-1`. Mục `## Notes` không bao giờ tính điểm. `first_seen`/`last_seen` = ngày nhỏ nhất/lớn nhất trong các dòng `+1` (tính lại mỗi lần chạy; không cập nhật theo ngày quét, Notes hay dòng `-1`).
   - **Sự kiện âm** (chỉ khi instinct có `origin_commit`): commit `Revert` của chính commit đó, hoặc commit sau sửa ngược đúng dòng nó đã thêm. Sửa tay khác KHÔNG tính. Ghi hash vào `processed_events` để mỗi sự kiện chỉ tính 1 lần.
   - **Trạng thái — tính lại sau khi chấm điểm, theo thứ tự ưu tiên:** điểm < 0.3 → `archived` · file project đã có bản global → `promoted` · `origin_commit` khác rỗng → `applied` · còn lại → `active`. (Nên instinct `archived` có thêm bằng chứng đạt ≥ 0.3 tự trở lại `active`/`applied`.) Không di chuyển file; `archived` bị bỏ qua khi xét ứng viên.
   - **Lên global:** `len(projects) ≥ 2` và điểm (tính từ toàn bộ Evidence của file đó) ≥ 0.7 → tạo `instincts/global/<id>.md` **ẩn danh**: thay `projects` bằng `project_count`; giữ nguyên các dòng Evidence có cấu trúc (chỉ `Pn` + `sess:`, mô tả chỉ ghi loại dự án + loại sự cố trừu tượng — KHÔNG tên dự án/khách hàng, lệnh, định danh, đường dẫn hay đoạn code; những chi tiết đó chỉ ở Evidence của file project local); có đủ `status, origin_commit, processed_events`. Đặt `status: promoted` ở file project. Từ đó chấm điểm trên file global; lưu trữ cùng cách (không di chuyển).
   - **Ứng viên sửa skill:** global, `status: active`, `origin_commit` rỗng, điểm ≥ 0.8, và hành vi đó CHƯA có trong `target_skill` (đọc kiểm trước). Instinct `applied` vẫn được chấm điểm (để nhận sự kiện âm) nhưng không bao giờ là ứng viên lại. Instinct mâu thuẫn với CLAUDE.md/skill hiện có → KHÔNG tự giải, ghi vào report để user chọn.
   - **Gắn nguồn gốc:** sau khi bước 5 commit một thay đổi skill sinh từ instinct → ghi hash commit đó vào `origin_commit` và đặt `status: applied` ở file global tương ứng, commit riêng (`[auto-upgrade] instincts: origin <id>`).
   - **Commit** riêng các file `instincts/global/` thay đổi (prefix `[auto-upgrade] instincts:`). Chỉ `git add` đúng đường dẫn `auto-upgrade/instincts/global/...` — không `git add -A`/`.`.
2. **Quét kiến thức mới** → dùng WebSearch tìm cập nhật đáng chú ý về: Claude Code features/skills, kỹ thuật agent (TDD/review/planning), best practice Next.js/Prisma liên quan HRM. Giới hạn 3-5 truy vấn.
3. **Đối chiếu hệ hiện có** → verify: liệt kê skill hiện có (`ls ~/.claude/skills`), xác định đúng MỘT khoảng trống/cải tiến cụ thể, kiểm chứng được. **Ưu tiên** ứng viên instinct điểm cao nhất (bước 1.5) → sửa surgical `target_skill` (thêm 1 dòng vào Process/Red Flags); `target_skill` ngoài `~/.claude/skills` (plugin, CLAUDE.md) → chỉ đề xuất trong report. Không có ứng viên → dùng kết quả quét tin tức. Nếu không có gì rõ ràng → no-op: nhảy tới bước 6, rồi bước 8.
4. **Áp dụng 1 thay đổi** (trên `master`) → tạo skill mới HOẶC sửa surgical, đúng cấu trúc chuẩn (frontmatter → When to Use → Process → Rationalizations → Red Flags → Verification). Verify: frontmatter hợp lệ, không đụng file ngoài phạm vi. (No-op skill → bỏ qua bước 4, 5, 7; VẪN làm bước 6 (report) và bước 8 (push master nếu có commit instincts/report).)
5. **Commit + bump VERSION** → đọc `auto-upgrade/VERSION` (số nguyên) → N = cũ+1 → ghi N vào file. `git add <file vừa đổi> auto-upgrade/VERSION` rồi commit prefix `[auto-upgrade] v<N>: …`. Verify: `git status` sạch, diff chỉ gồm thay đổi chủ ý.
6. **Ghi report** → tạo `auto-upgrade/reports/YYYY-MM-DD.md`: quét gì, quyết định, lý do; **có thay đổi skill** → version N mới + hash commit skill; **no-op** → `VERSION không đổi: <số hiện tại>` + hash các commit instincts đã tạo trong lần chạy (hoặc `none`) — không ghi hash của chính commit report; và mục **Instincts** (mới / tăng / giảm / lên global / ứng viên / mâu thuẫn cần user chọn — không ghi tên dự án). Commit report riêng.
7. **Đánh dấu branch version (điểm khôi phục)** → tạo branch `auto-upgrade/v<N>` trỏ vào HEAD hiện tại (`git branch auto-upgrade/v<N>`). Đây là snapshot để "dùng ver cũ" sau này. Master vẫn là bản mới nhất đang dùng.
8. **Auto-push** (nếu có remote) → `git push origin master` VÀ `git push -u origin auto-upgrade/v<N>` (fast-forward, KHÔNG `--force`). Nếu push bị từ chối (remote đổi trong lúc chạy) → DỪNG, KHÔNG rebase (rebase làm sai các hash đã ghi vào `origin_commit`/report/branch version); chạy `git fetch origin` rồi ghi lý do + số commit ahead/behind (`git rev-list --left-right --count master...origin/master`; fetch lỗi → ghi "không lấy được ahead/behind", không dùng số cũ) vào output và báo **cần user xử lý tay** (đẩy/gộp các commit local). Các lần chạy sau sẽ dừng ở bước 0 cho tới khi user xử lý — đó là chủ ý, không tự retry. **Verify BẮT BUỘC:** `git ls-remote origin -h refs/heads/master refs/heads/auto-upgrade/v<N>` — cả hai khớp `git rev-parse master` mới báo "đã đẩy". No-op skill nhưng có commit instincts/report → vẫn `git push origin master` (không tạo branch version), verify chỉ cần `git ls-remote origin -h refs/heads/master` khớp `git rev-parse master`; hoàn toàn không có commit → không push.

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
- [ ] (Chỉ khi có thay đổi skill) Đã bump `auto-upgrade/VERSION` + tạo branch `auto-upgrade/v<N>` (điểm khôi phục).
- [ ] Đã cập nhật instincts (bước 1.5); `instincts/global/` không chứa tên dự án/code/secret.
- [ ] Có commit (skill/instincts/report) → đã push master (+ branch version nếu có thay đổi skill), KHÔNG --force, ls-remote KHỚP mới báo "đã đẩy".
