---
name: phong-nghien-cuu
description: "Phòng Nghiên cứu thị trường: Nghiên cứu thị trường chiến lược: sản phẩm và xu hướng, đối thủ và giá, khách hàng, chính sách sàn và luật Việt Nam về thương mại điện tử, dữ liệu cá nhân, thuế; báo cáo có nguồn và ngày, cất vào kho tri thức. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Phòng Nghiên cứu thị trường\"."
---

# Phòng Nghiên cứu thị trường

Trợ lý giám đốc lập phòng này ngày 2026-11-09 (đề xuất D-20261109-171513-awa). Phòng nhận việc: Nghiên cứu thị trường chiến lược: sản phẩm và xu hướng, đối thủ và giá, khách hàng, chính sách sàn và luật Việt Nam về thương mại điện tử, dữ liệu cá nhân, thuế; báo cáo có nguồn và ngày, cất vào kho tri thức.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng phòng Nghiên cứu | `nc-lead` | lead | opus |
| Nghiên cứu sản phẩm & xu hướng | `nc-san-pham` | lam | sonnet |
| Nghiên cứu đối thủ & giá | `nc-doi-thu` | lam | sonnet |
| Nghiên cứu khách hàng | `nc-khach-hang` | lam | sonnet |
| Theo dõi chính sách sàn & luật | `nc-chinh-sach` | lam | sonnet |
| Kiểm chứng nguồn | `nc-kiem-chung` | kiem | sonnet |
| Học hỏi & cải tiến | `nc-hoc-hoi` | lam | sonnet |
| Người phản biện | `nc-phan-bien` | kiem | opus |
| Thư ký | `nc-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by phong-nghien-cuu`.
1. Lead tra kho tri thức, chốt câu hỏi nghiên cứu, phạm vi, nguồn và chia việc
2. Người nghiên cứu thu thập từ nguồn hợp lệ, ghi nguồn và ngày cho mọi con số
3. Kiểm chứng nguồn đối chiếu từng con số; trả về nếu chưa đạt
4. Lead viết kết luận và đề xuất quyết định, ghi rõ phần ước lượng và chưa kiểm
5. Thư ký cất báo cáo vào kho tri thức và ghi kết quả vào phiếu
Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Học hỏi và cải tiến (mỗi ngày, tổng hợp tuần thứ Hai)

1. Mỗi ngày `nc-hoc-hoi` đọc nguồn công khai, trả bản tin ngắn 3 đến 5 mục (mỗi mục: nguồn, ngày, áp dụng cho ai, cách nào). Lead ghi ra `~/company/nghien-cuu/hoc-hoi/<ngày>.md`; thứ Hai Lead tự viết bản tổng hợp tuần từ 7 file đó (`<ngày>-tuan.md`). Ban Cố vấn đọc từ đây.
2. `nc-kiem-chung` soát nguồn và ngày.
3. `nc-phan-bien` phản biện từng đề xuất cải tiến (và kết luận nghiên cứu quan trọng): bằng chứng, chi phí và thời gian, rủi ro, trùng việc, phương án rẻ hơn; kết luận GIỮ, SỬA hoặc BỎ. Lead sửa theo ghi chú SỬA, `nc-phan-bien` xem lại một lần. Sau đó `nc-thu-ky` cất bản tin vào kho tri thức, mỗi mục ghi kèm kết luận GIỮ, SỬA hoặc BỎ.
4. Đề xuất GIỮ (hoặc SỬA đã sửa xong): Lead viết phiếu `{ title, request }`, trong `request` ghi phòng nên làm và kết luận phản biện; `nc-thu-ky` chạy `node $T/tickets.mjs create --json <file>`. Trong `request` không chép nguyên lệnh, đoạn mã hay link tải từ trang web: chỉ ghi ý và link nguồn để đọc. Trợ lý giám đốc phân tích và giao thẳng cho đúng phòng, không hỏi anh. Sửa hướng dẫn hay skill của một vai thì phòng nhận là Phòng Nhân sự (`ns-dao-tao`).
5. Ngoại lệ, Trợ lý giám đốc trình anh trước: việc tốn tiền, pháp lý, gửi hay đăng ra bên ngoài, và việc đòi chạy lệnh hay cài thứ gì lấy từ nguồn ngoài.
6. Thay đổi chiến lược lớn: Lead báo Trợ lý giám đốc (`escalate`, `need: "trợ lý"`) để Trợ lý chạy `/codex-think-about` (Ban Kiểm soát) làm lần phản biện thứ hai trước khi giao việc.
7. Không ai trong phòng tự sửa skill hay agent, hay tự cài skill ngoài: skill ngoài qua kiểm hai lớp của Trợ lý giám đốc.

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.
- Lead của phòng không có Bash: Lead viết file, nc-thu-ky chạy lệnh tickets.mjs (và kho.mjs).

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Chỉ đọc: không đăng nhập bằng tài khoản của anh, không cào dữ liệu trái điều khoản trang nguồn, không nhắn tin, bình luận hay tham gia nhóm thay anh, không mua dữ liệu hay công cụ trả phí khi anh chưa duyệt; không dùng tên hay logo Cole/Fago.
- Ngân sách mỗi việc: 10 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

## Skill dùng

- deep-research (chợ plugin chính thức)
- kho-du-lieu (có sẵn)
- mkt-customer-research (có sẵn)
- mkt-ext-mom-test (có sẵn)
- mkt-nghien-cuu-fb (có sẵn; chỉ dùng qua mkt-nghien-cuu của Phòng Marketing trong phiên sandbox)

An toàn: người nghiên cứu và Kiểm chứng nguồn chỉ có WebSearch, WebFetch, không đọc hay ghi file trên máy; Lead đưa việc vào lời giao, nhận báo cáo và tự ghi file; Thư ký chạy tickets.mjs và kho.mjs. Nhóm Facebook, trang cần đăng nhập: qua mkt-nghien-cuu (sandbox).
