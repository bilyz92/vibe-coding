#!/usr/bin/env bash
# doctor — kiểm tra máy đã có ĐỦ setup chưa (agents + plugin + CLI tuỳ chọn).
# Chạy: bash ~/.claude/skills/_bootstrap/doctor.sh
# Exit: 0 = đủ (không FAIL). 1 = có FAIL (thiếu thứ bắt buộc).
# Quy ước: [PASS] ổn · [WARN] tuỳ chọn/không tự sửa được · [FAIL] thiếu thứ nên có → chạy install.sh.
set -uo pipefail
SK="$HOME/.claude/skills"
fail=0; warn=0

pass(){ echo "  [PASS] $1"; }
fw()  { echo "  [FAIL] $1"; fail=1; }
wn()  { echo "  [WARN] $1"; warn=1; }

echo "== Doctor: kiểm tra setup Claude (agents/plugin/CLI) =="

# 1. Repo skills + đồng bộ master
echo "-- Repo skills"
if [ -d "$SK/.git" ]; then
  pass "repo tồn tại: $SK"
  cd "$SK" || exit 2
  branch="$(git branch --show-current 2>/dev/null)"
  [ "$branch" = "master" ] && pass "đang ở master" || wn "đang ở branch '$branch' (không phải master → có thể là bản cũ cố ý)"
  if git remote get-url origin >/dev/null 2>&1; then
    git fetch origin master --quiet 2>/dev/null || true
    local_h="$(git rev-parse HEAD 2>/dev/null)"
    remote_h="$(git rev-parse origin/master 2>/dev/null || echo '?')"
    [ "$local_h" = "$remote_h" ] && pass "đồng bộ với origin/master" || wn "lệch origin/master (chạy: git -C $SK pull --ff-only origin master)"
  else
    wn "không có remote origin"
  fi
else
  fw "chưa clone repo về $SK"
fi

# 2. Agents — tồn tại VÀ khớp bản trong repo (install.sh không ghi đè → dễ lỗi thời)
echo "-- Agents"
for f in "$SK"/_agents/*.md; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"; dest="$HOME/.claude/agents/$base"
  if [ ! -f "$dest" ]; then
    fw "thiếu agent: $base (chạy install.sh)"
  elif ! diff -q "$f" "$dest" >/dev/null 2>&1; then
    fw "agent LỖI THỜI: $base ≠ bản repo (chạy: cp $f $dest)"
  else
    pass "agent khớp: $base"
  fi
done

# 3. Plugins theo manifest
echo "-- Plugins (manifest)"
if command -v claude >/dev/null 2>&1; then
  installed="$(claude plugin list 2>/dev/null || echo '')"
  while IFS='|' read -r _mp plugin; do
    plugin="$(echo "$plugin" | xargs)"; name="${plugin%@*}"
    case "$_mp" in ''|\#*) continue;; esac; [ -z "$plugin" ] && continue
    if echo "$installed" | grep -q "$name"; then pass "plugin: $name"; else fw "thiếu plugin: $name (chạy install.sh)"; fi
  done < "$SK/_bootstrap/plugins.manifest"
else
  wn "chưa có 'claude' CLI → không kiểm tra được plugin"
fi

# 4. browser-use (tuỳ chọn — polish UI headless)
echo "-- browser-use"
command -v browser-use >/dev/null 2>&1 && pass "browser-use: $(command -v browser-use)" \
  || wn "thiếu browser-use (cần Python>=3.11; chạy install.sh hoặc 'pipx install browser-use')"

# 5. Codex CLI + auth (cho /codex-*)
echo "-- Codex CLI"
if command -v codex >/dev/null 2>&1; then
  pass "codex: $(command -v codex)"
  [ -f "$HOME/.codex/auth.json" ] && pass "codex đã login (~/.codex/auth.json)" \
    || wn "codex CHƯA login → /codex-* không chạy được (chạy: codex login)"
else
  wn "thiếu Codex CLI (chạy install.sh hoặc 'npm i -g @openai/codex', rồi 'codex login')"
fi

echo "== Kết quả: FAIL=$fail WARN=$warn =="
if [ "$fail" -ne 0 ]; then echo "→ THIẾU thứ bắt buộc. Chạy: bash $SK/_bootstrap/install.sh"; exit 1; fi
[ "$warn" -ne 0 ] && echo "→ Đủ phần bắt buộc; còn WARN (tuỳ chọn/cần thao tác tay ở trên)." || echo "→ ĐỦ TOÀN BỘ. ✅"
exit 0
