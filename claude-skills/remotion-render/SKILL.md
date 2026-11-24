---
name: remotion-render
description: Xuất video, ảnh tĩnh, một số khung hình hoặc video nền trong suốt từ project Remotion bằng CLI. Dùng khi phòng Video xuất bản nháp/bản cuối, hoặc khi Kiểm duyệt cần chụp khung hình làm bằng chứng.
---

# Xuất video Remotion

Nguồn ý tưởng: remotion-dev/skills @c7cb2fd (`remotion-render`), viết lại cho My Company. Chạy mọi lệnh trong thư mục project Remotion.

## Trình duyệt dùng để render

Dùng trình duyệt Remotion tự tải và đi kèm (có sẵn các API và bản vá Remotion cần). Không trỏ sang Chrome trên máy (`--browser-executable`, `browserExecutable`, `chromeMode`) trừ khi anh yêu cầu. Lần đầu render, Remotion tải trình duyệt về: báo trước trong phiếu.

## Lệnh

| Cần | Lệnh |
| --- | --- |
| Video MP4 | `npx remotion render <composition-id> out/<ten>.mp4 --overwrite=false` |
| Một ảnh tĩnh | `npx remotion still <composition-id> out/<ten>.png --frame=<số> --overwrite=false` |
| Vài khung hình làm bằng chứng | `npx remotion render <composition-id> out/frames --frames=0,30,90 --image-format=png --overwrite=false` |

Tuỳ chọn đầy đủ: tài liệu CLI của Remotion (`remotion.dev/docs/cli/render`). File xuất luôn để trong `out/` của project. Mọi lệnh có `--overwrite=false` (mặc định Remotion ghi đè): file đích đã có thì đặt tên phiên bản mới (`<ten>-v2`, `<ten>-v3`…), không xoá bản cũ.

Lệnh nhiều khung hình (`--frames=0,30,90`) cần `@remotion/cli` từ 4.0.502. Bản cũ hơn: chạy riêng cho từng khung `npx remotion still <composition-id> out/<ten>-frame-<số>.png --frame=<số> --overwrite=false` (file đã có thì đổi tên như trên); muốn nâng phiên bản thì hỏi Lead trước.

## Video nền trong suốt

Hai cách, chọn theo nơi dùng:

| Dùng ở đâu | Codec | Lệnh |
| --- | --- | --- |
| Đưa vào phần mềm dựng (Premiere, DaVinci…) | ProRes 4444, file `.mov` | `npx remotion render <id> out/<ten>.mov --image-format=png --pixel-format=yuva444p10le --codec=prores --prores-profile=4444 --overwrite=false` |
| Phát trên trình duyệt | VP9, file `.webm` | `npx remotion render <id> out/<ten>.webm --image-format=png --pixel-format=yuva420p --codec=vp9 --overwrite=false` |

Muốn đặt làm mặc định cho một composition thì trả về `defaultCodec`, `defaultVideoImageFormat`, `defaultPixelFormat` (và `defaultProResProfile` với ProRes) từ `calculateMetadata`, **cùng codec với lệnh ở bảng trên** (WebM trong suốt là `vp9`). Đặt cho cả Studio thì dùng `Config.setCodec`, `Config.setPixelFormat`, `Config.setVideoImageFormat` trong `remotion.config.ts`, rồi khởi động lại Studio.

## Kiểm sau khi xuất

- `ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,pix_fmt:stream_tags=alpha_mode out/<ten>.<đuôi>`: đúng thời lượng, khổ hình, codec.
- Kiểm nền trong suốt:
  - ProRes `.mov`: `pix_fmt` phải có kênh alpha (vd `yuva444p10le`).
  - WebM `.webm`: `pix_fmt` thường hiện `yuv420p` dù có alpha, nên không dựa vào nó; kiểm thẻ `alpha_mode=1`, rồi tách một khung bằng bộ giải mã có alpha (`ffmpeg -c:v libvpx-vp9 -i out/<ten>.webm -frames:v 1 out/alpha-check.png`) và xem ảnh PNG có nền trong suốt.
- Ghi đường dẫn file và kết quả `ffprobe` vào phiếu làm bằng chứng.
