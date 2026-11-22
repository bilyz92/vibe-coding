---
name: phong-ky-su
description: Phòng Kỹ sư phần mềm — nhận một việc code và chạy trọn vòng như một đội: BA viết tiêu chí nghiệm thu, Trưởng nhóm lên kế hoạch, Kỹ sư code TDD, Tester kiểm trên app thật, Codex review, PR, CI xanh, auto-merge, deploy, báo cáo — với 6 chốt an toàn và xử lý khi Codex hết quota. Dùng khi anh "giao cho phòng kỹ sư", "để phòng làm", "chạy phòng kỹ sư", hoặc giao một việc code muốn làm trọn vòng không cần nhắc từng bước.
---

# Phòng Kỹ sư phần mềm

Spec: `~/project/my-office/docs/superpowers/specs/2026-11-01-phong-ky-su-phan-mem-design.md`. Anh giao việc rồi chỉ nhận kết quả: **không hỏi "tiếp tục không?"**, chỉ dừng ở quyết định nghiệp vụ, thao tác không đảo ngược, hoặc khi cần secret.

`S=~/.claude/skills/phong-ky-su/scripts` · `R=~/.claude/skills/codex-review/scripts/codex-runner.js`

## Đội

| Vai | Ai | Ghi chú |
| --- | --- | --- |
| Điều phối (bạn) | phiên chính chạy skill này | đặt tiêu đề phiên bắt đầu bằng `[phòng-kỹ-sư]` (My Office nhận ra phiên của phòng) |
| BA | agent `ba` | tiêu chí Given/When/Then, câu hỏi gom một lần |
| Trưởng nhóm | agent `planner` | kế hoạch + chia việc song song |
| Kỹ sư | agent `coding` | TDD, mỗi việc một worktree (`superpowers:using-git-worktrees`) |
| Tester | agent `tester` | không sửa code; ĐẠT / ĐẠT MỘT PHẦN / KHÔNG ĐẠT kèm bằng chứng |
| Reviewer | `/codex-impl-review` (+ `/codex-security-review` khi đụng auth/SQL/crypto/secret/input) | Codex hết quota → `code-review` (reviewer Claude dự phòng) |
| Release/Ops | agent `release-ops` | deploy theo `safe-deploy` |
| Trực production | agent `truc-production` | SSH vào server **chỉ đọc** log và trạng thái; sau deploy, theo lịch, hoặc khi anh hỏi; có vấn đề thì báo Lead / Trợ lý giám đốc |
| Thư ký | agent `thu-ky` | `PROGRESS.md` qua `progress.mjs`, file sự thật dự án |

Được tự thêm vai hoặc bước khi việc cần — liệt kê trong báo cáo.

Điều phối (phiên chính) là người commit, sau review APPROVE và hook commit-gate; subagent không commit/push.

## Reviewer nào khi nào

| Reviewer | Khi nào |
| --- | --- |
| `/codex-impl-review` | mọi việc, trước commit, tới APPROVE |
| `/codex-security-review` | thêm khi diff nhạy cảm (auth/SQL/crypto/secret/input, env/Dockerfile/CORS) |
| `code-review` | reviewer Claude dự phòng khi Codex lỗi hoặc hết quota |
| `/codex-plan-review` | kế hoạch của Trưởng nhóm, trước khi code |

## Mức: `day-du` hay `nhanh`

- `day-du` — như hiện nay, đủ mọi bước bên dưới.
- `nhanh` — việc nhỏ: ước lượng không quá `3 file` và `150 dòng` (cộng + trừ), không tính file test (`*.test.*`, `*.spec.*`, `tests/`, `__tests__/`). Anh ép được bằng từ `nhanh` hoặc `day-du` trong câu giao việc (có cả hai → `day-du`).
- Mức nhanh **giữ**: tiêu chí ngắn do điều phối viết (Given/When/Then), TDD, lint/typecheck/test, `/codex-impl-review` tới APPROVE, CI xanh trước merge.
- Mức nhanh **bỏ**: agent `ba`, Trưởng nhóm (agent `planner`) + `/codex-plan-review`, agent `tester`.
- Chạm chỗ nhạy cảm (migration, env, Dockerfile, CI, deploy, auth, crypto, CORS, middleware, `'use server'`, secret/token, SQL thô) hoặc vượt ngưỡng → **tự nâng `day-du`**, kể cả khi anh ép `nhanh`, rồi chạy bù các bước đã bỏ (`catchUp`; nhạy cảm thì thêm `/codex-security-review` và skill quét theo diff). Kiểm bằng `rigor.mjs recheck` ngay trước review; không bao giờ hạ mức.
- Sổ đo `ledger.mjs` (cạnh `returns.json` trong git-common-dir; `<id>` = mã phiếu; không có phiếu thì tên ngắn của việc): `start` khi nhận việc, `level` khi nâng mức, `round` mỗi vòng Codex, `merge` sau merge, `escape <repo> <id> revert|fix-ticket` khi có lỗi lọt (ghi tay). `node $S/ledger.mjs summary <repo>` → trung vị thời gian mỗi mức, lỗi lọt, kết luận `dat` / `dung` / `chua-ket-luan`.

## Dòng chảy một việc

Giao qua **Trợ lý giám đốc** thì việc kèm `phiếu <id>`: ngay khi nhận, `node ~/.claude/skills/tro-ly-giam-doc/scripts/tickets.mjs status <id> "đang làm" --by phong-ky-su`; ở bước 9 Thư ký ghi kết quả vào phiếu. Trong lúc làm, điều phối (vai Lead của phòng) có vấn đề phòng không tự giải được thì **báo về Trợ lý giám đốc**: kẹt, thiếu vai, thiếu quyền hay công cụ, sắp vượt ngân sách, yêu cầu không rõ. Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file, rồi `node ~/.claude/skills/tro-ly-giam-doc/scripts/tickets.mjs escalate <id> --by phong-ky-su --json <file>`. Không có phiếu thì mọi thứ như cũ.

0. **Preflight**: `node $S/preflight.mjs <repo>` trên bản checkout chính (không phải worktree; trạng thái của phòng nằm ở `git rev-parse --git-common-dir`, chung cho mọi worktree). `ok:false` → dừng, báo đúng `problems` (vd `! gh auth login`). `autoMerge:false` → vẫn làm nhưng dừng ở PR, ghi `warnings` vào "Chờ anh: bấm merge".
   - **Chọn mức**: `node $S/rigor.mjs choose "<câu giao việc>" --files <n> --lines <n>` (ước lượng của bạn), rồi `node $S/ledger.mjs start <repo> <id> <mức>` (**Bắt buộc**: `tickets.mjs result` từ chối phiếu không có dòng sổ). `nhanh` → bỏ bước 1, 2 và Tester ở bước 4; điều phối tự viết tiêu chí ngắn trước khi giao Kỹ sư.
1. **BA** (agent `ba`) → tiêu chí nghiệm thu. Có câu hỏi → hỏi anh **một lần**, chờ trả lời; không có → đi tiếp.
2. **Trưởng nhóm** (agent `planner`) → kế hoạch, mỗi phần việc kèm danh sách file. `/codex-plan-review` tới APPROVE hoặc stalemate. Chia việc: `node $S/guards.mjs groups <tasks.json>` (`parallelGroups`) — chỉ chạy song song trong một nhóm.
3. **Kỹ sư** (agent `coding`), mỗi phần việc một worktree **cắt từ nhánh mặc định trên remote**: `git fetch origin <defaultBranch>` rồi `git worktree add -b <nhánh> <thư mục> origin/<defaultBranch>` (`defaultBranch` từ preflight) — không bao giờ từ bản checkout chính, nên file chưa theo dõi ở đó (PROGRESS.md, .codex-review/) không lọt vào PR. Trước khi giao Tester: lint, typecheck, test liên quan đã chạy và xanh.
4. **Tester** (agent `tester`). Song song, điều phối quét theo điều kiện diff, chạy trong worktree của việc, trước review/commit: danh sách file đổi = `git diff --name-only origin/<defaultBranch>` (so cây làm việc, gồm cả phần chưa commit) cộng `git ls-files --others --exclude-standard` (file mới chưa track), xét cả nội dung các file đó. Có `prisma/migrations` → `prisma-migration-safety`; có `'use server'` hoặc `"use server"` → `nextjs-server-action-security`; chạm env/Dockerfile/CORS/auth → `vibesec`. Lỗi chặn từ các skill này tính như KHÔNG ĐẠT. KHÔNG ĐẠT → `node $S/guards.mjs return <repo> <taskId>` (`recordReturn`), trả Kỹ sư kèm bước tái hiện. `stuck:true` (lần trả thứ 4) → dừng việc đó (luật dừng). ĐẠT MỘT PHẦN → đi tiếp review và PR, nhưng các tiêu chí chưa kiểm được ghi vào thân PR và "Chờ anh", và **không** bật auto-merge cho PR đó.
   - **Trước bước 5** (mọi mức): `node $S/rigor.mjs recheck <worktree> <mức> --base origin/<defaultBranch>`. `upgraded:true` → `node $S/ledger.mjs level <repo> <id> day-du`, chạy bù đủ `catchUp` (kể cả Tester và quét theo diff ở trên), rồi mới review.
5. **Review**: `/codex-impl-review` (thêm `/codex-security-review` nếu nhạy cảm; diff chạm env/Dockerfile/CORS/auth thì chạy cùng `vibesec` ở bước 4) tới APPROVE/stalemate → điều phối commit (hook commit-gate kiểm).
   - Mỗi vòng Codex (một lần chạy review, kể cả vòng sau rebuttal): `node $S/ledger.mjs round <repo> <id>`.
6. **PR / MR** (theo `platform` của preflight):
   - GitHub: push nhánh, `gh pr create`; `autoMerge:true` → `gh pr merge --auto --merge`.
   - GitLab: push nhánh, `glab mr create --source-branch <nhánh> --target-branch <defaultBranch> --title … --description … --yes`; `autoMerge:true` (đã có `.gitlab-ci.yml` và bật "Pipelines must succeed") → `glab mr merge <iid> --auto-merge --yes`. `autoMerge:false` → dừng ở MR, ghi "Chờ anh".
   - Nhiều PR/MR: merge lần lượt, rebase trước khi merge.
7. **Sau merge**: chờ PR merge xong — `node $S/guards.mjs merge <owner/repo> <pr>` (`mergeCommit`; GitLab: thêm `--gitlab`, `<owner/repo>` là `group/project`, `<pr>` là số MR; `main` cũng thêm `--gitlab` và xét pipeline mới nhất của commit đó) tới khi có `sha`. Rồi hỏi `node $S/guards.mjs main <owner/repo> <sha> --required '<check 1>' --required '<check 2>' …` (mỗi tên trong `requiredChecks` của preflight một `--required`: tên check có thể chứa dấu phẩy) (`mainStatus`: mọi check bắt buộc của đúng commit merge phải có, chạy xong và xanh) vài phút một lần, tối đa 30 phút: `green` → bước 8; `pending` quá hạn hoặc `unknown` → "Chờ anh", không deploy; `red` → `node $S/guards.mjs revert-plan <sha> <pr> --branch <defaultBranch>` (+ `--gitlab`) (`revertPlan`, revert đúng commit merge vào đúng nhánh mặc định), chạy các lệnh đó (PR revert, **không** push thẳng `main`), báo anh.
   - Có `sha` (đã merge): `node $S/ledger.mjs merge <repo> <id>`. Revert, hoặc sau này phải mở phiếu sửa vì việc này: `node $S/ledger.mjs escape <repo> <id> revert|fix-ticket`.
8. **Deploy** (agent `release-ops`, theo `safe-deploy`) nếu dự án có.
9. **Thư ký** (agent `thu-ky`): `node $S/progress.mjs report <repo> --json <file>` — báo cáo 4 mục **Xong / Đang làm / Chờ anh / Chờ đối tác** — và `progress.mjs lesson …` cho bài học (**Bắt buộc**, `task` chứa mã phiếu; không có bài học thì thêm `"lesson": "không có"` vào file kết quả); tóm tắt cho anh trong chat kèm link PR, ảnh, tiền đã tiêu. Có phiếu: Thư ký viết `{ "summary", "links" }` (link PR, commit; phiếu chưa có repo thì thêm `"repo"`) vào file bằng tool Write, chạy `tickets.mjs result <id> --json <file>`, rồi đặt phiếu sang `xong`; việc dừng giữa chừng (luật dừng, vượt ngân sách, cần anh quyết) thì sang `chờ anh` với `--note "<lý do>"`.
   - **Còn lại** (mọi mức, cả khi dừng giữa chừng): gom từ mục "Còn lại" của Kỹ sư và phần chưa kiểm được của Tester. Báo cáo luôn có dòng `Còn lại: …` trong `doing`, mỗi thứ một dòng: nợ `shortcut:`, cái chưa kiểm, cái chờ anh. Thật sự không còn gì thì ghi đúng một dòng `Còn lại: không còn gì`. Tóm tắt trong chat cũng có mục này.

## Sáu chốt an toàn

1. **Tiêu chí trước code** — bước 1; Kỹ sư không bắt đầu khi chưa có tiêu chí. Mức `nhanh`: tiêu chí ngắn do điều phối viết, vẫn trước code.
2. **Reviewer dự phòng** — Codex lỗi/hết quota: `code-review` trên diff (subagent mới, chỉ thấy diff), ghi "review dự phòng" trên PR.
3. **Luật dừng và báo anh** — `stuck:true`, stalemate với Codex, hoặc chi phí việc vượt `PHONG_KY_SU_BUDGET_USD` (mặc định `20`; chi phí từ `cost.total_cost_usd` của status line, đọc qua `GET http://127.0.0.1:4310/api/live` khi My Office chạy — không có thì ghi "chưa đo được" vào báo cáo) → dừng việc đó, gửi thông báo bằng tool `PushNotification`, làm việc khác.
4. **Main đỏ → revert qua PR** — bước 7.
5. **Song song không đụng file** — `parallelGroups`, merge lần lượt.
6. **Quyền tối thiểu** — chỉ cần quyền tạo nhánh/PR; không đụng branch protection, không cầm secret production.

## Codex hết quota

Theo `references/protocol.md` § Codex out of quota của các skill `/codex-*`: `node $R pending add "$PWD" --skill <skill> --scope … --branch … --reason …`, chạy nền `node $R wait-quota`. Vẫn commit → push → PR → auto-merge → deploy khi reviewer dự phòng (`code-review`) không thấy lỗi chặn **và** CI xanh; khi có quota, Codex review phần đã merge, lỗi thì sửa bằng PR tiếp theo.

## Docs

Việc có viết tài liệu: trong cùng lần chạy, tự rà theo checklist — đủ mục yêu cầu, lệnh trong tài liệu chạy được, link sống, khớp code hiện tại — trước khi báo xong.

## Không được

- Hỏi "tiếp tục không?" giữa plan đã duyệt; đưa lệnh bắt anh chạy hộ khi bạn chạy được.
- Sửa / skip / nới test cho xanh; Tester sửa code.
- Push thẳng `main`; bật `--auto` khi `main` chưa có check bắt buộc.
