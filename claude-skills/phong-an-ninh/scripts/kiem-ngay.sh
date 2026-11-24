#!/usr/bin/env bash
# Phòng An ninh: kiểm máy hằng ngày, CHỈ ĐỌC. Ghi ~/.claude/company/an-ninh/<ngày>.md (600).
# Không in nội dung file bí mật (chỉ tên, quyền, ngày), không sudo, không quét mạng, không sửa gì ngoài file báo cáo.
# Dùng: kiem-ngay.sh [thư mục ra]   (cron đề xuất: 0 7 * * * <đường dẫn>/kiem-ngay.sh)
set -u
OUT_DIR=${1:-$HOME/.claude/company/an-ninh}
ANH_CHAT=5813010686
umask 077
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/$(date +%F).md"
exec >"$OUT"

echo "# Kiểm an ninh máy $(date '+%F %H:%M')"
echo
echo "## File bí mật trong ~/.config đọc được bởi người khác (phải 600, thư mục 700)"
if [ -d "$HOME/.config" ]; then
  # (bỏ thư mục của trình duyệt, trình soạn thảo, công cụ: tên file trùng mẫu nhưng không phải khoá của anh)
  lo=$(find "$HOME/.config" -xdev \( -path "$HOME/.config/google-chrome" -o -path "$HOME/.config/chromium" -o -path "$HOME/.config/BraveSoftware" \
      -o -path "$HOME/.config/sublime-text" -o -path "$HOME/.config/Code" -o -path "$HOME/.config/go" \) -prune -o \
      \( -type f -perm /077 -o -type d -perm /077 \) ! -name '*.py' ! -name '*keymap*' ! -name '*keybindings*' \
      \( -iname '*token*' -o -iname '*secret*' -o -iname '*key*' -o -iname '*password*' -o -iname '*.pem' -o -iname '*cred*' \) \
      -printf '- %m %u %TF %p\n' 2>/dev/null)
  [ -n "$lo" ] && printf '%s\n' "$lo" | head -50
  echo "Tổng: $(printf '%s' "$lo" | grep -c '^- ')"
fi
echo
echo "## Cổng đang nghe (ss -tlnp; chỉ máy này)"
ss -tlnpH 2>/dev/null | awk '{print "- " $4 " " $6}' | sed 's/users:((//; s/,pid=[0-9]*,fd=[0-9]*//g; s/))//' | sort -u
echo
echo "## Container đang chạy (docker ps)"
if command -v docker >/dev/null; then
  docker ps --format '- {{.Names}} | {{.Image}} | {{.Ports}}' 2>/dev/null || echo "- không đọc được docker"
fi
echo
echo "## Tiến trình dùng nhiều CPU nhất"
ps -eo user,pid,pcpu,pmem,comm --sort=-pcpu 2>/dev/null | head -8 | sed 's/^/    /'
echo
echo "## Đăng nhập SSH hôm qua và hôm nay (auth.log, nếu đọc được không cần quyền root)"
if [ -r /var/log/auth.log ]; then
  d1=$(date '+%b %e'); d0=$(date -d yesterday '+%b %e')
  ssh=$(grep -E "^($d1|$d0) " /var/log/auth.log 2>/dev/null | grep -E 'sshd.*(Accepted|Failed password|Invalid user)')
  echo "- Thành công: $(printf '%s' "$ssh" | grep -c Accepted)"
  echo "- Thất bại hoặc user lạ: $(printf '%s' "$ssh" | grep -cE 'Failed password|Invalid user')"
  printf '%s\n' "$ssh" | grep Accepted | tail -5 | sed 's/^/    /'
else
  echo "- auth.log không đọc được"
fi
echo
echo "## Đĩa"
df -h / "$HOME" 2>/dev/null | sed 's/^/    /'
echo
echo "## Sao lưu (danh sách đường dẫn trong $OUT_DIR/sao-luu.txt)"
if [ -f "$OUT_DIR/sao-luu.txt" ]; then
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    p=${p/#\~/$HOME}
    if [ -e "$p" ]; then
      m=$(find "$p" -type f -printf '%T@\n' 2>/dev/null | sort -n | tail -1)
      [ -n "$m" ] && echo "- $p: mới nhất $(( ( $(date +%s) - ${m%.*} ) / 3600 )) giờ trước" || echo "- $p: trống"
    else
      echo "- $p: không có"
    fi
  done < "$OUT_DIR/sao-luu.txt"
else
  echo "- chưa khai báo thư mục sao lưu"
fi
echo
echo "## Telegram allowlist"
A="$HOME/.claude/channels/telegram/access.json"
if [ -r "$A" ]; then
  python3 -I -c 'import json,sys
j=json.load(open(sys.argv[1])); a=[str(x) for x in j.get("allowFrom") or []]; la=[x for x in a if x!=sys.argv[2]]
print("- allowFrom: %d mục, lạ: %d%s; dmPolicy: %s; pending: %d" % (len(a), len(la), " (" + ", ".join(la) + ")" if la else "", j.get("dmPolicy"), len(j.get("pending") or {})))' "$A" "$ANH_CHAT" 2>/dev/null || echo "- không đọc được access.json (thiếu python3 hoặc file hỏng)"
else
  echo "- không có access.json"
fi
