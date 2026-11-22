---
name: mkt-tiep-can-lanh
description: "Tiếp cận khách tiềm năng CÓ SỰ ĐỒNG Ý cho dịch vụ Claude Code, AI agent: chỉ soạn email/SMS/tin nhắn quảng cáo cho người đã đồng ý trước và có ghi nhận (thời điểm, kênh, nội dung); nếu chưa có thì gợi ý kênh không quảng cáo trực tiếp (trả lời công khai, bài viết, mời đăng ký nhận tin, giới thiệu qua người quen, form liên hệ hợp tác). Có cổng chặn theo quốc gia, cá nhân hóa, nhịp tối đa 1 tin + 1 nhắc, opt-out, deliverability, bảng theo dõi có cột consent. Dùng khi anh nói \"cold email\", \"tiếp cận khách\", \"gửi tin cho khách tiềm năng\", \"outreach\", \"follow-up\", \"danh sách lead\", \"deliverability\". Chỉ soạn bản nháp và bảng, không gửi."
---

# Tiếp cận có sự đồng ý

Mục tiêu một cuộc trò chuyện 15-20 phút, không phải bán ngay. Skill này soạn bản nháp và bảng theo dõi; việc gửi do anh.

## Cổng chặn bắt buộc (làm trước mọi thứ khác)

Đây là điều kiện bắt buộc, không phải lời khuyên. Email công việc đăng công khai KHÔNG phải là sự đồng ý.

**Người nhận ở Việt Nam:** email, SMS hoặc tin nhắn quảng cáo CHỈ được soạn cho người đã đồng ý nhận trước, và đã có ghi nhận sự đồng ý gồm: thời điểm, kênh, nội dung họ đã đồng ý. Thiếu ghi nhận thì KHÔNG soạn chuỗi gửi. Thay vào đó đề xuất một trong các hướng sau, anh quyết:
- Trả lời công khai trong cộng đồng, diễn đàn, bình luận khi họ hỏi đúng chủ đề.
- Viết bài hữu ích và mời đăng ký nhận tin (opt-in); đồng ý được ghi lại từ lúc họ đăng ký.
- Nhờ người quen giới thiệu.
- Gửi qua form "liên hệ hợp tác" của chính công ty đó, chỉ khi nội dung là một đề xuất hợp tác cụ thể, không phải quảng cáo hàng loạt.

**Nước khác (Mỹ, EU/UK, ...):** chỉ soạn khi anh đã tự kiểm yêu cầu pháp lý hiện hành của nước đó và ghi vào bảng theo dõi: nguồn (URL hoặc tên văn bản) và ngày kiểm (cột `ghi_chu` hoặc `consent_ghi_nhan`). Chưa kiểm thì coi như cần đồng ý trước, áp dụng đúng cổng chặn như Việt Nam.

**Lưu ý về độ chắc chắn:** em không xác minh được văn bản luật chính xác (Nghị định 91/2020/NĐ-CP về chống tin nhắn rác, thư điện tử rác, cuộc gọi rác; CAN-SPAM; GDPR/ePrivacy). Quy tắc trong skill này cố ý chặt hơn mức tối thiểu của luật để an toàn; không nên đọc nó như bản tóm tắt luật.

## Bước 1: định nghĩa khách phù hợp (ICP)

- [ ] Loại khách: nhóm dev 3-20 người, agency, doanh nghiệp nhỏ muốn tự động hóa bằng AI.
- [ ] Dấu hiệu họ cần dịch vụ (quan sát công khai): đang tuyển dev, vừa ra mắt sản phẩm, đăng bài về AI, repo công khai không có quy trình review.
- [ ] Dấu hiệu loại trừ: không liên quan, đã từ chối, địa chỉ cá nhân không rõ nguồn.
- [ ] Số lượng ban đầu: 10-20 người/tuần, chất lượng hơn số lượng.

## Bước 2: tìm khách thủ công, đúng nguồn

- Nguồn để tìm hiểu: website công ty, trang "đội ngũ", profile công khai, repo GitHub công khai, bài đăng/blog, sự kiện anh tham dự, giới thiệu từ người quen. Nguồn này giúp hiểu khách, không thay cho sự đồng ý.
- Không đoán địa chỉ cá nhân, không mua danh sách, không scrape hàng loạt, không dùng dữ liệu rò rỉ.
- Mỗi lead ghi: tên, vai trò, công ty, nguồn tìm ra (URL), một chi tiết cá nhân hóa có thật, ngày, và tình trạng đồng ý (xem bảng theo dõi).
- Dữ liệu cá nhân: chỉ ghi dữ liệu tối thiểu trong bối cảnh công việc (tên, vai trò, công ty, nguồn công khai); không thu thập dữ liệu nhạy cảm (sức khỏe, tôn giáo, chính trị, tài chính cá nhân, gia đình...). Dòng nào không đi tới đồng ý sau một thời hạn ngắn (ví dụ 30 ngày) thì xóa.
- Cơ sở: Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Em chưa xác minh văn bản chính xác; quy tắc ở trên cố ý chặt hơn mức cần thiết để an toàn.

## Bước 3: cá nhân hóa trung thực

- Một câu cho thấy anh thực sự đã đọc: "Em thấy repo X của anh đang dùng Y..." Chỉ nêu điều đã xác minh.
- Một lý do liên quan tới họ, không phải tới anh.
- Không giả quen, không giả "đã trao đổi trước", không giả lý do chung chung.
- Không tự gắn số liệu về công ty họ nếu không có nguồn.

## Bước 3b: "demo làm sẵn" (tùy chọn, chỉ cho khách rất hợp)

Ý: đưa giá trị trước rồi mới mời. Demo KHÔNG thay cho sự đồng ý. Chỉ coi là đồng ý nhận tin quảng cáo khi người đó chủ động đánh dấu/viết rõ là muốn nhận tin, nói rõ nhận nội dung gì, qua kênh nào. Một câu trả lời thường (hỏi thêm, góp ý, xin xem demo) không phải đồng ý nhận tin: xin xem demo thì chỉ được gửi đúng demo đó, sau đó dừng.

**Cách chính: một demo dùng lại được làm "quà đăng ký nhận tin".** Làm một lần, dùng cho mọi người: vd checklist quy trình Claude Code cho nhóm dev nhỏ, bản phác 1 trang về quy trình agent, ảnh "trước/sau" một trang **của chính công ty mình**. Đặt ở bài viết hoặc trang đăng ký. Tải demo không cần đăng ký nhận tin (ô đồng ý không đánh sẵn, không bắt buộc để tải); chỉ người tự đánh dấu ô "đồng ý nhận tin về [nội dung] qua [kênh]" mới được ghi nhận đồng ý (thời điểm, kênh, nội dung) như Bước 2, sau đó mới vào nhịp ở Bước 4.

**Cách phụ: demo riêng cho một khách** (tối đa 1-3 khách/tuần, chọn tay từ Bước 1, mỗi demo khoảng 1 giờ công; không tự động hóa khâu tìm khách):
- Chỉ đưa cho: người đã đồng ý, hoặc trong một đề xuất hợp tác 1-1 qua form "liên hệ hợp tác" của chính công ty đó. Đề xuất qua form là ngoại lệ một lần, KHÔNG thuộc Bước 4: không ghi vào `lan_1`/`lan_2`, không tạo ra đồng ý, im lặng thì không nhắc lại qua bất kỳ kênh nào. Chỉ vào Bước 4 khi sau đó họ đồng ý nhận tin rõ ràng và đã ghi nhận.
- Lần đầu chỉ mô tả demo bằng chữ (khớp Bước 5: lần đầu không link, không đính kèm); họ trả lời muốn xem thì mới gửi.
- Nội dung chỉ về quy trình và trải nghiệm làm việc của dev; không dùng logo, ảnh, nội dung có bản quyền của khách (thay bằng placeholder); không dựng web mang tên khách dưới bất kỳ hình thức nào; không chép tên, email người commit.
- Không chạy công cụ quét hay chạy code của khách. Thấy lộ secret hay lỗ hổng: không đưa vào demo hay lời chào, soạn báo riêng qua kênh bảo mật của họ (security.txt / email security), không kèm chào bán, chờ anh duyệt.
- Không dùng repo hay trang của một khách cụ thể trong bài viết/trả lời công khai khi chưa có đồng ý bằng văn bản (bỏ tên vẫn nhận ra được); cần ví dụ thì dùng ví dụ tự dựng hoặc trang của mình.
- Chỉ nhận xét điều quan sát được công khai, không chê bai; không bịa số "trang của anh đang mất X khách".
- Đưa demo lên mạng là việc ra ngoài: anh duyệt trước; link có mật khẩu hoặc hết hạn, có noindex; xóa ngay khi họ từ chối, hoặc sau 30 ngày không phản hồi.
- Ghi vào các cột `demo_noi_dung`, `demo_link`, `demo_ngay_xoa` của bảng theo dõi để so tỷ lệ trả lời có/không có demo.

## Bước 4: nhịp tối đa (chỉ cho người đã qua cổng chặn)

| Lần | Ngày | Nội dung | Độ dài |
| --- | --- | --- | --- |
| 1 | 0 | Nhắc lại họ đã đồng ý nhận tin gì, vì sao em nhắn, một giá trị cụ thể, câu hỏi nhẹ | 60-100 từ |
| 2 (nhắc, tùy chọn) | +5 đến +7 | Chia sẻ một tài nguyên hữu ích, không "nhắc lại" suông | 40-70 từ |

Tối đa 1 tin + 1 nhắc. Dừng ngay nếu họ trả lời (kể cả từ chối) hoặc yêu cầu ngừng. Không có lần thứ 3.

Ví dụ lần 1 (tiếng Việt, thay bằng dữ kiện thật; chỉ dùng khi đã có ghi nhận đồng ý):
> Chủ đề: Checklist Claude Code cho nhóm [Công ty] như anh đã đăng ký
> Chào anh [Tên], hôm [ngày] anh đăng ký nhận tin về Claude Code qua [kênh]. Em thấy [Công ty] có repo công khai [tên], em đoán nhóm đang bắt đầu dùng công cụ AI. Em làm dịch vụ dựng quy ước, skill và quy trình review để cả nhóm dùng đồng đều. Em gửi anh checklist ngắn, không kèm điều kiện. Em tên là [Tên], [website thật], [địa chỉ liên hệ]. Anh trả lời "dừng" là em xóa khỏi danh sách ngay.

Ví dụ tiếng Anh, ngắn (chỉ khi đã có đồng ý hoặc đã kiểm luật nước đó):
> Hi [Name], you signed up on [date] via [channel] for Claude Code tips. Saw [specific public thing]; happy to send a one-page checklist for small dev teams, no strings. Reply "stop" and I will remove you immediately.

Quy tắc viết: tiêu đề thật, không "Re:" giả; không hứa kết quả; một lời mời duy nhất; giá nêu khi họ hỏi hoặc ở trang dịch vụ.

## Bước 5: deliverability cơ bản

- [ ] Gửi từ tên miền của anh với SPF, DKIM, DMARC cấu hình đúng.
- [ ] Không dùng tên miền mới tinh để gửi nhiều ngay; tăng lượng từ từ.
- [ ] Gửi ít, danh sách sạch, ngừng khi bị trả lại (bounce).
- [ ] Văn bản thuần, ít hoặc không link, không ảnh theo dõi, không file đính kèm ở lần đầu.
- [ ] Không từ khóa kiểu spam, không viết HOA, không dấu chấm than liên tiếp.
- [ ] Gửi từ hộp thư thật mà anh đọc và trả lời được.

## Opt-out và quản lý từ chối

- [ ] Câu từ chối rõ ràng ngay trong tin ("trả lời 'dừng'"), kèm thông tin người gửi thật và cách liên hệ.
- [ ] Từ chối được ghi trong bảng theo dõi trong ngày; không gửi lại, kể cả ở chiến dịch khác. Thu hồi đồng ý cũng xử lý như từ chối.
- [ ] Phản hồi bực bội: một câu xin lỗi, xác nhận đã xóa, không biện hộ.

## Bảng theo dõi (CSV hoặc `docs/outreach/theo-doi.md`)

Cột: `ten | vai_tro | cong_ty | nguon_url | chi_tiet_ca_nhan_hoa | kenh | consent_ghi_nhan | consent_thoi_diem | consent_kenh | demo_noi_dung | demo_link | demo_ngay_xoa | lan_1 | lan_2 | trang_thai | tu_choi | ghi_chu`.
- `demo_noi_dung`, `demo_link`, `demo_ngay_xoa`: để trống nếu không có demo (Bước 3b); không dùng ký tự `|` trong giá trị. Đề xuất qua form hợp tác ghi ở `ghi_chu`, không ghi ở `lan_1`.
- `consent_ghi_nhan`: bằng chứng đồng ý (link form, ảnh chụp, email xác nhận). Với nước ngoài, ghi thêm nguồn luật và ngày anh kiểm.
- `consent_thoi_diem`, `consent_kenh`: khi nào và qua kênh nào họ đồng ý.
- Trạng thái: moi / chua-co-dong-y / da-soan / cho-anh-duyet / da-gui-boi-anh / tra-loi / hen / tu-choi / dung. Dòng `chua-co-dong-y` không được có bản nháp chuỗi gửi.

Theo dõi tỷ lệ trả lời thật, ghi cả khi thấp; không tô số. Sau mỗi 20 tin, xem lại và sửa thông điệp.

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Không bịa số liệu, khách hàng hay lời khen.
- Không mua danh sách, không scrape hàng loạt, không dùng công cụ gửi tự động nếu anh chưa duyệt.
