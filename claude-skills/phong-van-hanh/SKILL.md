---
name: phong-van-hanh
description: "Phòng Vận hành shop: Vận hành cửa hàng online: sản phẩm Shopify, đơn hàng và xưởng in Printdoors, vận đơn, chăm sóc người mua, soát giá lãi hạn giao và chính sách; shop Small Space Fixes và khách Làm hộ. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Phòng Vận hành shop\"."
---

# Phòng Vận hành shop

Trợ lý giám đốc lập phòng này ngày 2026-11-09 (đề xuất D-20261109-171340-thk). Phòng nhận việc: Vận hành cửa hàng online: sản phẩm Shopify, đơn hàng và xưởng in Printdoors, vận đơn, chăm sóc người mua, soát giá lãi hạn giao và chính sách; shop Small Space Fixes và khách Làm hộ.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng phòng Vận hành | `vh-lead` | lead | opus |
| Quản lý sản phẩm | `vh-san-pham` | lam | sonnet |
| Điều phối đơn & xưởng | `vh-don-xuong` | lam | sonnet |
| CSKH người mua | `vh-cskh` | lam | sonnet |
| Kiểm soát | `vh-kiem-soat` | kiem | sonnet |
| Thư ký | `vh-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by phong-van-hanh`.
1. Lead đọc phiếu và tình hình shop, lập lịch việc trong ngày, nhắc hạn Noel 10/12, chia việc
2. Người làm soạn: thay đổi sản phẩm (vh-san-pham), bảng đơn và payload đơn nháp xưởng (vh-don-xuong, chưa gọi API), thư trả lời khách (vh-cskh)
3. Kiểm soát soát giá lãi, hạn giao, chính sách, bản trả lời; trả về nếu chưa đạt
4. Đề xuất đạt chờ anh duyệt (trừ loại anh đã cho phép); anh duyệt rồi mới chạy thay đổi trên shop; đơn Printdoors anh tự tạo trên giao diện Printdoors từ payload đã soạn (pd.py chặn tạo đơn tự động); trả tiền và gửi tin do anh làm
5. Thư ký ghi kết quả và danh sách chờ anh vào phiếu
Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.
- Lead của phòng không có Bash: Lead viết file, vh-thu-ky chạy lệnh tickets.mjs (và kho.mjs).

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Không bao giờ trả tiền (không orderPay, không thanh toán đơn xưởng, không mua gì); không gửi tin hay email cho người mua hoặc nhà cung cấp khi anh chưa duyệt; không chạy hay tăng ngân sách quảng cáo; không dùng tên hay logo Cole/Fago; chỉ dùng ảnh của mình hoặc đã có quyền bằng văn bản; mọi thay đổi trên shop là đề xuất chờ anh duyệt, trừ loại anh đã cho phép trong memory.
- Ngân sách mỗi việc: 10 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

## Skill dùng

- kho-du-lieu (có sẵn)
- copywriting (có sẵn)
