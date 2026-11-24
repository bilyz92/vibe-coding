---
name: phong-thiet-ke
description: "Phòng Thiết kế: Thiết kế: file in sản phẩm POD theo lô và mockup, màn hình app và website, bộ ảnh quảng cáo, giữ DESIGN.md từng sản phẩm. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Phòng Thiết kế\"."
---

# Phòng Thiết kế

Trợ lý giám đốc lập phòng này ngày 2026-11-09 (đề xuất D-20261109-171146-hhb). Phòng nhận việc: Thiết kế: file in sản phẩm POD theo lô và mockup, màn hình app và website, bộ ảnh quảng cáo, giữ DESIGN.md từng sản phẩm.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng phòng Thiết kế | `tk-lead` | lead | opus |
| Thiết kế sản phẩm POD | `tk-pod` | lam | sonnet |
| Thiết kế UI/UX | `tk-ui` | lam | sonnet |
| Ảnh sản phẩm & khuôn quảng cáo | `tk-anh-qc` | lam | sonnet |
| Kiểm duyệt thiết kế | `tk-kiem-duyet` | kiem | sonnet |
| Thư ký | `tk-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by phong-thiet-ke`.
1. Lead đọc phiếu, tìm hoặc soạn DESIGN.md của sản phẩm, chốt hướng và chia việc
2. Người thiết kế làm bản nháp: POD (tk-pod), UI/UX (tk-ui) hoặc ảnh sản phẩm và khuôn quảng cáo (tk-anh-qc)
3. Kiểm duyệt soát bản quyền, chất lượng in, chính tả, DESIGN.md, khổ điện thoại; trả về nếu chưa đạt
4. Lead xem lại toàn bộ và chốt bộ file cuối
5. Thư ký ghi kết quả vào phiếu; anh nhận file, việc đăng, tải lên xưởng hay cửa hàng do anh quyết
Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.
- Lead của phòng không có Bash: Lead viết file, tk-thu-ky chạy lệnh tickets.mjs (và kho.mjs).

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Không tự đăng hay gửi thiết kế cho ai, không tải lên xưởng in hay cửa hàng; không mua font, ảnh, mockup trả phí; không dùng tên hay logo Cole/Fago; chỉ dùng ảnh của mình hoặc đã có quyền bằng văn bản.
- Ngân sách mỗi việc: 10 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

Ranh giới: ảnh theo kênh (bài đăng, pin, banner) thuộc Marketing (mkt-thiet-ke-anh); file in, mockup, ảnh sản phẩm, khuôn quảng cáo, DESIGN.md thuộc phòng này; sửa repo app thuộc Phòng Kỹ sư.

## Skill dùng

- anh-do-hoa (có sẵn)
- design-taste-frontend (có trên máy, chưa vào repo skills; thiếu thì tk-ui dùng ui-ux-pro-max)
- ui-ux-review (có sẵn)
- baseline-ui (có sẵn)
- ui-ux-pro-max (có sẵn)
- logo (có sẵn)
