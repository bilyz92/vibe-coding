---
name: phong-seo
description: "Phòng SEO: SEO website: nghiên cứu và phân tích từ khoá, chiến lược SEO, phân tích đối thủ và thị trường trên kết quả tìm kiếm, tối ưu onpage (tiêu đề SEO, meta, alt ảnh, liên kết nội bộ, schema), link building chính danh, brief nội dung chuẩn SEO cho Marketing viết, đề xuất sửa cấu trúc kỹ thuật cho Kỹ sư, theo dõi ranking traffic Search Console và báo cáo hiệu quả; cho Small Space Fixes, web Trợ lý bán hàng và khách Làm hộ. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Phòng SEO\"."
---

# Phòng SEO

Trợ lý giám đốc lập phòng này ngày 2026-11-10 (đề xuất D-20261110-151546-vpo). Phòng nhận việc: SEO website: nghiên cứu và phân tích từ khoá, chiến lược SEO, phân tích đối thủ và thị trường trên kết quả tìm kiếm, tối ưu onpage (tiêu đề SEO, meta, alt ảnh, liên kết nội bộ, schema), link building chính danh, brief nội dung chuẩn SEO cho Marketing viết, đề xuất sửa cấu trúc kỹ thuật cho Kỹ sư, theo dõi ranking traffic Search Console và báo cáo hiệu quả; cho Small Space Fixes, web Trợ lý bán hàng và khách Làm hộ.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng phòng SEO | `seo-lead` | lead | opus |
| Nghiên cứu từ khoá và đối thủ | `seo-tu-khoa` | lam | sonnet |
| Onpage và kỹ thuật | `seo-onpage` | lam | sonnet |
| Link building | `seo-link` | lam | sonnet |
| Theo dõi và báo cáo | `seo-theo-doi` | lam | sonnet |
| Kiểm duyệt SEO | `seo-kiem-duyet` | kiem | sonnet |
| Thư ký Phòng SEO | `seo-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by phong-seo`.
1. Lead đọc phiếu, tra kho, chốt site, mục tiêu đo được, nhóm từ khoá và mốc đo
2. Từ khoá và đối thủ ra bảng từ khoá, trang đích, đối thủ top 5, có nguồn và ngày
3. Theo dõi ghi mốc Search Console trước khi sửa
4. Onpage soạn bảng đề xuất trước/sau cho trường SEO (SSF) hoặc danh sách đề xuất (site khác); Kiểm duyệt soát ĐẠT ĐỀ XUẤT, anh duyệt đúng bảng đó, rồi Onpage sao lưu, ghi, đọc lại so sánh (lệch thì khôi phục từ bản sao lưu và báo Lead) và Kiểm duyệt soát ĐẠT SAU GHI; Link ra sơ đồ liên kết nội bộ và danh sách nơi đặt link, bản nháp thư mời
5. Lead viết brief nội dung cho Marketing và phiếu kỹ thuật cho Kỹ sư qua Trợ lý giám đốc
6. Kiểm duyệt soát từng kết quả; KHÔNG ĐẠT thì trả về vai làm
7. Lead chốt; thư mời và đăng ký danh bạ chờ anh duyệt và anh gửi; Thư ký ghi kết quả, lịch đo 14 và 28 ngày
8. Đến lịch đo, Theo dõi viết báo cáo trước/sau; Lead đề xuất đợt kế
Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Không mua link, không PBN, không trao đổi link hàng loạt, không spam bình luận hay diễn đàn, không nội dung nhồi từ khoá hay trang cửa ngõ; thư mời đặt link, xin bài khách mời, đăng ký danh bạ là bản nháp anh duyệt và anh tự gửi; không tạo tài khoản; không tiêu tiền cho công cụ SEO trả phí (nếu cần thì trình anh kèm giá); chỉ đọc trang công khai, không cào trái điều khoản; sửa onpage trên Shopify SSF (SEO title, meta description, alt ảnh) phải được anh duyệt bảng trước/sau (sau khi kiểm duyệt ĐẠT ĐỀ XUẤT), sao lưu trước, ghi sau, đọc lại so sánh với bảng đã duyệt (lệch thì khôi phục từ bản sao lưu), rồi kiểm duyệt ĐẠT SAU GHI, đổi tên sản phẩm, giá, mô tả bán hàng thì chuyển Phòng Vận hành; sửa code site chuyển Phòng Kỹ sư; viết bài chuyển Phòng Marketing; không dùng tên hay logo Cole/Fago.
- Ngân sách mỗi việc: 8 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

## Skill dùng

- mkt-seo-ky-thuat (có sẵn)
- mkt-viet-bai-seo (có sẵn)
- ai-seo (có sẵn)
- content-seo (có sẵn)
- fixing-metadata (có sẵn)
- kho-du-lieu (có sẵn)
