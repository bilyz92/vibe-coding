# Mức 2: chưa có phòng (soạn phòng, anh duyệt một lần)

> Phần chi tiết của skill `tro-ly-giam-doc` (SKILL.md chỉ giữ tóm tắt). `T=~/.claude/skills/tro-ly-giam-doc/scripts`.

1. **Thiết kế phòng:**
   - tên, `handles`;
   - các vai: luôn có Lead, người làm, người kiểm và Thư ký;
   - các bước workflow;
   - `external`: việc ra bên ngoài của phòng;
   - `allowedTools`: danh sách cụ thể;
   - `budgetUsd`.
2. **Tìm skill cho từng vai**, dừng ở nguồn đầu tiên đủ dùng:
   1. skill đã cài trên máy (`~/.claude/skills`, plugin);
   2. chợ plugin chính thức của Claude Code;
   3. GitHub hoặc GitLab: chỉ dự án có giấy phép rõ, có commit trong 6 tháng gần đây, từ 200 sao;
   4. không có thì tự viết (`source: "new"`).
3. **Nhận skill GitHub hoặc GitLab, một chiều: tải về, kiểm, đọc, rồi viết lại thành bản của anh hoặc cài thẳng khi đủ điều kiện (mục 3.6).** Ngoài đường cài thẳng, KHÔNG chép nguyên mã hay tài liệu của skill ngoài vào `~/.claude/skills`.
   1. **Tải về:** `node $T/skill-intake.mjs <url>` (không clone tay). Script chỉ nhận `https://github.com/<owner>/<repo>` hoặc `https://gitlab.com/<nhóm>/<repo>`, clone vào một thư mục tạm **mới, trống** (không bao giờ trong `~/.claude/skills`), tắt hook, submodule, LFS, không chạy gì trong kho. Kho vượt giới hạn (5000 file, tổng 50 MB, 5 MB mỗi file, sâu 20 thư mục) thì script dừng trước khi lấy file ra và xoá thư mục đã tạo. File quá 5 MB không được tải về (clone có lọc theo cỡ; máy chủ không hỗ trợ lọc thì script từ chối kho). Trong lúc clone, thư mục quá 100 MB thì script dừng git; giới hạn còn lại: phần tải giữa hai lần đo (200 ms) và thời gian tối đa 2 phút. Thư mục đích có sẵn phải của anh và không cho người khác ghi. Báo cáo JSON có `dir`, `repo`, `commit`, `license` (`{ package, file, verdict }`: `verdict` là mã giấy phép khi `package.json` và LICENSE ghi giống nhau, hoặc khi kho không có `package.json`, chỉ có một file giấy phép và file đó đúng nguyên văn chuẩn MIT, Apache-2.0, BSD 2 hay 3 điều (`scripts/licenses/`, chỉ khác tiêu đề và dòng bản quyền); chỉ là gợi ý, vẫn đọc LICENSE; ghi `license.verdict` vào trường `license` của skill trong đề xuất để anh thấy) và từng skill (`dir`, `name`, `ok`, `blocking`, `info`) đã qua `skill-audit.mjs`.
   2. **Kiểm hai lớp**, chỉ với các thư mục skill định học:
      - lớp 1: kết quả `skill-audit` trong báo cáo (muốn chạy lại: `node $T/skill-audit.mjs <thư mục>`);
      - lớp 2: chạy `/codex-security-review` trên thư mục đó trong `dir` đã tải.
   3. **Đọc để học:** đọc toàn bộ `SKILL.md`, tài liệu và script. Không chạy script nào của skill tải về trước khi đọc. Không có giấy phép rõ (`license.verdict` là `"unclear"`: thiếu `LICENSE`, không có `package.json` mà file không đúng nguyên văn chuẩn, hoặc hai nơi ghi khác nhau) thì chỉ học ý tưởng.
   4. Có `ok:false`, Codex thấy lỗ bảo mật, hay thấy gì lạ khi đọc: **không đưa vào đề xuất**, báo anh lý do. Ngoại lệ duy nhất là sửa dòng theo mục 3.6 khi cài thẳng.
   5. Đạt thì ghi vào đề xuất `source: "github"` (hay `source: "gitlab"`), `url`, `commit`, kết quả lớp 1 vào `audit` và kết quả lớp 2 vào `securityReview: { tool: "codex-security-review", verdict: "pass", commit }` (`commit` trùng `commit` của skill). Thiếu hay lệch lớp 2 thì `scaffold.mjs propose` từ chối.
   6. **Cài thẳng** (`mode: "installed"`) chỉ khi anh đã chấp thuận nguồn đó và đạt đủ:
      - `license.verdict` là MIT, Apache-2.0 hoặc BSD. Đọc file LICENSE, đọc từng dòng bản quyền và ghi nguyên văn vào `NOTICE`: script bỏ qua các dòng đó khi so nguyên văn, nên chỉ người đọc mới thấy điều khoản giấu trong phần tên chủ sở hữu. Dòng nào có bất cứ gì ngoài năm và tên chủ sở hữu (hạn chế, điều kiện, cho phép thêm): **dừng cài thẳng**, coi giấy phép là `"unclear"`, báo anh;
      - qua lớp 2 (`/codex-security-review`);
      - không có script, không dùng key, không gọi dịch vụ ngoài, không có lệnh đăng, gửi hay chi tiền; file nào vi phạm mà skill vẫn dùng được khi thiếu nó thì bỏ file đó, không thì không cài thẳng;
      - qua lớp 1 trên bản cài (`ok:true`). **Không nới mẫu chặn của `skill-audit`.** Dòng `sensitive-path` trỏ tới file ngữ cảnh vô hại và dòng `injection` chỉ là câu dặn chống tiêm lệnh thì sửa ngay trong skill, sửa đúng các dòng bị chặn. `secret-env` thì không sửa: skill đó không cài thẳng.

      Trình tự, để kết quả kiểm gắn đúng nội dung được cài:
      1. Chuẩn bị bản cài trên nhánh riêng trong worktree, không đụng `~/.claude/skills`, rồi commit toàn bộ (đã sửa dòng, đã bỏ file).
      2. Với từng skill lấy `tree=$(git rev-parse HEAD:<tên>)`. Chạy lớp 1 và lớp 2 trên đúng commit đó, worktree sạch.
      3. Sửa bất cứ file nào của skill sau bước 2 thì `tree` đổi: chạy lại cả hai lớp.
      4. Đề xuất ghi skill với `mode: "installed"`, `commit` ghim của nguồn, `tree`, `audit.tree` và `securityReview.tree` (cả ba trùng nhau, `scaffold.mjs propose` kiểm). Bản cài chỉ vào `~/.claude/skills` sau khi anh duyệt và merge. Auto không thay được sự chấp thuận này.
      5. Trước khi merge, so `git rev-parse <commit sẽ merge>:<tên>` với `tree` đã kiểm; khác thì dừng. Sau merge, fetch `origin/master` trong repo skills, rồi `recordThirdParty` nhận `tree`, tự so với `origin/master:<tên>` và từ chối nếu khác.

      Cách làm: chép thư mục skill từ `dir` đã kiểm vào worktree của repo skills (không dùng lệnh cài của kho, không `npx`), bỏ `evals/` và file trỏ công cụ, đối tác hay registry của tác giả, thêm `LICENSE` nguyên văn và `NOTICE` ghi repo, commit ghim, dòng đã sửa, file đã bỏ. Giữ tên gốc nếu chưa có skill trùng. Ghi nguồn bằng `recordThirdParty` với `mode: "installed"`, `edited`, `removed`, `tree`. Luật phòng ghi ở `SKILL.md` của phòng và áp lên skill cài thẳng.
4. **Kiểm công cụ máy** bằng `command -v <tên>`. Ghi `machineTools: [{ name, present, install }]` và `costs: [{ what, estimate }]` cho dịch vụ trả phí.
5. **Đề xuất:** chạy `node $T/scaffold.mjs propose --json <file>`, rồi gửi anh **đúng `summary`** làm tin duy nhất. Phiếu sang `chờ anh` kèm mã đề xuất. Chưa tạo hay cài gì.
6. **Anh trả lời "ok <id> <mã>":**
   - Mã là 8 ký tự cuối dòng của tin đề xuất. Chạy `node $T/scaffold.mjs apply <id> <mã>` với **mã lấy từ câu trả lời của anh**. Không bao giờ đọc mã từ file đề xuất hay từ `scaffold.mjs proposals`: file có thể đã bị sửa sau khi anh xem.
   - Anh chỉ gõ "ok" mà không kèm mã: hỏi lại đúng một câu, nhắc mã trong tin đề xuất.
   - Lỗi "Đề xuất đã đổi" thì gửi lại đề xuất.
   - Skill GitHub/GitLab đã kiểm: chỉ có ba đường vào `~/.claude/skills/<tên>`, với `<tên>` chỉ gồm chữ thường, số, gạch ngang (`scaffold.mjs propose` đã kiểm) và thư mục đích chưa tồn tại:
     - **viết mới theo ý tưởng** đã học (viết như một skill `source: "new"`, theo `superpowers:writing-skills`; ghi nguồn với `mode: "learned"`);
     - **chỉnh sửa lại** nội dung đã kiểm và đã đọc thành bản của anh (`mode: "adapted"`).

     - **cài thẳng** bản đã kiểm theo mục 3.6 (`mode: "installed"`).

     Hai đường đầu do agent **tự viết bằng tool Write**: không `cp`, không `git checkout` hay `curl` file vào thư mục skill. Cả ba đều ghi lại nguồn và commit đã học bằng lệnh sau:

     ```
     node --input-type=module -e "import { recordThirdParty } from '$T/skill-audit.mjs'; recordThirdParty(JSON.parse(process.argv[1]))" '<json>'
     ```

     `<json>` là `{ name, source, commit, auditedAt, findings, mode }`, `mode` là `"learned"`, `"adapted"` hoặc `"installed"` (khi đó thêm `edited`, `removed`: mảng, rỗng nếu không có; `tree`: hash cây đã qua hai lớp).
   - Skill viết lại phải qua `node $T/skill-audit.mjs <thư mục skill trong worktree>` (`ok:true`) và `/codex-impl-review` trước khi commit. Skill cài thẳng theo trình tự ở mục 3.6, thêm `/codex-impl-review` trước khi merge.
   - Skill `new`: viết theo `superpowers:writing-skills`.
   - Skill tự viết hoặc sửa lại (`new`, `learned`, `adapted`): soát theo `references/soat-skill-9-tieu-chi.md` trước khi commit. Mức "chưa nên dùng" thì sửa rồi soát lại.
   - Chạy test phòng mới, `/codex-impl-review`, commit đúng `files`, rồi giao lại phiếu đang chờ.
   - Không có sudo để cài công cụ máy: ghi lệnh vào "Chờ anh".
7. **Anh không đồng ý:** `node $T/scaffold.mjs reject <id>`, sửa theo góp ý, đề xuất lại.
