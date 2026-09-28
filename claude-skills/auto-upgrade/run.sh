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
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "[$STAMP] repo có thay đổi chưa commit — dừng để tránh trộn lẫn." >> "$LOG"
  exit 0
fi

PROMPT='Chạy skill auto-upgrade một vòng. Tuân THẬT NGHIÊM các HARD CONSTRAINTS trong skill: chỉ ghi trong ~/.claude/skills, tối đa 1 thay đổi, không xoá/ghi đè phá huỷ, mỗi thay đổi commit riêng prefix [auto-upgrade], luôn ghi report. Nếu không có gì đáng đổi thì no-op + report.'

# Headless. Whitelist đúng tool cần: quét web + đọc/ghi skill + git. Lệnh ngoài danh sách bị chặn.
echo "[$STAMP] bắt đầu" >> "$LOG"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "WebSearch" "WebFetch" "Read" "Write" "Edit" "Glob" "Grep" "Bash(git:*)" "Bash(ls:*)" "Bash(find:*)" \
  >> "$LOG" 2>&1
echo "[$STAMP] kết thúc (exit $?)" >> "$LOG"

# Dọn log cũ hơn 60 ngày
find "$LOG_DIR" -name '*.log' -mtime +60 -delete 2>/dev/null

exit 0
