#!/usr/bin/env bash
# Auto-upgrade runner — cron gọi file này hàng tuần.
# Chạy claude headless với skill auto-upgrade, scope trong ~/.claude/skills.
# Tắt nhanh: tạo file ~/.claude/skills/auto-upgrade/DISABLED  (hoặc `crontab -e` xoá dòng).

set -uo pipefail

SKILLS_DIR="$HOME/.claude/skills"
SELF_DIR="$SKILLS_DIR/auto-upgrade"
LOG_DIR="$SELF_DIR/logs"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$STAMP.log"

# --- Kill switch ---
if [ -f "$SELF_DIR/DISABLED" ]; then
  echo "[$STAMP] DISABLED file tồn tại — bỏ qua." >> "$LOG"
  exit 0
fi

# --- An toàn: repo phải sạch trước khi chạy (tránh chồng lên thay đổi tay đang dở) ---
cd "$SKILLS_DIR" || { echo "[$STAMP] không cd được vào skills" >> "$LOG"; exit 1; }
if [ "$(git branch --show-current 2>/dev/null)" != "master" ]; then
  echo "[$STAMP] không ở branch master (đang dùng version cũ?) — dừng để không commit nhầm branch." >> "$LOG"
  exit 0
fi
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "[$STAMP] repo có thay đổi chưa commit — dừng để tránh trộn lẫn." >> "$LOG"
  exit 0
fi

# --- Đồng bộ (runner làm, agent KHÔNG có quyền git mạng) ---
if git remote get-url origin >/dev/null 2>&1; then
  if ! { git fetch --quiet origin && git merge --ff-only --quiet origin/master; } >> "$LOG" 2>&1; then
    echo "[$STAMP] không fast-forward được về origin/master — cần user xử lý tay: $(git rev-list --left-right --count master...origin/master 2>/dev/null)" >> "$LOG"
    exit 0
  fi
fi
BEFORE="$(git rev-parse HEAD)"

PROMPT='Chạy skill auto-upgrade một vòng (headless qua run.sh: runner đã đồng bộ, và sau khi bạn xong sẽ đưa commit sang nhánh auto-upgrade/run-* chờ người duyệt qua MR — bỏ phần fetch/pull ở bước 0 và bước 8). Tuân THẬT NGHIÊM các HARD CONSTRAINTS trong skill: chỉ ghi trong ~/.claude/skills, tối đa 1 thay đổi, không xoá/ghi đè phá huỷ, mỗi thay đổi commit riêng prefix [auto-upgrade], luôn ghi report. Nếu không có gì đáng đổi thì no-op + report.'

# Headless. Nội dung web có thể chứa lệnh tiêm (prompt injection) nên khoá chặt quyền:
# - --restricted: bỏ qua settings user/project/local (không thừa hưởng allow rộng), file tool chỉ trong
#   thư mục làm việc (+ --add-dir chỉ các thư mục memory để ĐỌC), ghi file git/settings luôn bị từ chối.
# - dontAsk: mọi thứ ngoài allowedTools bị từ chối (acceptEdits sẽ tự duyệt rm/mv/sed... nên KHÔNG dùng).
# - Ghi: file bị .gitignore không lọt vào git status/stash nên cấm ghi (gstack/ chứa script chạy được), trừ
#   auto-upgrade/instincts/projects/ (instinct local theo SKILL.md).
# - Đọc: chỉ repo skills và memory; cấm thêm (phòng khi giới hạn thư mục lọt) khoá SSH, ~/.config, ~/.claude.json,
#   .env, credentials, khoá riêng. WebFetch chỉ tới các miền trong WEB_DOMAINS (không gửi được dữ liệu tới miền lạ).
# - git: chỉ lệnh cục bộ cần cho skill; KHÔNG fetch/pull/push/config/-c (--upload-pack, core.* chạy được lệnh),
#   cấm --output / --no-index / commit -F (đọc-ghi file ngoài repo). Không cấp find (-exec/-delete) hay ls; dùng Glob.
WEB_DOMAINS=(docs.claude.com code.claude.com docs.anthropic.com www.anthropic.com claude.com www.claude.com
  github.com raw.githubusercontent.com nextjs.org www.prisma.io)
web_allow=()
for d in "${WEB_DOMAINS[@]}"; do web_allow+=("WebFetch(domain:$d)"); done
mem_dirs=()
for d in "$HOME"/.claude/projects/*/memory; do
  [ -d "$d" ] && [ ! -L "$d" ] && mem_dirs+=(--add-dir "$d")
done
echo "[$STAMP] bắt đầu" >> "$LOG"
claude -p "$PROMPT" \
  --restricted --strict-mcp-config --permission-mode dontAsk \
  ${mem_dirs[@]+"${mem_dirs[@]}"} \
  --tools "WebSearch,WebFetch,Read,Glob,Grep,Edit,Write,Bash" \
  --allowedTools "WebSearch" "${web_allow[@]}" "Read(./**)" "Read(~/.claude/projects/*/memory/**)" "Glob" "Grep" "Edit(./**)" \
    "Bash(git status:*)" "Bash(git log:*)" "Bash(git diff:*)" "Bash(git show:*)" \
    "Bash(git rev-parse:*)" "Bash(git rev-list:*)" "Bash(git branch --show-current)" \
    "Bash(git add:*)" "Bash(git commit:*)" "Bash(git branch auto-upgrade/v*)" \
  --disallowedTools "Edit(./.git/**)" "Bash(git *--output*)" "Bash(git *--no-index*)" \
    "Edit(./gstack/**)" "Edit(./.claude/**)" "Edit(./.agents/**)" "Edit(./synced/**)" "Edit(./.codex-review/**)" \
    "Edit(**/node_modules/**)" "Edit(**/__pycache__/**)" "Edit(./auto-upgrade/logs/**)" "Edit(./auto-upgrade/DISABLED)" \
    "Edit(./_bootstrap/bootstrap.log)" "Edit(./_bootstrap/sync.log)" "Edit(./_bootstrap/.opt-cli-tried)" \
    "Bash(git commit *-F*)" "Bash(git commit *--file*)" "Bash(git commit *--template*)" \
    "Read(~/.ssh/**)" "Read(~/.config/**)" "Read(~/.aws/**)" "Read(~/.gnupg/**)" "Read(~/.codex/**)" \
    "Read(~/.docker/**)" "Read(~/.kube/**)" "Read(~/.claude.json)" "Read(~/.claude/.credentials.json)" \
    "Read(~/.netrc)" "Read(~/.git-credentials)" "Read(~/.npmrc)" "Read(~/.pypirc)" \
    "Read(**/.env)" "Read(**/.env.*)" "Read(**/*credentials*)" "Read(**/*.pem)" "Read(**/*.key)" \
    "Read(**/id_rsa*)" "Read(**/id_ed25519*)" \
  >> "$LOG" 2>&1
claude_rc=$?
echo "[$STAMP] kết thúc (exit $claude_rc)" >> "$LOG"

# --- Chờ người duyệt (runner làm) — KHÔNG bao giờ push master ---
# Commit mới của agent rời master sang nhánh auto-upgrade/run-<giờ>; master local về lại bản trước khi chạy để
# chỉ dẫn chưa duyệt không có hiệu lực trên máy này và không lan qua sync.sh. Nhánh chỉ được đẩy lên kèm yêu cầu
# tạo MR (push option GitLab) khi claude thoát 0 và mọi commit mới chỉ đụng *.md / VERSION (commit đụng
# script/CI/config có thể chạy lệnh trên CI hay máy khác → chỉ giữ nhánh local).
# Thay đổi chưa commit (kể cả file mới) cũng là chỉ dẫn chưa duyệt: cất vào git stash, không bao giờ đẩy.
tree_ok=1
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  if git stash push --quiet --include-untracked -m "auto-upgrade $STAMP: chưa commit, chờ duyệt" >> "$LOG" 2>&1; then
    echo "[$STAMP] thay đổi chưa commit đã cất vào git stash (auto-upgrade $STAMP) — không đẩy" >> "$LOG"
  else
    tree_ok=0; echo "[$STAMP] KHÔNG cất được thay đổi chưa commit — cần user xử lý tay" >> "$LOG"
  fi
fi
if [ "$(git branch --show-current)" = "master" ] && [ "$(git rev-parse HEAD)" != "$BEFORE" ]; then
  review="auto-upgrade/run-$STAMP"
  # Xét TỪNG commit mới (không chỉ diff tổng: sửa .sh rồi revert vẫn bị chặn).
  other="$(git log --format= --name-only "$BEFORE"..HEAD | grep -vE '^$|\.md$|^auto-upgrade/VERSION$' | sort -u)"
  rewritten=0; git merge-base --is-ancestor "$BEFORE" HEAD || rewritten=1
  if [ "$tree_ok" -ne 1 ] || ! git branch "$review" HEAD || ! git reset --quiet --keep "$BEFORE"; then
    echo "[$STAMP] KHÔNG đưa được commit sang $review — master local còn commit chưa duyệt, cần user xử lý tay" >> "$LOG"
  elif [ "$claude_rc" -ne 0 ]; then
    echo "[$STAMP] KHÔNG đẩy: claude lỗi — commit giữ ở nhánh local $review" >> "$LOG"
  elif [ "$rewritten" -eq 1 ]; then
    echo "[$STAMP] KHÔNG đẩy: lịch sử master bị viết lại — commit giữ ở nhánh local $review" >> "$LOG"
  elif [ -n "$other" ]; then
    echo "[$STAMP] KHÔNG đẩy: commit đụng file ngoài *.md/VERSION — giữ ở nhánh local $review: $other" >> "$LOG"
  elif git remote get-url origin >/dev/null 2>&1; then
    if git push --quiet -o merge_request.create -o merge_request.target=master \
        -o "merge_request.title=[auto-upgrade] $STAMP chờ duyệt" origin "refs/heads/$review:refs/heads/$review" >> "$LOG" 2>&1; then
      echo "[$STAMP] đã đẩy $review và yêu cầu tạo MR vào master — chờ người duyệt" >> "$LOG"
    else
      echo "[$STAMP] push $review bị từ chối — commit giữ ở nhánh local, cần user xử lý tay" >> "$LOG"
    fi
  fi
elif [ "$claude_rc" -ne 0 ]; then
  echo "[$STAMP] claude lỗi, không có commit mới" >> "$LOG"
fi

# Dọn log cũ hơn 60 ngày
find "$LOG_DIR" -name '*.log' -mtime +60 -delete 2>/dev/null

exit 0
