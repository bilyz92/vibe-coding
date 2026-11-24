---
name: kho-du-lieu
description: Kho tri thức của My Company — một chỗ tra mọi thứ công ty đã biết: tài liệu nghiên cứu, thị trường, đối thủ, kế hoạch, chiến lược, quyết định (thư mục tri thức, có git), cùng phiếu việc, phòng ban, đề xuất, skill ngoài, bài học, docs, commit và phiên Codex review của các repo, gom vào một file SQLite tìm toàn văn. Dùng khi cần "tra kho", "đã nghiên cứu cái này chưa", "tìm lại tài liệu/quyết định", trước khi bắt đầu một nghiên cứu mới, hoặc khi vừa làm xong nghiên cứu / kế hoạch / chiến lược / quyết định cần cất vào kho.
---

# Kho dữ liệu

`K=~/.claude/skills/kho-du-lieu/scripts/kho.mjs`. Mọi lệnh in JSON ra stdout; lỗi in ra stderr, exit 1. Chỉ dùng module `node:*` (Node 24, `node:sqlite`). Một số bản Node in cảnh báo `ExperimentalWarning` (experimental) cho `node:sqlite` ra stderr: bỏ qua được, không phải lỗi.

## Hai luật dùng kho

1. **Tra kho trước khi nghiên cứu**: `node $K search "<từ khoá>"`. Đã có tài liệu còn hiệu lực thì dùng lại, chỉ nghiên cứu phần còn thiếu.
2. **Làm xong thì cất vào kho**: nghiên cứu, kế hoạch, chiến lược, quyết định xong thì viết tài liệu ra file bằng tool Write (dòng đầu `# Tiêu đề`), rồi `node $K them --tu-file <file> --loai <loai> --nguon <nguồn>`. Văn bản dài không đưa thẳng vào lệnh shell.

## Lệnh

### `kho.mjs them`: thêm một tài liệu

```
node $K them --loai <loai> --tieu-de "<tiêu đề>" --nguon <nguồn> [--nguon <nguồn 2>] [--the a,b] [--ngay YYYY-MM-DD] [--phieu <mã phiếu>] [--trang-thai <trạng thái>] (--noi-dung "<nội dung>" | --tu-file <file>)
```

- `--loai` (bắt buộc): `thi-truong` | `doi-thu` | `ke-hoach` | `chien-luoc` | `quyet-dinh` | `nghien-cuu`.
- `--tieu-de` (bắt buộc, trừ khi `--tu-file` có dòng `# …` thì lấy dòng đó).
- `--nguon` (bắt buộc): đường dẫn hoặc link; lặp cờ hoặc phân cách dấu phẩy. Với `--tu-file`, đường dẫn tuyệt đối của file gốc tự vào `nguon`.
- `--the`: thẻ, phân cách dấu phẩy.
- `--ngay`: mặc định hôm nay. `--phieu`: mã phiếu việc (vd `P-20261103-025000-wfp`).
- `--trang-thai`: `hieu-luc` (mặc định) | `cu` | `thay-bang:<file>.md` (bản này đã có bản thay).
- `--noi-dung`: nội dung ngắn; `--tu-file`: lấy nguyên văn thân tài liệu từ file (file gốc không bị sửa hay xoá).

Ghi `<KHO_DIR>/<ngay>-<slug-không-dấu-của-tiêu-đề>.md`, frontmatter YAML: `loai`, `tieu-de`, `ngay`, `phieu`, `trang-thai`, `nguon` (list), `the` (list). Tên file đã có thì từ chối, không ghi đè. Thư mục tri thức chưa là git thì `git init`; mỗi tài liệu một commit (không ký số). Commit lỗi thì tài liệu không được thêm: file mới bị gỡ, sửa git xong chạy lại. Tài liệu quá 2 MiB bị từ chối: tách nhỏ. Nhập lại cùng file gốc, cùng nội dung bằng `--tu-file` thì không tạo bản trùng (trả `daCo: true`). Không sửa hay xoá tài liệu qua kho: muốn thay, thêm bản mới rồi sửa tay `trang-thai` của bản cũ thành `thay-bang:<bản mới>`.

### `kho.mjs build`: dựng lại kho.db

`node $K build` dựng lại toàn bộ `kho.db` từ đầu (chạy lại bao nhiêu lần cũng ra cùng dữ liệu). Gom:
- tài liệu trong thư mục tri thức;
- phiếu (`tickets/*.json`), đề xuất (`proposals/*.json`), `third-party.json`, `improve.json` trong `COMPANY_DIR`; phòng ban (`<SKILLS_DIR>/*/department.json`);
- mỗi repo trong `repos.json` và mỗi thư mục trong `KHO_PROJECTS_DIR` có `PROGRESS.md` hoặc `docs/` (trừ git worktree phụ — `git worktree add` — vì trùng repo chính; có trong `repos.json` thì vẫn lấy): bài học (`## Bài học` của PROGRESS.md), `docs/**/*.md`, commit (toàn bộ lịch sử; chỉ hash, tác giả, ngày, thông điệp; mỗi hash một lần dù nhiều bản clone cùng có), phiên Codex review (`.codex-review/sessions/*/meta.json`).

Repo hỏng, JSON lỗi, link, hay file .md quá 2 MiB thì bỏ qua, in cảnh báo ra stderr, phần còn lại vẫn dựng.

### `kho.mjs search`: tìm toàn văn

```
node $K search "<từ khoá>" [--loai <loai>] [--the a,b] [--tu-ngay YYYY-MM-DD] [--ca-cu]
```

Trả `results: [{ nhom, ma, tieuDe, duongDan, trich, ngay, nhan? }]` (tối đa 20), hoặc `message: "không có kết quả"`. Thứ tự theo nhóm: tài liệu trước, rồi docs, bài học, các nhóm khác (phiếu, đề xuất…), commit cuối; trong mỗi nhóm theo độ khớp. Tìm không phân biệt dấu ("thị trường" = "thi truong"). Ký tự đặc biệt trong từ khoá chỉ là chữ thường, không phải cú pháp. Các cờ lọc cộng dồn (AND): `--loai` và `--the` chỉ áp cho tài liệu, `--tu-ngay` lọc theo ngày. Tài liệu `cu` hoặc `thay-bang:…` ẩn mặc định; `--ca-cu` hiện cả, kèm `nhan` ("cũ" / "thay bằng <file>"). Từ khoá bắt đầu bằng `-` thì đặt sau `--`.

### `kho.mjs query`: câu SQL chỉ đọc

`node $K query "SELECT verdict, rounds FROM reviews"` → `{ rows }`. Chỉ một câu `SELECT` hoặc `WITH … SELECT`; câu ghi (INSERT, UPDATE, DELETE, DROP, ATTACH, PRAGMA…) hay nhiều câu nối `;` bị từ chối, và file mở ở chế độ chỉ đọc.

Bảng: `knowledge`, `tickets`, `departments`, `proposals`, `third_party`, `improvements`, `repos`, `lessons`, `docs`, `commits`, `reviews`, và `fts` (bảng tìm kiếm: `nhom`, `ma`, `tieu_de`, `duong_dan`, `noi_dung`, `ngay`, `loai`, `the`, `trang_thai`).

### `kho.mjs stats`: đếm

`node $K stats` → `nhom` (số dòng: tài liệu, phiếu, phòng ban, đề xuất, skill ngoài, cải tiến, bài học, docs, commit, phiên review), `theoLoai`, `theoTrangThai`.

Chưa có kho.db thì `search`, `query`, `stats` báo "chạy `kho build` trước".

## Nơi để (biến môi trường)

| Biến | Mặc định | Là gì |
| --- | --- | --- |
| `COMPANY_DIR` | `~/.claude/company` | dữ liệu công ty; kho.db ở `$COMPANY_DIR/kho/kho.db` |
| `KHO_DIR` | `~/company/tri-thuc` | thư mục tri thức (git) |
| `KHO_PROJECTS_DIR` | `~/project` | thư mục chứa các repo |
| `SKILLS_DIR` | `~/.claude/skills` | nơi tìm `department.json` |
| `CLAUDE_PROJECTS_DIR` | `~/.claude/projects` | hội thoại Claude: **không bao giờ đọc** |

## An toàn

- File hay thư mục tên bí mật bị bỏ qua trước khi mở, xét mọi thành phần của đường dẫn thật: `.env*`, `env` đứng riêng hay giữa các dấu chấm (`Config.ENV.md`, `prod.env`), `*.pem`, `*.key`, `id_*`, `*credentials*`, `*token*`, `*secret*`.
- Không bao giờ theo symlink: mọi thành phần đường dẫn, tính từ thư mục gốc tin cậy (`KHO_DIR`, `COMPANY_DIR`, `SKILLS_DIR`, `KHO_PROJECTS_DIR`, thư mục repo; `/` với `--tu-file`), đều được kiểm, gặp link ở bất kỳ đâu là từ chối (thư mục tri thức, repo, `docs/`, PROGRESS.md, các file JSON, `meta.json`, `--tu-file`). Thư mục kho ghi vào (`KHO_DIR`, `$COMPANY_DIR/kho`) phải không có link ở bất kỳ thành phần nào tính từ `/`.
- Thư mục hay file không đọc được (quyền) thì bỏ qua kèm cảnh báo, phần còn lại vẫn dựng.
- Không đọc hội thoại Claude (`CLAUDE_PROJECTS_DIR`), kể cả khi nó nằm trong `repos.json` hay thư mục project.
- Commit chỉ lấy hash, tác giả, ngày, thông điệp (`git log --format`), không lấy diff hay danh sách file. Phiên review chỉ đọc `meta.json`.
- Kho chỉ ở trên máy: không đẩy thư mục tri thức lên remote.
