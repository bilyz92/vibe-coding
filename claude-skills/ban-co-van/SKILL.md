---
name: ban-co-van
description: "Ban Cố vấn: Cố vấn chuyên gia cho anh: bản ghi nhớ cố vấn hằng tuần ba việc nên làm ba việc nên dừng cho từng dự án Small Space Fixes, Trợ lý bán hàng, Dịch vụ; ý kiến trước quyết định lớn về chiến lược SaaS, thương mại điện tử POD, tăng trưởng, AI. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Ban Cố vấn\"."
---

# Ban Cố vấn

Trợ lý giám đốc lập phòng này ngày 2026-11-09 (đề xuất D-20261109-175444-rsb). Phòng nhận việc: Cố vấn chuyên gia cho anh: bản ghi nhớ cố vấn hằng tuần ba việc nên làm ba việc nên dừng cho từng dự án Small Space Fixes, Trợ lý bán hàng, Dịch vụ; ý kiến trước quyết định lớn về chiến lược SaaS, thương mại điện tử POD, tăng trưởng, AI.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng ban Cố vấn | `cv-lead` | lead | opus |
| Cố vấn chiến lược & SaaS | `cv-chien-luoc` | lam | opus |
| Cố vấn TMĐT xuyên biên giới & POD | `cv-tmdt` | lam | sonnet |
| Cố vấn marketing tăng trưởng | `cv-marketing` | lam | sonnet |
| Cố vấn AI & công nghệ | `cv-ai` | lam | sonnet |
| Phản biện | `cv-phan-bien` | kiem | sonnet |
| Thư ký | `cv-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by ban-co-van`.
1. Mỗi ngày nc-lead (Phòng Nghiên cứu) ghi bản tin của nc-hoc-hoi vào ~/company/nghien-cuu/hoc-hoi; thứ Hai nc-lead viết bản tổng hợp tuần
2. Thứ Hai Trưởng ban đọc bản tổng hợp và số liệu công ty, giao từng cố vấn
3. Cố vấn viết lời khuyên có nguồn và ngày; Phản biện kết luận GIỮ, SỬA hoặc BỎ
4. Trưởng ban viết bản ghi nhớ: ba việc nên làm, ba việc nên dừng cho từng dự án; quyết định chiến lược lớn ghi cần Ban Kiểm soát
5. Thư ký ghi kết quả vào phiếu; Trợ lý giám đốc mở phiếu và giao các việc được nhận
Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.
- Trưởng ban không có Bash: Trưởng ban viết file, cv-thu-ky chạy lệnh tickets.mjs và kho.mjs.

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Chỉ khuyên: không lên web, không đăng nhập, không mua dữ liệu hay khoá học, không nhắn tin hay gửi gì cho ai; không đọc hay dùng dữ liệu project của Cole; không dùng tên hay logo Cole/Fago; lời khuyên được nhận thành phiếu do Trợ lý giám đốc giao.
- Ngân sách mỗi việc: 10 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

## Skill dùng

- kho-du-lieu (có sẵn)
- mkt-pricing (có sẵn)
- mkt-ext-hundred-million-offers (có sẵn)
- mkt-ext-jobs-to-be-done (có sẵn)
- mkt-ext-product-marketing (có sẵn)
- mkt-ext-cro (có sẵn)
- deep-research (chợ plugin chính thức; Ban không có web nên chỉ dùng qua Phòng Nghiên cứu)

An toàn: mọi cố vấn chỉ đọc file (Read, Glob, Grep), không có web. Vai vừa đọc dữ liệu công ty vừa lên web là đường lộ dữ liệu, nên việc lên mạng học hỏi do `nc-hoc-hoi` (chỉ web, không đọc file) của Phòng Nghiên cứu làm; Ban đọc bản tin đã kiểm chứng của họ. Cần tìm thêm: Trưởng ban viết câu hỏi để Trợ lý giám đốc giao Phòng Nghiên cứu. Dữ liệu công ty chỉ đọc theo danh sách cho phép ghi trong hướng dẫn từng cố vấn (my-office, tro-ly-ban-hang, ban-chon-san-pham, ~/company, phiếu); kho tri thức gom cả project của Cole nên cv-thu-ky lọc kết quả theo danh sách đó. cv-thu-ky chỉ chạy tickets.mjs và kho.mjs search.

## Lịch chạy (đề xuất, chưa cài)

`nhip.mjs` (cron 02:23) không gọi model nên không kích hoạt phòng được. Hai dòng crontab đề xuất, chỉ cài khi anh đồng ý. Chạy headless cần thêm cờ quyền (`--permission-mode` hoặc `--allowedTools` đúng công cụ của phòng); phiên chính chốt cờ khi trình anh, chưa có thì việc sẽ bị từ chối ghi file:

```
0 6 * * * cd /home/bilyz/project/my-office && /home/bilyz/.local/bin/claude -p "Giao cho Phòng Nghiên cứu thị trường: bản tin học hỏi hôm nay của nc-hoc-hoi (3 đến 5 mục; thứ Hai nc-lead viết bản tổng hợp tuần từ 7 file ngày)" >> /home/bilyz/.claude/company/hoc-hoi-cron.log 2>&1
0 7 * * 1 cd /home/bilyz/project/my-office && /home/bilyz/.local/bin/claude -p "Giao cho Ban Cố vấn: bản ghi nhớ cố vấn tuần này" >> /home/bilyz/.claude/company/co-van-cron.log 2>&1
```
