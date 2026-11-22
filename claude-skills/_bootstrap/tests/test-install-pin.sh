#!/usr/bin/env bash
# Test ghim phiên bản cho _bootstrap/install.sh (phiếu P-20261105-022156-qov).
# Chạy: bash _bootstrap/tests/test-install-pin.sh   (cần git; claude/npm/pipx là bản giả)
set -uo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
fail=0
ok()  { echo "ĐẠT  $1"; }
bad() { echo "HỎNG $1"; fail=1; }
trap 'rm -rf "${T:-/nonexistent}"' EXIT

# HOME giả có install.sh, một marketplace giả (repo git) và claude/npm/pipx giả ghi lại lệnh vào $T/calls.
setup() { # $1 = commit ghim trong manifest ("HEAD" = đúng commit của marketplace giả), $2 = nội dung tarball npm pack trả về
  T="$(mktemp -d)" || exit 1
  export HOME="$T/home" GIT_CONFIG_GLOBAL="$T/gitconfig" PATH="$T/bin:/usr/bin:/bin" FAKE_TGZ="$2"
  mkdir -p "$HOME/.claude/skills/_bootstrap" "$HOME/.claude/skills/_agents" "$T/bin" "$T/mp"
  git config --global user.name t; git config --global user.email t@t
  # install.sh ghim sha512 của tarball thật; bản test ghim sha512 của tarball giả "good".
  good="sha512-$(printf good | openssl dgst -sha512 -binary | base64 | tr -d '\n')"
  sed "s|^CODEX_INTEGRITY=.*|CODEX_INTEGRITY=\"$good\"|" "$REPO/_bootstrap/install.sh" > "$HOME/.claude/skills/_bootstrap/install.sh"
  git init -q "$T/mp" && git -C "$T/mp" commit -q --allow-empty -m mp
  pin="$1"; [ "$pin" = HEAD ] && pin="$(git -C "$T/mp" rev-parse HEAD)"
  printf '# x\nowner/mp | p1@mp | %s\n' "$pin" > "$HOME/.claude/skills/_bootstrap/plugins.manifest"
  cat > "$T/bin/claude" <<EOS
#!/usr/bin/env bash
echo "claude \$*" >> "$T/calls"
if [ "\$1 \$2 \$3" = "plugin marketplace add" ]; then
  mkdir -p "\$HOME/.claude/plugins/marketplaces" && git clone -q "$T/mp" "\$HOME/.claude/plugins/marketplaces/mp"
fi
exit 0
EOS
  cat > "$T/bin/npm" <<EOS
#!/usr/bin/env bash
echo "npm \$*" >> "$T/calls"
[ "\$1" = pack ] && printf '%s' "\$FAKE_TGZ" > openai-codex-x.tgz && echo openai-codex-x.tgz
exit 0
EOS
  printf '#!/usr/bin/env bash\necho "pipx $*" >> "%s/calls"\n' "$T" > "$T/bin/pipx"
  chmod +x "$T/bin/claude" "$T/bin/npm" "$T/bin/pipx"
  grep -qE '^CODEX_INTEGRITY="sha512-[A-Za-z0-9+/]{86}=="$' "$REPO/_bootstrap/install.sh" || { echo "HỎNG install.sh không ghim CODEX_INTEGRITY"; exit 1; }
}
run() { bash "$HOME/.claude/skills/_bootstrap/install.sh" > "$T/out" 2>&1; touch "$T/calls"; }

setup HEAD good; run
grep -qx 'claude plugin install p1@mp' "$T/calls" && ok "marketplace đúng commit ghim → cài plugin" || bad "không cài plugin dù đúng commit ghim"
if grep -qE '^npm pack --silent @openai/codex@[0-9]+\.[0-9]+\.[0-9]+$' "$T/calls" && grep -qE '^npm install -g /.*/openai-codex-x\.tgz$' "$T/calls"; then
  ok "codex: tải đúng phiên bản ghim, cài từ chính tarball đã kiểm sha512"; else bad "codex cài không ghim phiên bản: $(grep '^npm install' "$T/calls")"; fi
if grep -qE '^pipx install browser-use==[0-9]+\.[0-9]+\.[0-9]+$' "$T/calls"; then ok "browser-use cài đúng phiên bản ghim"; else bad "browser-use cài không ghim phiên bản: $(grep '^pipx' "$T/calls")"; fi
rm -rf "$T"

setup 0123456789abcdef0123456789abcdef01234567 evil; run
grep -q 'plugin install' "$T/calls" && bad "vẫn cài plugin khi marketplace lệch commit ghim" || ok "marketplace lệch commit ghim → không cài plugin"
grep -q '^npm install' "$T/calls" && bad "vẫn cài codex khi tarball sai sha512" || ok "tarball sai sha512 → không cài codex"
rm -rf "$T"

setup "" "x"; run
grep -q 'plugin install' "$T/calls" && bad "cài plugin khi manifest chưa ghim commit" || ok "manifest chưa ghim commit → không cài plugin"
rm -rf "$T"

# Manifest thật: dòng nào cũng có commit ghim 40 ký tự hex
bad_lines="$(grep -vE '^\s*(#|$)' "$REPO/_bootstrap/plugins.manifest" | grep -vE '\|\s*[0-9a-f]{40}\s*$')"
[ -z "$bad_lines" ] && ok "mọi dòng plugins.manifest đều ghim commit" || bad "dòng manifest chưa ghim: $bad_lines"

exit "$fail"
