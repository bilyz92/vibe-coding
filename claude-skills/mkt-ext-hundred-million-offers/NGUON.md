# Nguồn skill mkt-ext-hundred-million-offers

- Repo gốc: https://github.com/wondelai/skills (thư mục `hundred-million-offers`)
- Commit ghim: `d8d5d75f83da9f16d8aad5bab5f5b341a4770a30`
- Giấy phép: MIT (bản quyền thuộc tác giả gốc; bản sao giấy phép ở file `LICENSE` cùng thư mục)
- Dòng bản quyền (nguyên văn): `Copyright (c) 2025 Wondel.ai sp. z o.o.`
- Ngày cài: 2026-11-06
- Thay đổi so với bản gốc: chỉ đổi trường `name:` trong frontmatter thành `mkt-ext-hundred-million-offers`; nội dung còn lại giữ nguyên.

## Kết quả 2 lớp kiểm

1. Tự soát từng file và chạy `tro-ly-giam-doc/scripts/skill-audit.mjs` (ok: true): không có lệnh curl hay gọi mạng, không yêu cầu đăng bài, tiêu tiền, gửi tin tự động, không đọc secret, không link tải về hay chạy script ngoài, không thấy prompt injection. Link ngoài chỉ là link sách Amazon có mã giới thiệu (affiliate); skill có ranh giới đạo đức (cấm khan hiếm giả).
2. `/codex-security-review` (Codex, 2 vòng): APPROVE, xếp SAFE-AS-IS.

## Dùng thế nào

Dùng cho Small Space Fixes (Shopify, khách Mỹ). Dùng cho gói thử dịch vụ và ưu đãi của store. Quy tắc công ty thắng: cấm hứa quá mức, cấm giá gạch ảo (giá so sánh không có thật), cấm khan hiếm hay hạn chót giả; mọi con số giá trị phải có nguồn.

Tiêu chí và quy tắc công ty nằm trong `~/project/my-office/docs/logic-tim-san-pham-win.md` và `docs/meta-ads-2026-andromeda.md`; khi mâu thuẫn với skill này thì tài liệu công ty thắng.
