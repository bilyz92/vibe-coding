# Nguồn skill mkt-ext-jobs-to-be-done

- Repo gốc: https://github.com/wondelai/skills (thư mục `jobs-to-be-done`)
- Commit ghim: `d8d5d75f83da9f16d8aad5bab5f5b341a4770a30`
- Giấy phép: MIT (bản quyền thuộc tác giả gốc; bản sao giấy phép ở file `LICENSE` cùng thư mục)
- Dòng bản quyền (nguyên văn): `Copyright (c) 2025 Wondel.ai sp. z o.o.`
- Ngày cài: 2026-11-06
- Thay đổi so với bản gốc: chỉ đổi trường `name:` trong frontmatter thành `mkt-ext-jobs-to-be-done`; nội dung còn lại giữ nguyên.

## Kết quả 2 lớp kiểm

1. Tự soát từng file và chạy `tro-ly-giam-doc/scripts/skill-audit.mjs` (ok: true): không có lệnh curl hay gọi mạng, không yêu cầu đăng bài, tiêu tiền, gửi tin tự động, không đọc secret, không link tải về hay chạy script ngoài, không thấy prompt injection. Link ngoài chỉ là link sách Amazon có mã giới thiệu (affiliate).
2. `/codex-security-review` (Codex, 2 vòng): APPROVE, xếp SAFE-AS-IS. Vòng 1 nêu rủi ro Medium về chia sẻ ghi chép, ghi âm phỏng vấn (CWE-359); vòng 2 rút lại vì công ty một người, kèm quy tắc ẩn danh ở mục dưới.

## Dùng thế nào

Dùng cho Small Space Fixes (Shopify, khách Mỹ). Dùng để tìm sản phẩm theo nỗi đau (việc khách cần làm xong) và phân tích vì sao khách chọn đối thủ. Ghi chép, ghi âm phỏng vấn: ẩn danh, có đồng ý, chỉ lưu trong repo riêng.

Tiêu chí và quy tắc công ty nằm trong `~/project/my-office/docs/logic-tim-san-pham-win.md` và `docs/meta-ads-2026-andromeda.md`; khi mâu thuẫn với skill này thì tài liệu công ty thắng.
