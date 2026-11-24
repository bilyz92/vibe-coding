#!/usr/bin/env bash
# Mở phiên vai mkt-nghien-cuu trong sandbox. Sandbox của Claude Code theo phiên, không theo agent, nên vai này chỉ chạy từ
# đây; gọi bằng tool Agent từ phiên thường thì hook gac-cua.mjs chặn mọi tool. Ba chế độ, không có chế độ nào vừa có nguồn lạ
# vừa có dữ liệu công ty:
#   phien.sh            không web: chấm, tra kho, phân tích file quảng cáo
#   phien.sh --web      tìm web và đọc trang công khai, chỉ thấy web-tho
#   phien.sh --chrome   đọc qua Chrome extension các URL trong ~/company/marketing/trang-cho-phep.txt, chỉ thấy web-tho
# Bash trong sandbox không ghi được kho tri thức. Đóng phiên xong, script này, chạy ngoài sandbox, in nguyên file và hỏi anh từng
# file .md trong cho-kho/; anh trả lời y thì mới cất bằng đúng lệnh `kho.mjs them` cố định, gắn thẻ nguồn chưa kiểm.
set -eu
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkt="$HOME/company/marketing"
nc="$mkt/nghien-cuu"
web="$mkt/web-tho"   # (ngoài nc: phiên không web chỉ đọc được, không ghi vào)
if [ -L "$web" ]; then
  echo "Dừng: $web là symlink, anh kiểm lại" >&2
  exit 1
fi
mkdir -p "$web" "$nc/cho-kho" "$nc/da-cat-kho" "$mkt/quang-cao/vao" "$mkt/quang-cao/ra"

export MKT_NGHIEN_CUU_CHE_DO=offline
cwd="$nc"   # (sandbox cho ghi vào thư mục hiện tại, nên phải đứng trong vùng được ghi)
case "${1:-}" in
  --web) MKT_NGHIEN_CUU_CHE_DO=web; cwd="$web"; shift ;;
  --chrome) MKT_NGHIEN_CUU_CHE_DO=chrome; cwd="$web" ;;   # (giữ --chrome cho claude)
esac
cd "$cwd"

# Bỏ mọi ký tự điều khiển và định dạng Unicode trước khi in ra terminal, giữ xuống dòng và tab: nội dung có thể do trang lạ gài.
sach() {
  node -e 'process.stdout.write(require("fs").readFileSync(0, "utf8").replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" || c === "\t" ? c : "")))'
}

cat_kho() {
  if [ -L "$nc/cho-kho" ] || [ -L "$nc/da-cat-kho" ]; then
    echo "Bỏ qua cất kho: cho-kho hoặc da-cat-kho là symlink, anh kiểm lại" >&2
    return 0
  fi
  tam=$(mktemp -d)
  luu=
  for f in "$nc"/cho-kho/*.md; do
    if [ ! -f "$f" ] || [ -L "$f" ]; then continue; fi
    printf -- '--- %s\n' "$(basename "$f" | tr -d '\n' | sach)"
    # (anh đọc và kho nhận đúng một bản sạch, để trong thư mục riêng do script tạo, thư mục agent không với tới)
    snap="$tam/$(basename "$f")"
    sach < "$f" > "$snap"
    cat -- "$snap"
    printf '\n'
    printf 'Cất file này vào kho? [y/N] '
    read -r tl || tl=
    if [ "$tl" != "y" ]; then continue; fi
    if node "$here/../../kho-du-lieu/scripts/kho.mjs" them --tu-file "$snap" --loai nghien-cuu --the nguon-chua-kiem --nguon phien-mkt-nghien-cuu; then
      luu=${luu:-$(mktemp -d "$nc/da-cat-kho/lan-XXXXXX")}   # (mỗi lần một thư mục, không đè bản cũ)
      mv -- "$snap" "$luu/"
      mv -- "$f" "$luu/$(basename "$f").goc"
    else
      echo "Chưa cất được vào kho: $f" >&2
    fi
  done
}

rc=0
claude --strict-mcp-config --settings "$here/settings.json" --agent mkt-nghien-cuu "$@" || rc=$?
if [ "$rc" -eq 0 ]; then cat_kho; fi
exit "$rc"
