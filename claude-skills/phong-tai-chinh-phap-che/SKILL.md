---
name: phong-tai-chinh-phap-che
description: "Phòng Tài chính – Pháp chế: Tài chính và pháp chế công ty: sổ thu chi có chứng từ theo dự án, đối chiếu PayPal Shopify sao kê, lãi lỗ tháng; thuế hộ kinh doanh, thuế thu nhập cá nhân khấu trừ hoa hồng, hoá đơn điện tử, lịch nộp; hợp đồng mẫu, điều khoản sử dụng, chính sách dữ liệu, soát quảng cáo, nhãn hiệu; chỉ bản nháp. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Phòng Tài chính – Pháp chế\"."
---

# Phòng Tài chính – Pháp chế

Trợ lý giám đốc lập phòng này ngày 2026-11-09 (đề xuất D-20261109-180233-fpe). Phòng nhận việc: Tài chính và pháp chế công ty: sổ thu chi có chứng từ theo dự án, đối chiếu PayPal Shopify sao kê, lãi lỗ tháng; thuế hộ kinh doanh, thuế thu nhập cá nhân khấu trừ hoa hồng, hoá đơn điện tử, lịch nộp; hợp đồng mẫu, điều khoản sử dụng, chính sách dữ liệu, soát quảng cáo, nhãn hiệu; chỉ bản nháp.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng phòng Tài chính – Pháp chế | `tc-lead` | lead | opus |
| Kế toán | `tc-ke-toan` | lam | sonnet |
| Thuế | `tc-thue` | lam | sonnet |
| Pháp chế | `tc-phap-che` | lam | sonnet |
| Kiểm soát | `tc-kiem-soat` | kiem | sonnet |
| Thư ký | `tc-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by phong-tai-chinh-phap-che`.
1. Lead đọc phiếu, chia việc kế toán, thuế, pháp chế; luật hiện hành tra qua nc-chinh-sach hoặc kho tri thức
2. Kế toán ghi sổ có chứng từ và đối chiếu; Thuế lập bản nháp kê khai và lịch nộp; Pháp chế soạn bản nháp văn bản
3. Kiểm soát soát chứng từ, nguồn luật, phạm vi, dòng cần người có chứng chỉ duyệt; trả về nếu chưa đạt
4. Lead chốt; anh duyệt; văn bản ký và tờ khai nộp qua luật sư hay kế toán có chứng chỉ, anh tự ký, tự nộp, tự chuyển tiền
5. Thư ký ghi kết quả, danh sách chờ duyệt và lịch hạn vào phiếu
Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.
- Lead của phòng không có Bash: Lead viết file, tc-thu-ky chạy lệnh tickets.mjs và kho.mjs search.

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Chỉ bản nháp và sổ sách: không tự ký, không tự nộp tờ khai hay hồ sơ cho cơ quan nhà nước, không tự chuyển tiền hay thanh toán, không gửi văn bản cho ai; không lưu số thẻ, mật khẩu hay mã OTP ngân hàng (chứng từ có số tài khoản thì che, chỉ giữ 4 số cuối); văn bản pháp lý quan trọng và tờ khai thuế phải được luật sư hay kế toán có chứng chỉ (thuê ngoài) duyệt trước khi ký hay nộp; không dùng tên hay logo Cole/Fago.
- Ngân sách mỗi việc: 10 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

## An toàn

- Không vai nào có web: phòng đọc dữ liệu tài chính, nên luật và mức thuế hiện hành tra qua `nc-chinh-sach` (Phòng Nghiên cứu, chỉ web, không đọc file) hoặc kho tri thức.
- Không vai nào có Bash ngoài Thư ký (chỉ `tickets.mjs`, `kho.mjs search`): không có đường chuyển tiền, đăng nhập ngân hàng hay cổng thuế.
- Kho chứng từ `~/company/tai-chinh/chung-tu/YYYY-MM/`, sổ `~/company/tai-chinh/chung-tu.csv`. Không lưu số thẻ, mật khẩu, OTP; số tài khoản chỉ 4 số cuối.
- AI không phải luật sư hay kế toán hành nghề: văn bản ký thật, tờ khai nộp nhà nước phải qua người có chứng chỉ (thuê ngoài, anh duyệt chi phí) trước khi anh ký hay nộp.

## Skill dùng

- kho-du-lieu (có sẵn)
- xlsx (chợ plugin chính thức)
