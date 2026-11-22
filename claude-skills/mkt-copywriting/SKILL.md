---
name: mkt-copywriting
description: "Viết copy bán hàng bằng các khung AIDA, PAS, BAB, StoryBrand, 4P... cho trang dịch vụ, tin nhắn tiếp cận, quảng bá workshop, bảng giá; có ví dụ tiếng Việt và tiếng Anh. Dùng khi anh nói \"viết copy\", \"viết trang dịch vụ\", \"landing page\", \"headline\", \"CTA\", \"bán workshop\", \"copywriting\", \"AIDA\", \"PAS\", \"giá dịch vụ\". Cấm lời khen giả, hứa thu nhập, giấu giá. Chỉ soạn bản nháp. Với copy tiếng Anh cho trang sản phẩm/shop bán lẻ Mỹ (Small Space Fixes), dùng skill copywriting."
---

# Copywriting cho dịch vụ Claude Code / AI agent

Copy tốt là nói rõ: giúp ai, giải quyết việc gì, làm thế nào, giá bao nhiêu, bước tiếp theo là gì. Hoa mỹ không bù được sự mơ hồ.

## Trước khi viết (hỏi anh nếu thiếu)

- [ ] Ai đọc: dev lead, CTO nhóm nhỏ, chủ doanh nghiệp không rành kỹ thuật?
- [ ] Nỗi đau cụ thể của họ, bằng lời họ nói (từ cuộc trò chuyện thật, không tự nghĩ).
- [ ] Dịch vụ cụ thể: làm gì, đầu ra là gì, mất bao lâu, giá hoặc khoảng giá.
- [ ] Bằng chứng anh thực sự có: dự án đã làm, demo, repo, số đo thật có thể nêu tên. Không có thì viết ít hơn, đừng bịa.
- [ ] Hành động mong muốn: đặt lịch gọi 20 phút, đăng ký workshop, trả lời tin nhắn.

## Chọn khung

| Khung | Dùng khi | Xương sống |
| --- | --- | --- |
| AIDA | Trang dịch vụ, bài quảng bá | Attention (câu mở) → Interest (vì sao liên quan) → Desire (kết quả, cách làm) → Action |
| PAS | Người đọc đã thấy đau | Problem → Agitate (hệ quả nếu để nguyên) → Solution |
| BAB | Có chuyển biến rõ trước/sau | Before → After → Bridge (cách đi từ A sang B) |
| StoryBrand | Trang chủ, giới thiệu | Khách là nhân vật chính, anh là người dẫn đường: vấn đề → kế hoạch → lời mời → thành quả/rủi ro tránh được |
| 4P / FAB | Mô tả gói dịch vụ | Feature → Advantage → Benefit, giá nêu thẳng |

Chọn một khung chính cho mỗi bản; đừng trộn năm khung trong một đoạn.

Câu mở (headline, câu đầu bài, hook quảng cáo): viết 5 hook nháp thuộc ít nhất 3 dạng trong `~/.claude/skills/phong-video/references/hook-12-dang.md`, rồi mới chọn 1. Rào trong bảng đó áp dụng như quy tắc cứng bên dưới.

## Ví dụ, viết lại theo ý của anh

PAS, tiếng Việt, tin tiếp cận dev lead (chỉ minh họa, thay bằng dữ kiện thật):
> Đội anh đã thử Claude Code nhưng mỗi người dùng một kiểu, kết quả lúc hay lúc dở. (P)
> Không có quy ước chung thì code do AI viết thành thêm việc review cho cả nhóm. (A)
> Em dựng giúp bộ quy ước, skill và quy trình review cho nhóm anh trong 2 buổi; làm xong nhóm tự vận hành. Anh có muốn xem một bản demo 15 phút không? (S)

AIDA, tiếng Anh, trang dịch vụ:
> **Ship with Claude Code, without the chaos.** (A)
> Small dev teams adopt AI coding tools faster than they adopt shared rules. (I)
> In a 2-session workshop we set up your repo conventions, review flow and reusable skills, so every teammate gets consistent results. (D)
> Book a 20-minute intro call. Pricing is listed below, no surprises. (A)

BAB, workshop:
> Trước: mỗi dev tự mò prompt. Sau: cả nhóm có chung bộ skill và checklist review. Cầu nối: workshop thực hành 3 giờ trên chính repo của nhóm.

## Cấu trúc một trang dịch vụ

1. Headline: đối tượng + kết quả cụ thể (không khẩu hiệu rỗng).
2. Dòng phụ: làm thế nào, trong bao lâu.
3. Vấn đề họ đang gặp (2-3 gạch đầu dòng, đúng lời họ).
4. Anh làm gì: các bước, đầu ra bàn giao.
5. Bằng chứng thật: dự án, demo, repo; để trống mục này (ghi `[CHƯA CÓ]`) còn hơn bịa.
6. Giá hoặc khoảng giá, cái gì nằm trong và ngoài gói.
7. Câu hỏi thường gặp, gồm cả "khi nào không nên thuê tôi".
8. Một CTA chính, lặp lại ở cuối.

## Quy tắc cứng

- [ ] Không lời chứng thực (testimonial) giả, không tên khách, logo, số liệu "đã giúp 50 công ty" nếu không có thật và không được phép nêu. Thiếu thì để placeholder rõ ràng.
- [ ] Không hứa thu nhập hay kết quả tài chính ("kiếm 100 triệu/tháng với AI", "tăng doanh thu gấp 3"). Chỉ mô tả công việc anh làm và đầu ra bàn giao.
- [ ] Không bảo đảm vô điều kiện ("100% hiệu quả"). Nói điều kiện và giới hạn.
- [ ] Minh bạch giá: nêu giá hoặc khoảng giá, đơn vị, thuế, thanh toán thế nào, phạm vi, chính sách hủy/hoàn. Nếu phải báo giá theo dự án, nói cách tính.
- [ ] Không tạo khan hiếm giả ("chỉ còn 2 suất" khi không phải thật), không đếm ngược giả.
- [ ] Mô tả đúng việc AI làm được và chưa làm được; không thần thánh hóa.
- [ ] Số liệu/so sánh có nguồn hoặc là số của chính anh có thể chứng minh.

## Giọng và định dạng

- Tiếng Việt: xưng hô nhất quán (em/anh, hoặc "tôi/bạn" cho công khai); câu ngắn, động từ cụ thể, tránh "giải pháp toàn diện", "đột phá".
- Tiếng Anh: plain, direct, một ý một câu; không dịch máy từ bản Việt.
- Thuật ngữ kỹ thuật giữ nguyên tiếng Anh, giải thích một dòng khi người đọc không phải dev.
- Mỗi bản nháp đưa 2-3 biến thể headline để anh chọn.

## Copy cho tin nhắn tiếp cận và workshop

- Tin tiếp cận: chi tiết cách soạn và nhịp gửi nằm ở skill `mkt-tiep-can-lanh` (tối đa 1 tin + 1 nhắc, chỉ khi có đồng ý); ở đây chỉ chọn khung (PAS ngắn là hợp nhất).
- Quảng bá workshop: ngày giờ, thời lượng, ai nên/không nên tham gia, người học làm ra gì, cần chuẩn bị gì, giá, số chỗ thật, cách hủy.

## Bàn giao

Lưu `docs/copy/<ten>.md`: bản chính, 2 biến thể headline, danh sách `[CHƯA CÓ]` cần anh bổ sung (bằng chứng, giá, điều khoản), ghi chú khung đã dùng.

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Không bịa số liệu, khách hàng hay lời khen.
