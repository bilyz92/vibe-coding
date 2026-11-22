---
name: remotion-create
description: Tạo mới hoặc sửa một video Remotion (video dựng bằng React) — dựng project, mở Studio xem trực tiếp, bố cục khung hình kiểu video chứ không phải trang web. Dùng khi phòng Video dựng bản nháp, hoặc khi cần làm video giới thiệu, quảng cáo ngắn, hướng dẫn bằng code.
---

# Tạo video Remotion

Nguồn ý tưởng: remotion-dev/skills @c7cb2fd (`remotion-create`), viết lại cho My Company. Remotion: thư viện dựng video bằng React, mỗi khung hình là một lần render component.

## 1. Chọn chỗ đặt project

- Đã có project Remotion (có `remotion.config.ts` hoặc `@remotion/cli` trong `package.json`) thì dùng luôn, bỏ qua bước 2.
- Project mới đặt trong thư mục làm việc của phiếu (vd `~/company/video/<id-phiếu>/`), không bao giờ trong repo đang có code khác hay trong thư mục cấu hình của Claude.
- Xem cả file ẩn trước khi quyết. Thư mục chỉ có rác hệ điều hành (`.DS_Store`) coi là trống. `.git`, `.env` là nội dung thật: khi đó tạo project trong thư mục con.

## 2. Dựng project

```bash
npx create-video@latest --yes --blank --no-tailwind <ten-video>
cd <ten-video> && npm i
```

Ghi lại phiên bản `remotion` trong `package.json` vào phiếu: các bước sau cần đúng bản này. Không thêm gói ngoài nếu kịch bản không cần.

## 3. Mở Studio trước khi dựng

Chạy `npx remotion studio` (chạy nền) ngay sau khi cài xong và giữ nó chạy suốt lúc làm, để anh hoặc Kiểm duyệt xem thay đổi trực tiếp. Báo địa chỉ Studio vào phiếu.

## 4. Bố cục: đây là video, không phải trang web

- Mỗi cảnh chỉ có **một** thứ người xem phải thấy đầu tiên; dựng khung quanh nó. Bỏ mọi thứ thừa.
- Vùng an toàn, với khổ rộng 1080px: chữ quan trọng cách mép trái/phải ít nhất 80px, cách trên/dưới ít nhất 100px.
- Cỡ chữ tối thiểu, với khổ rộng 1080px: tiêu đề chính 84px, chữ phụ quan trọng 44px. Khổ khác thì nhân theo tỉ lệ chiều rộng.
- Chuyển động luôn tính từ `useCurrentFrame()` (vd `interpolate`, `spring`). Không dùng CSS transition/animation hay class `animate-*` của Tailwind: chúng không theo khung hình nên video xuất ra bị giật hoặc sai.

## 5. Cấu trúc

- Đăng ký mỗi video bằng một `<Composition>` (ảnh tĩnh: `<Still>`) trong file root, với `id`, `fps`, `width`, `height`, `durationInFrames` rõ ràng.
- Video nhiều cảnh nối tiếp: mỗi cảnh một component, xếp bằng `<Series>` hoặc `<Sequence from=…>`.
- Video ghép nhiều clip hình/tiếng trên dòng thời gian: mỗi clip cần sửa riêng là một node JSX riêng (`<Video>`, `<Audio>` trong `<Sequence>`).
- Thông số chỉnh được (chữ, màu, thời lượng) đưa vào props của composition để sửa trong Studio, không viết cứng rải rác.

## 6. Tailwind

Chỉ dùng khi kịch bản yêu cầu và project đã bật Tailwind theo tài liệu Remotion. Luật chuyển động ở mục 4 vẫn áp dụng.

## Xong khi

Studio mở được, composition hiện đủ cảnh theo kịch bản, chữ đọc được trong vùng an toàn. Xuất file thì dùng skill `remotion-render`.
