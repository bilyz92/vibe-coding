---
name: phong-cong-dong
description: "Phòng Cộng đồng: Cộng đồng chính danh: kế hoạch tương tác tuần trong nhóm, soạn trả lời và bài chia sẻ cho tài khoản thật của anh, quản lý KOC KOL và hàng mẫu, theo dõi nơi người ta nhắc tới Small Space Fixes và hệ thống. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Phòng Cộng đồng\"."
---

# Phòng Cộng đồng

Trợ lý giám đốc lập phòng này ngày 2026-11-09 (đề xuất D-20261109-172313-smm). Phòng nhận việc: Cộng đồng chính danh: kế hoạch tương tác tuần trong nhóm, soạn trả lời và bài chia sẻ cho tài khoản thật của anh, quản lý KOC KOL và hàng mẫu, theo dõi nơi người ta nhắc tới Small Space Fixes và hệ thống.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng phòng Cộng đồng | `cd-lead` | lead | opus |
| Soạn nội dung tương tác | `cd-noi-dung` | lam | sonnet |
| Quản lý KOC/KOL | `cd-koc` | lam | sonnet |
| Theo dõi thương hiệu | `cd-theo-doi` | lam | sonnet |
| Quản trị page & group | `cd-page-group` | lam | sonnet |
| Kiểm duyệt | `cd-kiem-duyet` | kiem | sonnet |
| Thư ký | `cd-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by phong-cong-dong`.
1. Lead đọc phiếu, lập kế hoạch tương tác tuần theo luật từng nhóm, chia việc
2. Theo dõi thương hiệu tìm nơi nhắc tới SSF; người soạn viết bản nháp trả lời, bài chia sẻ; Quản lý KOC soạn danh sách, thư mời chỉ cho KOC công khai nhận hợp tác
3. Quản trị page & group soạn lịch fanpage, group; Kiểm duyệt chặn seeding ảo, đánh giá giả, spam, sai luật nhóm, thiếu ghi tài trợ; trả về nếu chưa đạt
4. Bản đạt chờ anh duyệt; anh tự đăng hoặc gửi từ tài khoản thật
5. Thư ký ghi kết quả và danh sách bản nháp chờ anh vào phiếu
Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.
- Lead của phòng không có Bash: Lead viết file, cd-thu-ky chạy lệnh tickets.mjs.

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Không bao giờ tự đăng, bình luận, nhắn tin hay gửi thư: chỉ soạn bản nháp, anh duyệt và anh tự đăng hoặc gửi từ tài khoản thật; không bao giờ tạo hay dùng tài khoản nào (không nick clone, không tài khoản phụ); không seeding ảo, không đánh giá giả, không spam (NĐ 91/2020), không nhắn tin khi người ta chưa hỏi; chỉ dùng đánh giá thật khi người mua đồng ý; bài tài trợ ghi rõ có tài trợ; không dùng tên hay logo Cole/Fago.
- Ngân sách mỗi việc: 10 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

## Skill dùng

- mkt-mang-xa-hoi (có sẵn)
- social-content (có sẵn)
- mkt-nghien-cuu-fb (có sẵn)
- meta-business-suite (có sẵn; chỉ để hiểu cách Trang vận hành: phòng không đăng, không trả lời, không nhắn từ Business Suite)

Tự đăng fanpage qua Pages API: chưa mở. Cần một công cụ đăng riêng chỉ nhận POST bài đã duyệt (phiếu cho Phòng Kỹ sư) và anh cấp quyền; tới lúc đó anh tự đăng mọi bài.

An toàn: cd-theo-doi chỉ có WebSearch, WebFetch, không đọc hay ghi file trên máy; Lead nhận báo cáo và tự ghi file. Nhóm Facebook kín, trang cần đăng nhập: qua mkt-nghien-cuu (sandbox) của Phòng Marketing.
