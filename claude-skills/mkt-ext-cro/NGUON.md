# Nguồn skill mkt-ext-cro

- Repo gốc: https://github.com/coreyhaines31/marketingskills (thư mục `cro`)
- Commit ghim: `88c79f6528a9347420e57ceb1fff9a60de651768`
- Giấy phép: MIT (bản quyền thuộc tác giả gốc; bản sao giấy phép ở file `LICENSE` cùng thư mục)
- Dòng bản quyền (nguyên văn): `Copyright (c) 2025 Corey Haines`
- Ngày cài: 2026-11-06
- Thay đổi so với bản gốc: đổi trường `name:` trong frontmatter thành `mkt-ext-cro`. Sửa thêm 2 dòng mà `skill-audit` chặn (`sensitive-path`): bỏ đường dẫn ngữ cảnh cũ ở `SKILL.md:24` và `references/form.md:8`. Ghim link playbook revops ở `SKILL.md:196` vào commit trên thay vì nhánh `main` (để nội dung không đổi ngầm). Bỏ file `evals/evals.json` (bộ chấm của tác giả, theo mục 3.6 `tro-ly-giam-doc/references/tao-phong.md`).

## Kết quả 2 lớp kiểm

1. Tự soát từng file và chạy `tro-ly-giam-doc/scripts/skill-audit.mjs` (ok: true): không có lệnh curl hay gọi mạng, không yêu cầu đăng bài, tiêu tiền, gửi tin tự động, không đọc secret, không link tải về hay chạy script ngoài, không thấy prompt injection. Link ngoài chỉ là link tài liệu GitHub; skill liên quan (signup, popups, ab-testing...) không được cài, bỏ qua.
2. `/codex-security-review` (Codex, 2 vòng): APPROVE, xếp SAFE-AS-IS.

## Dùng thế nào

Dùng cho Small Space Fixes (Shopify, khách Mỹ). Dùng để soát trang sản phẩm, trang chủ, form của store và đề xuất thử nghiệm; chỉ đề xuất, không tự sửa store.

Tiêu chí và quy tắc công ty nằm trong `~/project/my-office/docs/logic-tim-san-pham-win.md` và `docs/meta-ads-2026-andromeda.md`; khi mâu thuẫn với skill này thì tài liệu công ty thắng.
