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
    if git pull --ff-only --quiet origin master >>"$LOG" 2>&1; then
      after="$(git rev-parse HEAD 2>/dev/null)"
      [ "$before" != "$after" ] && echo "[$ts] auto-update $before → $after" >>"$LOG"
    else
      echo "[$ts] pull bỏ qua (không ff / offline / chưa auth)" >>"$LOG"
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
