---
name: phong-video
description: "Phòng Video: Làm video: giới thiệu sản phẩm, quảng cáo ngắn, hướng dẫn; viết kịch bản, dựng bằng code, lồng tiếng, xuất file. Dùng khi Trợ lý giám đốc giao phiếu cho phòng này, hoặc anh \"giao cho Phòng Video\"."
---

# Phòng Video

Trợ lý giám đốc lập phòng này ngày 2026-11-03 (đề xuất D-20261103-024406-lfl). Phòng nhận việc: Làm video: giới thiệu sản phẩm, quảng cáo ngắn, hướng dẫn; viết kịch bản, dựng bằng code, lồng tiếng, xuất file.

`T=~/.claude/skills/tro-ly-giam-doc/scripts`

## Đội

| Vai | Agent | Loại | Mô hình |
| --- | --- | --- | --- |
| Trưởng phòng Video | `video-lead` | lead | opus |
| Biên kịch | `video-bien-kich` | lam | sonnet |
| Dựng video | `video-dung` | lam | sonnet |
| Kiểm duyệt | `video-kiem-duyet` | kiem | sonnet |
| Thư ký | `video-thu-ky` | thu-ky | haiku |

## Dòng chảy một việc

`K=~/.claude/skills/kho-du-lieu/scripts/kho.mjs`. Mọi file của việc để trong `~/company/video/<id-phiếu>/`.

0. Nhận `phiếu <id>`: `node $T/tickets.mjs status <id> "đang làm" --by phong-video`.
1. **Lead tra kho trước**: `node $K search "<sản phẩm / chủ đề>"` và `node $K search video` (thông tin sản phẩm, bài học video cũ); chỉ tìm thêm trên web khi kho thiếu.
2. **Lead viết `brief.md`**: mục đích, người xem, nền tảng, giọng, video mẫu (nếu có), một điều người xem phải nhớ, ràng buộc, và `quan-trong: co|khong`. Kèm **Lời hứa giao hàng** đo được: khổ hình, độ dài (±2 giây), lời kêu gọi hành động, chữ bắt buộc phải có.
   - **Video mẫu thay cho lời tả**: muốn khớp một phong cách thì xin anh 1–3 video mẫu (cùng loại sản phẩm, cùng khổ dọc/ngang), để vào `mau/` trong thư mục phiếu, và ghi tên hiệu ứng cụ thể (vd card wall, pull back) thay cho "làm cho đẹp". Chỗ nào brief chưa rõ (có chữ hay không, nhạc hay giọng đọc) thì Lead gom câu hỏi hỏi anh một lần, không tự đoán.
2b. **Có video mẫu thì Dựng phân tích trước khi Biên kịch viết** (Lead không có Bash nên không tự làm): Dựng (hoặc điều phối) chép file mẫu vào `mau/` trong `~/company/video/<id-phiếu>/` và ghi đường dẫn vào `brief.md`. Với **mỗi mẫu** `<ten>`: tách khung hình `mkdir -p "mau/khung/<ten>" && ffmpeg -y -i "mau/<file>" -vf fps=2,scale=480:-1 "mau/khung/<ten>/%04d.jpg"` (mẫu dài hơn 60 giây thì dùng `fps=1`), tìm chỗ cắt cảnh `ffmpeg -i "mau/<file>" -vf "select='gt(scene,0.3)',showinfo" -f null - 2>&1 | grep pts_time` (không ra dòng nào là bình thường với mẫu chuyển cảnh mềm như zoom hay lia: hạ ngưỡng xuống 0.15 hoặc dựa vào khung hình). Xem khung bằng ảnh lưới `ffmpeg -y -i "mau/<file>" -vf "fps=0.5,scale=240:-1,tile=6x4" "mau/khung/<ten>/luoi-%03d.jpg"` (mỗi ảnh lưới 24 khung, phủ 48 giây) và khung quanh chỗ cắt, không mở từng ảnh. Viết `mau/bang-canh.md`: mỗi mẫu một mục, mỗi cảnh một dòng (giây bắt đầu–kết thúc, nội dung, chuyển cảnh, chữ, màu, nhịp), cuối file mục "Cấu trúc chung rút ra". Chỉ học cấu trúc và nhịp; không dùng lại hình, nhạc hay chữ của video mẫu.
3. **Lead chọn bộ dựng** và ghi lý do vào phiếu, từ đây khoá bộ dựng (không tự đổi giữa chừng):
   - `hyperframes-create`: quảng cáo dọc 9:16, chữ chuyển động, video từ trang web hay màn hình sản phẩm, khi cần tránh giấy phép Remotion.
   - `remotion-create` (xuất bằng `remotion-render`): phụ đề theo từng từ, video hướng dẫn dài nhiều cảnh, project Remotion có sẵn.
3b. **Chọn hook trước khi viết kịch bản**: Biên kịch viết `hooks.md` gồm 6–8 hook khác kiểu (câu hỏi nỗi đau, POV, trước–sau, con số đúng sự thật, lời khuyên, so sánh, tò mò, nói thẳng lợi ích); mỗi hook có lời đọc đọc hết trong khoảng 2,5 giây, chữ trên màn hình ≤ 6 từ, hình dùng và nguồn mọi sự thật. Kiểm duyệt xem từng ảnh rồi chấm vào `hooks-cham.md` (1–5 cho: dừng lướt khi tắt tiếng, khớp hình đang hiện, đúng sự thật, dẫn vào thân và lời kêu gọi, khác video mẫu); hook phạm điều cấm trong brief hoặc lời không khớp hình thì LOẠI. Chọn 1 hook và 1 dự phòng, kèm bản sửa nếu cần. Biên kịch mở kịch bản bằng hook đã chọn. Ghi dạng hook theo `references/hook-12-dang.md`; 6–8 hook nháp phải thuộc ít nhất 3 dạng của bảng đó.
4. Biên kịch viết `script.md` và kế hoạch cảnh, ghi vào `storyboard.csv` theo mẫu `references/storyboard-mau.csv`, mỗi cảnh một dòng (có `mau/bang-canh.md` thì bám nhịp và độ dài cảnh theo đó), chỉ dùng chi tiết có trong kho hoặc brief, không bịa số hay lời khách.
5. **Cổng: anh duyệt kịch bản** (luôn chờ anh, kể cả khi Auto bật).
6. Dựng làm project và xuất **một ảnh mỗi cảnh**; Kiểm duyệt xem bảng ảnh (chữ đọc được, vùng an toàn, đúng kịch bản) trước khi xuất video. Brief đánh dấu `quan-trong: co` (video sẽ chạy quảng cáo, gửi khách, hay đại diện thương hiệu) thì **gửi bảng ảnh cho anh và chờ anh duyệt** trước khi xuất.
7. Dựng xuất bản nháp; Kiểm duyệt đối chiếu từng mục của Lời hứa giao hàng, so bản nháp với `mau/` (không có hình, nhạc, câu chữ nào lấy lại từ mẫu) và chạy checklist 17 dòng trong agent `video-kiem-duyet` (nguồn: mục 8 của `~/project/my-office/docs/tieu-chi-video-ban-hang-affiliate.md`): `ffprobe` (thời lượng, khổ, codec), khung hình, khung đen, âm lượng, phụ đề, cảnh lặp. Báo cáo là bảng từng dòng, kết quả, mức chắc chắn, bằng chứng; ĐẠT khi mọi dòng bắt buộc và kỹ thuật đạt, dòng bắt buộc trượt là không đăng. Lỗi chia mức chặn / nên sửa / lưu ý; **tối đa 2 vòng sửa**, quá thì Lead báo Trợ lý.
8. Dựng xuất bản cuối (không ghi đè bản cũ); Thư ký ghi kết quả vào phiếu; anh nhận video, việc đăng do anh quyết.
9. Thư ký lưu 1–3 bài học (thẻ `video`) vào kho bằng `node $K them --tu-file <file> --loai quyet-dinh --the video --phieu <id>`, Lead duyệt nội dung trước.

Cuối việc, Thư ký ghi kết quả: viết `{ "summary", "links" }` vào một file bằng tool Write, rồi chạy `node $T/tickets.mjs result <id> --json <file>`. Sau đó đặt phiếu sang "chờ anh nhận" khi phòng đang thử việc, hoặc sang "xong".

## Lead giám sát

Lead của phòng theo dõi việc từ đầu tới cuối. Gặp vấn đề phòng không tự giải được thì báo về Trợ lý giám đốc. Ví dụ: kẹt (trả về nhiều lần), thiếu vai, thiếu công cụ, thiếu quyền, sắp vượt ngân sách, yêu cầu không rõ.
- Viết `{ "problem", "need": "trợ lý" | "anh" }` ra file bằng tool Write, rồi chạy `node $T/tickets.mjs escalate <id> --by <lead> --json <file>`.
- Chỉ anh quyết được thì `need: "anh"`.
- Trong lúc chờ, làm phần khác của việc nếu được.

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Phòng đang thử việc: mọi kết quả đặt phiếu sang "chờ anh nhận", không tự sang "xong".
- Không tự đăng video lên YouTube, TikTok hay mạng xã hội; không tự mua nhạc, ảnh, giọng đọc.
- Ngân sách mỗi việc: 10 USD. Vượt ngân sách, kẹt, hoặc cần anh quyết thì dừng, đặt phiếu sang "chờ anh" kèm lý do, gửi thông báo bằng tool `PushNotification`.
- Không bao giờ nhập mật khẩu, thẻ, API key.
- Việc ngoài phạm vi phòng: trả lại cho Trợ lý giám đốc (`tickets.mjs status <id> "chờ anh" --note …`).

## Skill dùng

- remotion-create (GitHub https://github.com/remotion-dev/skills @c7cb2fdcacd134fb2ccb9b7a44f9ffa44e467271, giấy phép chưa rõ (chỉ học ý tưởng, tự viết lại), đã kiểm 2 lớp, 2 chỗ gọi mạng)
- remotion-render (GitHub https://github.com/remotion-dev/skills @c7cb2fdcacd134fb2ccb9b7a44f9ffa44e467271, giấy phép chưa rõ (chỉ học ý tưởng, tự viết lại), đã kiểm 2 lớp, 4 chỗ gọi mạng)
- hyperframes-create (GitHub https://github.com/heygen-com/hyperframes @05ddddbbf08fd358b5879726f935d5414733da3a, giấy phép Apache-2.0, học ý tưởng từ `skills/hyperframes` và `skills/hyperframes-cli`, tự viết lại, đã kiểm 2 lớp; CLI ghim `hyperframes@0.9.6` cài có lockfile, tắt telemetry, chỉ dựng trên máy)
- gsap-animation (GitHub https://github.com/greensock/gsap-skills @aed9cfd3277740755f6bfc1155c7aa645403b760, MIT, học ý tưởng từ gsap-core/timeline/performance/utils, tự viết lại, đã kiểm 2 lớp): viết chuyển động GSAP cho cảnh HyperFrames — timeline dừng sẵn, không ngẫu nhiên, không lặp vô hạn
- kho-du-lieu (có sẵn): tra kho trước khi làm, lưu bài học sau khi xong
- Quy trình học ý tưởng từ OpenMontage (AGPL-3.0, không chép mã): `~/project/my-office/docs/hoc-tu-openmontage.md`
