#!/usr/bin/env bash
# Test bảo mật cho auto-upgrade/run.sh và _bootstrap/sync.sh (phiếu P-20261104-033447-tei).
# Chạy: bash _bootstrap/tests/test-auto-upgrade-sync.sh   (cần git, gpg)
set -uo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
fail=0
ok()  { echo "ĐẠT  $1"; }
bad() { echo "HỎNG $1"; fail=1; }

# Dựng HOME giả: remote bare + bản clone ở $HOME/.claude/skills
setup() {
  T="$(mktemp -d)" || exit 1
  CUR_T="$T"
  export HOME="$T/home" GIT_CONFIG_GLOBAL="$T/gitconfig"
  mkdir -p "$HOME/.claude/agents" "$T/bin" "$HOME/.claude/projects/p1/memory"
  git config --global user.name t; git config --global user.email t@t
  git config --global init.defaultBranch master
  git init -q --bare "$T/remote.git"
  # remote ghi lại push option (GitLab dùng merge_request.create để mở MR)
  git -C "$T/remote.git" config receive.advertisePushOptions true
  cat > "$T/remote.git/hooks/post-receive" <<'EOS'
#!/usr/bin/env bash
i=0; while [ "$i" -lt "${GIT_PUSH_OPTION_COUNT:-0}" ]; do v="GIT_PUSH_OPTION_$i"; echo "${!v}"; i=$((i+1)); done >> "$GIT_DIR/push-options"
EOS
  chmod +x "$T/remote.git/hooks/post-receive"
  git clone -q "$T/remote.git" "$T/seed" 2>/dev/null
  mkdir -p "$T/seed/auto-upgrade" "$T/seed/_bootstrap"
  cp "$REPO/auto-upgrade/run.sh" "$T/seed/auto-upgrade/run.sh"
  cp "$REPO/_bootstrap/sync.sh" "$T/seed/_bootstrap/sync.sh"
  cp "$REPO/.gitignore" "$T/seed/.gitignore"
  echo 1 > "$T/seed/auto-upgrade/VERSION"
  git -C "$T/seed" add -A; git -C "$T/seed" commit -qm init; git -C "$T/seed" push -q origin master
  git clone -q "$T/remote.git" "$HOME/.claude/skills"
  touch "$HOME/.claude/agents/coding.md" "$HOME/.claude/skills/_bootstrap/.opt-cli-tried"
  export PATH="$T/bin:$PATH"
  # Fixture phải dựng đủ, không thì dừng hẳn (tránh ĐẠT giả trên dữ liệu rỗng).
  [ -f "$HOME/.claude/skills/auto-upgrade/run.sh" ] && [ -f "$HOME/.claude/skills/_bootstrap/sync.sh" ] \
    && [ "$(git -C "$HOME/.claude/skills" rev-parse HEAD 2>/dev/null)" = "$(git -C "$T/remote.git" rev-parse master 2>/dev/null)" ] \
    || { echo "HỎNG dựng fixture"; exit 1; }
}
trap 'rm -rf "${CUR_T:-/nonexistent}"' EXIT
remote_commit() { # thêm 1 commit lên remote từ bản seed; tham số = cấu hình ký (tuỳ chọn)
  echo "$RANDOM" >> "$T/seed/note.md"; git -C "$T/seed" add -A
  git -C "$T/seed" "$@" commit -qm upd && git -C "$T/seed" push -q origin master \
    || { echo "HỎNG tạo commit trên remote"; exit 1; }
}
fake_claude() { # $1 = việc claude giả làm sau khi ghi tham số
  cat > "$T/bin/claude" <<EOS
#!/usr/bin/env bash
printf '%s\n' "\$@" > "$T/claude-args"
git rev-parse HEAD > "$T/claude-head"
$1
EOS
  chmod +x "$T/bin/claude"
}
remote_head() { git -C "$T/remote.git" rev-parse master; }
remote_refs() { git -C "$T/remote.git" for-each-ref --format='%(refname)'; }
local_head()  { git -C "$HOME/.claude/skills" rev-parse HEAD; }

# --- run.sh ---
setup; fake_claude ":"
bash "$HOME/.claude/skills/auto-upgrade/run.sh"
A="$T/claude-args"
if grep -qxE 'Bash\((git|find):\*\)' "$A"; then bad "run.sh còn cấp Bash(git:*) / Bash(find:*)"; else ok "run.sh không cấp git/find tuỳ ý"; fi
if grep -qxE 'Write|Edit' "$A"; then bad "run.sh còn cấp Write/Edit không giới hạn đường dẫn"; else ok "run.sh không cấp Write/Edit mọi nơi"; fi
if grep -qE '^Bash\(git (fetch|pull|push|ls-remote|remote|config|-c)' "$A"; then bad "agent còn được chạy git mạng/config"; else ok "agent không có git mạng/config"; fi
if grep -qF 'Edit(./.git/**)' "$A" && grep -qF -- '--output' "$A"; then ok "chặn ghi .git và --output"; else bad "thiếu chặn ghi .git / git --output"; fi
if grep -qx -- '--restricted' "$A" && grep -qx 'dontAsk' "$A" && ! grep -qx 'acceptEdits' "$A"; then
  ok "chạy --restricted + dontAsk (không thừa hưởng settings, không tự duyệt rm/sed)"; else bad "thiếu --restricted/dontAsk hoặc còn acceptEdits"; fi
# phiếu qov: đọc và WebFetch có giới hạn
if grep -qxE 'Read|WebFetch' "$A"; then bad "run.sh còn cấp Read / WebFetch không giới hạn"; else ok "run.sh không cấp Read / WebFetch trần"; fi
miss=""
for r in 'Read(~/.ssh/**)' 'Read(~/.config/**)' 'Read(~/.claude.json)' 'Read(~/.claude/.credentials.json)' 'Read(**/.env)' 'Read(**/*credentials*)' 'Bash(git *--no-index*)' 'Bash(git commit *-F*)'; do
  grep -qxF "$r" "$A" || miss="$miss $r"
done
[ -z "$miss" ] && ok "chặn đọc file bí mật (ssh, .config, .claude.json, .env, credentials) và git đọc file ngoài repo" || bad "thiếu deny:$miss"
wf="$(grep -E '^WebFetch\(' "$A")"
if [ -n "$wf" ] && ! grep -vqxE 'WebFetch\(domain:(docs\.claude\.com|code\.claude\.com|docs\.anthropic\.com|www\.anthropic\.com|claude\.com|www\.claude\.com|github\.com|raw\.githubusercontent\.com|nextjs\.org|www\.prisma\.io)\)' <<<"$wf"; then
  ok "WebFetch chỉ tới các miền đã định"; else bad "WebFetch ngoài danh sách miền: $wf"; fi
# file bị .gitignore không vào git status/stash: mọi mẫu (trừ instincts/projects) phải có deny Edit
miss=""
while IFS= read -r g; do
  case "$g" in ''|'#'*|'auto-upgrade/instincts/projects/'|'*.pyc'|'.DS_Store') continue;; esac
  g="${g%/}"; grep -qxE "Edit\((\./|\*\*/)${g//./\\.}(/\*\*)?\)" "$A" || miss="$miss $g"
done < "$REPO/.gitignore"
[ -z "$miss" ] && ok "cấm ghi mọi đường dẫn bị .gitignore (trừ instincts/projects)" || bad "thiếu deny Edit cho file bị ignore:$miss"
dirs="$(grep -A1 -x -- '--add-dir' "$A" | grep -vx -- '--add-dir' | grep -v '^--$')"
if [ "$dirs" = "$HOME/.claude/projects/p1/memory" ]; then ok "--add-dir chỉ thư mục memory"; else bad "--add-dir rộng hơn memory: $dirs"; fi
rm -rf "$T"

setup; remote_commit; want="$(remote_head)"; fake_claude ":"
bash "$HOME/.claude/skills/auto-upgrade/run.sh"
[ "$(cat "$T/claude-head")" = "$want" ] && ok "runner tự đồng bộ trước khi gọi agent" || bad "runner không kéo bản mới trước khi gọi agent"
rm -rf "$T"

setup; before="$(remote_head)"; refs0="$(remote_refs)"
fake_claude 'echo "echo pwned" >> _bootstrap/sync.sh; git commit -qam "[auto-upgrade] v2: x"'
bash "$HOME/.claude/skills/auto-upgrade/run.sh"
[ "$(remote_refs)" = "$refs0" ] && [ "$(remote_head)" = "$before" ] && ok "không đẩy nhánh nào khi commit đụng file script" || bad "đã đẩy commit sửa file .sh"
[ "$(local_head)" = "$before" ] && ok "master local về lại bản trước (commit script chỉ ở nhánh local)" || bad "master local còn giữ commit sửa .sh"
rm -rf "$T"

setup; before="$(remote_head)"
fake_claude 'echo hi >> auto-upgrade/backlog.md; echo 2 > auto-upgrade/VERSION; git add -A; git commit -qm "[auto-upgrade] v2: x"; git branch auto-upgrade/v2; git rev-parse HEAD > '"$T"'/agent-head'
bash "$HOME/.claude/skills/auto-upgrade/run.sh"
rb="$(git -C "$T/remote.git" for-each-ref --format='%(refname:short)' 'refs/heads/auto-upgrade/run-*')"
[ "$(remote_head)" = "$before" ] && ok "commit *.md không còn tự push lên master" || bad "runner vẫn push master"
if [ -n "$rb" ] && [ "$(git -C "$T/remote.git" rev-parse "$rb")" = "$(cat "$T/agent-head")" ] \
   && grep -qx 'merge_request.create' "$T/remote.git/push-options" && grep -qx 'merge_request.target=master' "$T/remote.git/push-options"; then
  ok "commit *.md đẩy lên nhánh auto-upgrade/run-* kèm yêu cầu tạo MR vào master"; else bad "không đẩy nhánh chờ duyệt / không yêu cầu MR ($rb): $(tail -n 3 "$HOME"/.claude/skills/auto-upgrade/logs/*.log)"; fi
[ "$(local_head)" = "$before" ] && ok "master local không chạy chỉ dẫn chưa duyệt" || bad "master local còn commit chưa duyệt"
git -C "$T/remote.git" rev-parse -q --verify refs/heads/auto-upgrade/v2 >/dev/null && bad "đẩy cả nhánh version chưa duyệt" || ok "không đẩy nhánh version chưa duyệt"
rm -rf "$T"

setup; before="$(remote_head)"
fake_claude 'echo x >> _bootstrap/sync.sh; git commit -qam a; git checkout -q HEAD~1 -- _bootstrap/sync.sh; echo y >> n.md; git add -A; git commit -qm b'
bash "$HOME/.claude/skills/auto-upgrade/run.sh"
[ "$(remote_head)" = "$before" ] && ok "không push khi có commit giữa chừng đụng .sh (dù diff tổng chỉ .md)" || bad "push lọt commit .sh đã revert"
rm -rf "$T"

setup; before="$(remote_head)"; refs0="$(remote_refs)"
fake_claude 'echo y >> n.md; git add -A; git commit -qm b; exit 1'
bash "$HOME/.claude/skills/auto-upgrade/run.sh"
[ "$(remote_refs)" = "$refs0" ] && [ "$(remote_head)" = "$before" ] && ok "không đẩy gì khi claude thoát lỗi" || bad "vẫn đẩy dù claude lỗi"
rm -rf "$T"

setup; before="$(remote_head)"; refs0="$(remote_refs)"
fake_claude 'echo z >> n.md; echo "echo pwned" >> _bootstrap/sync.sh; echo new > moi.md'
bash "$HOME/.claude/skills/auto-upgrade/run.sh"
if [ "$(remote_refs)" = "$refs0" ] && [ "$(local_head)" = "$before" ] && [ -z "$(git -C "$HOME/.claude/skills" status --porcelain)" ] \
   && git -C "$HOME/.claude/skills" stash list | grep -q 'auto-upgrade'; then
  ok "thay đổi chưa commit được cất vào stash, master sạch, không đẩy"; else bad "thay đổi chưa commit còn trên master hoặc bị đẩy"; fi
rm -rf "$T"

setup; before="$(remote_head)"
fake_claude 'echo z >> n.md; git add n.md; git commit -qm "[auto-upgrade] r"; echo "echo pwned" >> _bootstrap/sync.sh'
bash "$HOME/.claude/skills/auto-upgrade/run.sh"
rb="$(git -C "$T/remote.git" for-each-ref --format='%(refname:short)' 'refs/heads/auto-upgrade/run-*')"
if [ -n "$rb" ] && ! git -C "$T/remote.git" show "$rb:_bootstrap/sync.sh" | grep -q pwned && [ "$(local_head)" = "$before" ] \
   && [ -z "$(git -C "$HOME/.claude/skills" status --porcelain)" ]; then
  ok "commit *.md kèm .sh chưa commit: chỉ đẩy commit, .sh vào stash, master sạch"; else bad "commit *.md kèm .sh chưa commit xử lý sai"; fi
rm -rf "$T"

# --- sync.sh ---
# Khoá tin cậy = GNUPGHOME riêng ngoài repo, chỉ chứa khoá công khai được phép ký master.
TRUST="$HOME/.config/agent-coding/gnupg"
gen_key() { mkdir -p "$1" && chmod 700 "$1"; GNUPGHOME="$1" gpg -q --batch --passphrase '' --quick-gen-key "$2" ed25519 sign never 2>/dev/null; }
signed_commit() { GNUPGHOME="$1" remote_commit -c commit.gpgsign=true -c user.signingkey="$2"; }
setup; TRUST="$HOME/.config/agent-coding/gnupg"
gen_key "$T/signer" good@t; gen_key "$T/other" evil@t
mkdir -p "$TRUST" && chmod 700 "$TRUST"
GNUPGHOME="$T/signer" gpg -q --export good@t | GNUPGHOME="$TRUST" gpg -q --import 2>/dev/null
before="$(local_head)"; remote_commit
bash "$HOME/.claude/skills/_bootstrap/sync.sh"
[ "$(local_head)" = "$before" ] && ok "sync.sh không kéo commit KHÔNG ký khi đã cấu hình khoá tin cậy" || bad "sync.sh kéo commit không ký"
signed_commit "$T/signer" good@t
bash "$HOME/.claude/skills/_bootstrap/sync.sh"
[ "$(local_head)" = "$(remote_head)" ] && ok "sync.sh kéo commit ký bằng khoá tin cậy" || bad "sync.sh không kéo commit ký hợp lệ"
before="$(local_head)"; signed_commit "$T/other" evil@t
bash "$HOME/.claude/skills/_bootstrap/sync.sh"
[ "$(local_head)" = "$before" ] && ok "sync.sh không kéo commit ký bằng khoá lạ" || bad "sync.sh kéo commit ký bằng khoá lạ"
for g in "$T/signer" "$T/other" "$TRUST"; do GNUPGHOME="$g" gpgconf --kill all 2>/dev/null; done
rm -rf "$T"

setup; remote_commit
bash "$HOME/.claude/skills/_bootstrap/sync.sh"
if [ "$(local_head)" = "$(remote_head)" ] && grep -q "chưa cấu hình khoá" "$HOME/.claude/skills/_bootstrap/sync.log"; then
  ok "chưa có khoá tin cậy: vẫn kéo như cũ nhưng ghi cảnh báo"; else bad "thiếu cảnh báo khi chưa có khoá tin cậy"; fi
rm -rf "$T"

exit "$fail"
