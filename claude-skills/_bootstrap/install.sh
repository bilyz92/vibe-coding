#!/usr/bin/env bash
# Bootstrap Claude setup trên máy mới — IDEMPOTENT (chỉ cài cái còn THIẾU).
#
# Điều kiện: repo skills này đã được clone về ~/.claude/skills (git clone <remote> ~/.claude/skills).
# Chạy:      bash ~/.claude/skills/_bootstrap/install.sh
#
# Làm gì:
#   1. Copy agents (_agents/*.md) sang ~/.claude/agents nếu thiếu.
#   2. Cài plugin trong plugins.manifest nếu chưa có (thêm marketplace khi cần).
# KHÔNG ghi đè file đã có → an toàn chạy lại nhiều lần.
# Mọi thứ tải về đều ghim phiên bản: marketplace phải đúng commit ghi trong plugins.manifest, CLI cài đúng
# phiên bản dưới đây (codex còn kiểm sha512 tarball). Nâng phiên bản = sửa các dòng này qua MR có người duyệt.

set -uo pipefail
SKILLS_DIR="$HOME/.claude/skills"
SELF_DIR="$SKILLS_DIR/_bootstrap"
changed=0
CODEX_VERSION="0.166.0"
CODEX_INTEGRITY="sha512-2Szlp1l1cz5TX1ccpX4Zok3DZrot9xeZe0km+6/1v8JmqxADwyJxKBJah4dBymkwtS25j/u6dipJusTOI97Z8Q=="
BROWSER_USE_VERSION="0.13.1"

echo "== Bootstrap Claude skills/agents/plugins =="

# --- 1. Agents ---
mkdir -p "$HOME/.claude/agents"
for f in "$SKILLS_DIR"/_agents/*.md; do
  [ -e "$f" ] || continue
  dest="$HOME/.claude/agents/$(basename "$f")"
  if [ ! -f "$dest" ]; then
    cp "$f" "$dest"; echo "  + agent: $(basename "$f")"; changed=1
  fi
done

# --- 2. Plugins ---
if ! command -v claude >/dev/null 2>&1; then
  echo "  ! chưa có 'claude' CLI — bỏ qua phần plugin. Cài Claude Code rồi chạy lại."
else
  installed="$(claude plugin list 2>/dev/null || echo '')"
  added_mp=""
  while IFS='|' read -r mp plugin pin; do
    mp="$(echo "$mp" | xargs)"; plugin="$(echo "$plugin" | xargs)"; pin="$(echo "$pin" | xargs)"
    case "$mp" in ''|\#*) continue;; esac   # bỏ dòng trống/comment
    [ -z "$plugin" ] && continue
    if echo "$installed" | grep -q "${plugin%@*}"; then
      continue   # đã cài
    fi
    # thêm marketplace (một lần / phiên chạy)
    if ! echo "$added_mp" | grep -q "$mp"; then
      claude plugin marketplace add "$mp" >/dev/null 2>&1 || true
      added_mp="$added_mp $mp"
    fi
    # Marketplace chỉ ghim được nhánh/tag (clone --branch) nên kiểm commit sau khi tải: lệch → không cài.
    head="$(git -C "$HOME/.claude/plugins/marketplaces/${plugin#*@}" rev-parse HEAD 2>/dev/null)"
    if ! [[ "$pin" =~ ^[0-9a-f]{40}$ ]] || [ "$head" != "$pin" ]; then
      echo "  ! không cài $plugin: marketplace ở commit ${head:-?}, manifest ghim ${pin:-chưa ghim} — kiểm tay rồi sửa manifest qua MR"
      continue
    fi
    if claude plugin install "$plugin" >/dev/null 2>&1; then
      echo "  + plugin: $plugin"; changed=1
    else
      echo "  ! không cài được: $plugin (kiểm tra thủ công)"
    fi
  done < "$SELF_DIR/plugins.manifest"
fi

# --- 2b. browser-use (CLI headless cho skill browser-use / polish UI) ---
# CLI Python riêng, KHÔNG phải plugin → phải cài tách. Cần Python >= 3.11.
# Chỉ cài khi THIẾU; không đè. Best-effort — lỗi ở đây không làm gãy bootstrap.
if command -v browser-use >/dev/null 2>&1; then
  : # đã có, bỏ qua
elif command -v pipx >/dev/null 2>&1; then
  if pipx install "browser-use==$BROWSER_USE_VERSION" >/dev/null 2>&1; then
    echo "  + browser-use (pipx)"; changed=1
  else
    echo "  ! không cài được browser-use qua pipx (cần Python>=3.11) — cài tay nếu cần"
  fi
elif command -v pip3 >/dev/null 2>&1 || command -v pip >/dev/null 2>&1; then
  pipcmd="$(command -v pip3 || command -v pip)"
  if "$pipcmd" install --user "browser-use==$BROWSER_USE_VERSION" >/dev/null 2>&1; then
    echo "  + browser-use (pip --user)"; changed=1
  else
    echo "  ! không cài được browser-use qua pip (cần Python>=3.11) — cài tay nếu cần"
  fi
else
  echo "  ! chưa có pipx/pip — bỏ qua browser-use. Cài Python>=3.11 + 'pipx install browser-use' nếu cần polish UI headless."
fi

# --- 2c. Codex CLI (@openai/codex) — cho các skill /codex-* ---
# npm global; đi kèm node (đã là prerequisite). Chỉ cài khi THIẾU; không đè.
# LƯU Ý: cài binary KHÔNG đủ để chạy — cần 'codex login' (auth per-máy, KHÔNG sync được).
if command -v codex >/dev/null 2>&1; then
  : # đã có
elif command -v npm >/dev/null 2>&1; then
  # Tải tarball, tự tính sha512 so với bản ghim, rồi cài đúng tarball đã kiểm (không để npm tải lại).
  tgz_dir="$(mktemp -d)"
  tgz="$(cd "$tgz_dir" && npm pack --silent "@openai/codex@$CODEX_VERSION" 2>/dev/null | tail -n 1)"
  got=""
  [ -n "$tgz" ] && [ -f "$tgz_dir/$tgz" ] && got="sha512-$(openssl dgst -sha512 -binary "$tgz_dir/$tgz" | base64 | tr -d '\n')"
  if [ "$got" != "$CODEX_INTEGRITY" ]; then
    echo "  ! tarball @openai/codex@$CODEX_VERSION không khớp sha512 đã ghim (${got:-không tải được}) — không cài"
  elif npm install -g "$tgz_dir/$tgz" >/dev/null 2>&1; then
    echo "  + codex CLI (@openai/codex) — nhớ chạy 'codex login' để dùng được"; changed=1
  else
    echo "  ! không cài được @openai/codex qua npm — cài tay nếu cần /codex-*"
  fi
  rm -rf "$tgz_dir"
else
  echo "  ! chưa có npm — bỏ qua Codex CLI. Cài node + 'npm i -g @openai/codex' nếu cần /codex-*."
fi

# --- 3. SessionStart hook (auto-sync mỗi phiên) ---
# Cài hook vào ~/.claude/settings.json nếu chưa có. Idempotent, merge an toàn bằng node.
if command -v node >/dev/null 2>&1; then
  node - <<'NODE'
const fs = require('fs');
const p = process.env.HOME + '/.claude/settings.json';
let s = {};
try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
s.hooks = s.hooks || {};
let changed = false;
// SessionStart: auto-sync
const ss = s.hooks.SessionStart = s.hooks.SessionStart || [];
if (!JSON.stringify(ss).includes('_bootstrap/sync.sh')) {
  ss.push({ hooks: [{ type: 'command', command: 'bash "$HOME/.claude/skills/_bootstrap/sync.sh"' }] });
  changed = true; console.log('  + SessionStart hook: auto-sync');
}
// PreToolUse Bash: nhắc clean-code khi git commit
const pt = s.hooks.PreToolUse = s.hooks.PreToolUse || [];
if (!JSON.stringify(pt).includes('hook-precommit-cleancode.sh')) {
  pt.push({ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash "$HOME/.claude/skills/_bootstrap/hook-precommit-cleancode.sh"' }] });
  changed = true; console.log('  + PreToolUse hook: clean-code gate');
}
if (changed) fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
NODE
else
  echo "  ! không có node — bỏ qua cài hook auto-sync (thêm tay vào settings.json)"
fi

if [ "$changed" -eq 0 ]; then
  echo "== Đã đầy đủ, không thiếu gì. =="
else
  echo "== Xong. RESTART Claude Code để nạp plugin/agent mới. =="
fi
