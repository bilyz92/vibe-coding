# Claude skills / agents / plugins — bộ setup cá nhân

Repo này version-control toàn bộ cấu hình Claude Code của mình: skills (`*/SKILL.md`),
agents (`_agents/`), workflow (`_orchestration/`), và manifest plugin (`_bootstrap/`).

## Cài trên MÁY MỚI

```bash
# 1. Lấy repo về đúng chỗ Claude đọc
git clone <REMOTE_URL> ~/.claude/skills

# 2. Cài agents + plugin còn thiếu (idempotent — chạy lại vô hại)
bash ~/.claude/skills/_bootstrap/install.sh

# 3. Restart Claude Code để nạp plugin/agent mới
```

Nếu `~/.claude/settings.json` cũng được đồng bộ → có **SessionStart hook** tự chạy
`install.sh` khi phát hiện thiếu agent, nên bước 2 thường tự động.

**Kiểm tra máy đã ĐỦ chưa:**
```bash
bash ~/.claude/skills/_bootstrap/doctor.sh   # PASS/WARN/FAIL từng mục; exit 1 nếu thiếu thứ bắt buộc
```
Doctor soát: repo đồng bộ master · agents khớp bản repo (bắt cả trường hợp agent lỗi thời do install.sh
không ghi đè) · plugin theo manifest · browser-use · Codex CLI + đã `codex login` chưa. FAIL → chạy `install.sh`.

**Prerequisites:** `git` + SSH key đã add GitLab (URL là `git@`), Claude Code (`claude` CLI),
`node`+`npm` (merge hook + cài Codex CLI).

`install.sh` tự cài các CLI tuỳ chọn nếu thiếu (idempotent, không đè):
- **browser-use** (headless cho polish UI) qua pipx/pip — cần **Python ≥ 3.11**; thiếu Python phù hợp thì bỏ qua.
- **Codex CLI** (`@openai/codex`, cho `/codex-*`) qua npm — ⚠️ cài binary CHƯA đủ, phải chạy **`codex login`** một lần
  trên mỗi máy (auth là bí mật per-máy, KHÔNG sync qua git được).

## ⚠️ CẬP NHẬT agent trên máy ĐÃ CÀI

`install.sh`/`sync.sh` **chỉ copy agent khi CÒN THIẾU, KHÔNG ghi đè**. Nên khi `_agents/*.md`
được nâng cấp và push, máy đã có bản cũ sẽ **không** tự cập nhật qua `git pull`. Phải copy tay:

```bash
git -C ~/.claude/skills pull --ff-only origin master
cp ~/.claude/skills/_agents/coding.md ~/.claude/agents/coding.md   # BẮT BUỘC, nếu không bản mới vô hiệu
# restart Claude Code
```

Kiểm tra đã đúng bản mới: `grep -c reward-hacking ~/.claude/agents/coding.md` (kỳ vọng ≥ 1).

## Với DỰ ÁN ĐÃ CÓ CODE (onboarding codebase)

Sau khi setup máy, với mỗi dự án đang làm dở:

```
1. Mở Claude Code trong thư mục dự án
2. Chạy /init            → sinh CLAUDE.md (tài liệu codebase cho Claude)
3. Rà & bổ sung docs:
   - Kiểm CLAUDE.md/AGENTS.md phản ánh đúng stack, quy ước, lệnh build/test
   - Bổ sung doc còn thiếu cho module quan trọng (kiến trúc, quy trình deploy)
4. (tuỳ) /ui-ux-review, /codex-impl-review để nắm chất lượng hiện trạng
```

> `/init` chỉ nên chạy 1 lần/dự án (hoặc khi cấu trúc đổi lớn). Đừng chạy đè lên
> CLAUDE.md đã tinh chỉnh tay — xem lại diff trước khi ghi.

## Thành phần

| Nhóm | Nội dung |
|------|----------|
| Workflow | `dev-workflow`, `codex-pair-dev`, `auto-upgrade` |
| Review Codex | `codex-*` (impl/plan/pr/security/commit/think/parallel/codebase) |
| UI | `baseline-ui`, `fixing-accessibility`, `fixing-metadata`, `ui-ux-review`, `ui-ux-pro-max` |
| Bảo mật/Deploy | `vibesec`, `safe-deploy` |
| Agents | `_agents/coding.md`, `_agents/planner.md` |
| Orchestration | `_orchestration/big-task.workflow.mjs` |
| Bootstrap | `_bootstrap/install.sh`, `_bootstrap/plugins.manifest` |

## Version & dùng lại bản cũ

Mỗi vòng `/auto-upgrade` tạo một branch snapshot `auto-upgrade/v<N>` (số ở `auto-upgrade/VERSION`).
Master = bản mới nhất đang dùng; các branch version = điểm khôi phục cố định.

```bash
git -C ~/.claude/skills branch -a | grep auto-upgrade/v   # liệt kê các version
git -C ~/.claude/skills checkout auto-upgrade/v3          # DÙNG lại version 3 (rồi restart Claude)
git -C ~/.claude/skills checkout master                  # về bản mới nhất
```

## Rollback nhanh (không đổi version)

```bash
git -C ~/.claude/skills log --oneline      # xem lịch sử
git -C ~/.claude/skills reset --hard <hash> # về mốc trước
```

## Cập nhật khi thêm plugin mới

Thêm dòng vào `_bootstrap/plugins.manifest` (`<marketplace_source> | <plugin@marketplace>`),
commit, push. Máy khác chạy `install.sh` sẽ tự cài.
