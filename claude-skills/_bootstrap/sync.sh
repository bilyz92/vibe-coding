#!/usr/bin/env bash
# Auto-sync — gọi từ SessionStart hook mỗi phiên. KHÔNG hỏi, KHÔNG phá vỡ.
# Kéo version mới nhất về (fast-forward, không clobber), đảm bảo agents/plugins.
set -uo pipefail
SK="$HOME/.claude/skills"
LOG="$SK/_bootstrap/sync.log"
cd "$SK" 2>/dev/null || exit 0
ts="$(date '+%F %T' 2>/dev/null || echo now)"

# 1. Auto-pull — CHỈ khi: có remote + đang ở master + tree sạch.
#    (Đang ở branch version cũ = user cố ý dùng ver cũ → KHÔNG kéo lên latest.)
if git remote get-url origin >/dev/null 2>&1; then
  branch="$(git branch --show-current 2>/dev/null)"
  if [ "$branch" = "master" ] && [ -z "$(git status --porcelain)" ]; then
    before="$(git rev-parse HEAD 2>/dev/null)"
    # Khoá tin cậy: GNUPGHOME riêng NGOÀI repo, chỉ chứa khoá công khai được phép ký master.
    # Có thư mục này → chỉ kéo khi đầu master mới có chữ ký hợp lệ của một khoá trong đó.
    trust="$HOME/.config/agent-coding/gnupg"
    if ! git fetch --quiet origin master >>"$LOG" 2>&1; then
      echo "[$ts] pull bỏ qua (offline / chưa auth)" >>"$LOG"
    else
      new="$(git rev-parse FETCH_HEAD 2>/dev/null)"
      if [ "$new" = "$before" ]; then
        :
      elif [ -d "$trust" ] && ! GNUPGHOME="$trust" git verify-commit "$new" >>"$LOG" 2>&1; then
        echo "[$ts] KHÔNG kéo $new: thiếu chữ ký hợp lệ của khoá tin cậy ($trust)" >>"$LOG"
      else
        [ -d "$trust" ] || echo "[$ts] CẢNH BÁO: chưa cấu hình khoá tin cậy ($trust) — kéo không kiểm chữ ký" >>"$LOG"
        if git merge --ff-only --quiet "$new" >>"$LOG" 2>&1; then
          echo "[$ts] auto-update $before → $new" >>"$LOG"
        else
          echo "[$ts] pull bỏ qua (không ff)" >>"$LOG"
        fi
      fi
    fi
  else
    echo "[$ts] skip pull (branch=$branch, hoặc tree bẩn)" >>"$LOG"
  fi
fi

# 2. Đảm bảo agents + plugin + CLI tuỳ chọn (browser-use, codex) — chỉ chạy install khi THIẾU.
#    CLI tuỳ chọn: chỉ tự thử MỘT LẦN (marker) để máy không cài được không chạy lại mỗi phiên.
need_install=0
[ -f "$HOME/.claude/agents/coding.md" ] || need_install=1
if [ ! -f "$SK/_bootstrap/.opt-cli-tried" ]; then
  if ! command -v browser-use >/dev/null 2>&1 || ! command -v codex >/dev/null 2>&1; then
    need_install=1
  fi
  touch "$SK/_bootstrap/.opt-cli-tried"
fi
[ "$need_install" = 1 ] && bash "$SK/_bootstrap/install.sh" >>"$LOG" 2>&1

exit 0
