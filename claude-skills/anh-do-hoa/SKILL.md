---
name: anh-do-hoa
description: Làm ảnh đồ họa bằng code — viết HTML/CSS rồi chụp ra PNG bằng Chrome chạy ẩn (bài mạng xã hội, banner, thumbnail YouTube, ảnh bìa, ảnh trích dẫn, infographic đơn giản), không tốn tiền dịch vụ. Dùng khi phòng Marketing hay phòng Video cần ảnh tĩnh.
---

# Ảnh đồ họa bằng code

Mỗi ảnh là một file HTML tự đủ (CSS trong `<style>`, không gọi mạng) chụp ra PNG đúng khổ. Sửa chữ hay màu là sửa HTML rồi chụp lại, nên làm nhiều phiên bản rất rẻ.

## Khổ ảnh

| Dùng cho | Khổ (px) |
| --- | --- |
| Bài Facebook / Instagram vuông | 1080×1080 |
| Bài Instagram dọc, LinkedIn dọc | 1080×1350 |
| Story, Reels, TikTok (ảnh bìa dọc) | 1080×1920 |
| Thumbnail YouTube | 1280×720 |
| Ảnh chia sẻ link (Open Graph) | 1200×630 |
| Ảnh bìa trang Facebook | 1640×624 (chữ quan trọng ở giữa 1200×624) |
| Banner LinkedIn | 1584×396 |
| Ảnh minh họa trong bài viết | 1600×900 |

Không chắc khổ của nền tảng thì ghi vào phiếu khổ đã chọn và lý do.

## Cách làm

1. Đặt file trong thư mục việc của phiếu, vd `~/company/marketing/<id-phiếu>/anh/<tên>.html`. Tên file gồm chữ thường, số, gạch ngang.
2. Viết HTML: `<html lang="vi"><meta charset="utf-8">`, `html, body { margin: 0; width: <rộng>px; height: <cao>px; overflow: hidden }`. Mọi ảnh, icon, font để cạnh file và gọi bằng đường dẫn tương đối; không link ra ngoài (ảnh phải chụp được khi không có mạng).
3. Chụp (thư mục hồ sơ Chrome tạm được xoá khi lệnh xong):
   ```bash
   chrome_profile="$(mktemp -d)"; trap 'rm -rf -- "$chrome_profile"' EXIT
   google-chrome --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
     --user-data-dir="$chrome_profile" --window-size=<rộng>,<cao> \
     --screenshot=<tên>.png "file://$PWD/<tên>.html"
   ```
   Chạy cả khối trong cùng một lần gọi shell để `trap` dọn được.
   Nhiều ảnh thì lặp qua danh sách tên file; không ghép chuỗi từ nội dung bên ngoài vào lệnh.
4. Kiểm: `file <tên>.png` phải ra đúng khổ; mở PNG bằng tool Read và tự xem (chữ đủ dấu, không tràn, không bị cắt). Bản sửa lưu tên mới `-v2`, `-v3`, không ghi đè bản đã giao.

## Luật thiết kế

- Mỗi ảnh một ý chính: một tiêu đề, nhiều nhất một dòng phụ và một lời kêu gọi. Người xem lướt qua trong 1–2 giây.
- Cỡ chữ với khổ rộng 1080px: tiêu đề từ 72px, chữ phụ từ 36px; khổ khác nhân theo tỉ lệ chiều rộng. Thumbnail YouTube: tối đa 5–6 chữ, cỡ từ 90px.
- Vùng an toàn: chữ cách mép ít nhất 6% mỗi cạnh; khổ dọc 1080×1920 chừa 250px trên và dưới cho giao diện ứng dụng.
- Tương phản: chữ trên nền đạt ít nhất 4.5:1 (chữ to từ 3:1). Chữ trên ảnh nền thì phủ một lớp màu tối hoặc sáng.
- Font: dùng font có đủ dấu tiếng Việt (vd `"Be Vietnam Pro"`, `"Noto Sans"` có trên máy, hoặc file font để cạnh HTML với `@font-face`). Xem kỹ các dấu ắ, ỗ, ữ, ự, đ trên PNG.
- Màu, font theo `DESIGN.md` nếu thư mục việc hoặc dự án có; không có thì tối đa 2 màu chính và 1 màu nhấn, giữ nhất quán trong cùng một bộ ảnh.
- Không dùng hiệu ứng rẻ: bóng đổ nặng, viền cầu vồng, quá ba cỡ chữ, chữ nghiêng kéo giãn.

## Nội dung

- Chữ trên ảnh chỉ lấy từ nội dung đã được Kiểm duyệt duyệt và `~/company/marketing/SU-THAT-DA-XAC-NHAN.md`. Không bịa số, lời khen, logo khách hàng.
- Không dùng ảnh người thật, logo hay ảnh của người khác. Trường hợp nào cần (ảnh chụp thật, logo đối tác, ảnh AI) thì ghi vào phiếu chờ anh duyệt, không tự làm.
- Đăng ảnh lên đâu là việc của anh: phòng chỉ giao file.

## Giao

Mỗi ảnh giao cả `.html` (nguồn) và `.png`, kèm một dòng: dùng cho đâu, khổ, chữ trên ảnh. Kiểm duyệt xem PNG trước khi giao anh.
