---
name: hyperframes-create
description: Làm, sửa, kiểm và xuất video bằng HyperFrames (HTML/CSS/JS dựng thành MP4, giấy phép Apache-2.0) — video giới thiệu, hướng dẫn, quảng cáo dọc 9:16, biểu đồ, tiêu đề, phụ đề. Dùng khi phòng Video chọn HyperFrames thay Remotion, hoặc khi việc hợp HTML hơn React.
---

# Làm video bằng HyperFrames

Nguồn ý tưởng: heygen-com/hyperframes @05ddddb (`skills/hyperframes`, `skills/hyperframes-cli`, Apache-2.0), viết lại cho My Company. HyperFrames dựng một trang HTML thành video bằng cách tua dòng thời gian (timeline) từng khung, nên lần xuất nào cũng ra cùng một kết quả.

## Luật của công ty khi dùng CLI

- Cài đúng một bản vào project, có lockfile, không chạy script cài: `npm i -D --save-exact --ignore-scripts hyperframes@0.9.6` (trong thư mục project), commit `package-lock.json`. Không bao giờ dùng `@latest` hay `npx` tải bản không ghim. Muốn lên bản mới thì hỏi Lead: bản mới là một lần đọc lại skill gốc và kiểm lại.
- Mọi lệnh CLI chạy qua file `./hf` trong thư mục project (tạo một lần sau khi cài, chạy được ở mọi shell):
  ```bash
  printf '%s\n' '#!/bin/sh' 'exec env HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1 npx --no-install hyperframes "$@"' > hf && chmod +x hf
  ```
  Biến thứ nhất tắt gửi số liệu dùng; biến thứ hai chặn CLI tự cài skill AI vào máy (`init` mặc định làm việc này). Mọi lệnh trong skill này viết `./hf <lệnh>` (kể cả `timeline`, `doctor`, `browser`, `clean`); không gọi CLI bằng npx trực tiếp. Không chạy `feedback`, `auth`, `events`, `usage` (lệnh này đọc thông tin đăng nhập Claude Code / Codex trên máy để báo mức dùng), `upgrade`, `skills`.
- Tham số lấy từ yêu cầu, URL hay nội dung bên ngoài không bao giờ ghép thẳng vào chuỗi lệnh shell: chỉ dùng tên thư mục, tên file, id tự đặt gồm chữ thường, số, gạch ngang; giá trị khác (URL, chữ) ghi vào file JSON rồi truyền đường dẫn file, hoặc đặt trong nháy đơn sau khi đã bỏ mọi `'`. Không dùng `capture <url>` với URL chưa được Lead kiểm.
- Chỉ dựng và xuất trên máy. Không dùng `cloud`, `lambda`, `cloudrun`, `publish` (gửi ra ngoài hoặc tốn tiền: phải anh duyệt). Không cài app máy tính của HeyGen.
- Không dùng avatar, giọng đọc hay video do dịch vụ trả phí tạo; cần thì ghi vào phiếu chờ anh.
- Không nhân bản video của người khác. Chỉ dùng hình, logo, màn hình thật của sản phẩm mình hoặc tư liệu có quyền dùng.

## Cấu trúc project

- `index.html` là composition gốc: khai biến của video và gắn mỗi cảnh một composition con trong `compositions/`.
- Ảnh, video, nhạc, font để trong `assets/` và gọi bằng đường dẫn `assets/...` (không có `/` ở đầu).
- Tạo mới, theo đúng thứ tự:
  1. `mkdir -p ~/company/video/<id-phiếu> && cd ~/company/video/<id-phiếu>`; cài bản ghim và tạo `./hf` như trên (gói nằm ở thư mục việc, project con dùng chung).
  2. `./hf init <tên-project> --skip-skills` (thêm `--resolution portrait` cho video dọc 9:16, `square` cho 1:1). Mặc định 1920×1080, 30 fps.
  3. `cp hf <tên-project>/hf`.
  4. Từ đây **mọi lệnh bắt đầu bằng** `cd ~/company/video/<id-phiếu>/<tên-project> && ./hf <lệnh>` (mỗi lần gọi shell là một shell mới, thư mục không được giữ).

## Luật dựng (vi phạm thì video sai)

1. Mỗi phần tử có thời gian mang `class="clip"`, `data-start`, `data-duration` (giây), hiện trong `[start, start + duration)`. Trạng thái cuối phải xong trước khi hết thời lượng.
2. Độ dài video là `data-duration` của gốc: dư bị cắt, thiếu thì giữ khung cuối.
3. Mỗi composition dựng **một** timeline dừng sẵn và đăng ký sau khi thêm chuyển động: `window.__timelines["<data-composition-id>"] = tl`.
4. Mọi thứ hiện ra phải tính từ thời gian của timeline: không `Date.now()`, không `Math.random()` không có seed, không gọi mạng, không hẹn giờ, không lặp vô hạn.
5. Không làm chuyển động `display`/`visibility` trên `.clip`, hãy làm trên phần tử con. Chuyển động `transform`, không chuyển động `left/top/width/height`.
6. Không tự `play()`/`pause()`/tua media. Nhạc, giọng đọc là `<audio>` riêng có `id`; `<video>` giữ tiếng thì thêm `data-has-audio="true"`, không thì `muted`.
7. Font: chỉ font đi kèm là gọi được bằng tên; font khác cần `@font-face` trỏ tới file trong `assets/fonts/` (tiếng Việt: chọn font có đủ dấu).
8. Mỗi file cảnh để style, markup, script trong `<template>`, style gốc là `#root`.

Viết chuyển động (tween, timeline, ease, stagger) theo skill `gsap-animation`.

## Giữ cho sửa được

- Mỗi cảnh một composition con, id ngắn dễ đọc; gốc chỉ chứa chỗ gắn cảnh, media và âm thanh.
- Phần tử có thời gian viết thẳng trong HTML (không sinh bằng script), mỗi cái một `id` cố định.
- Chữ, màu thương hiệu, media thay được thì để thành biến (`data-var-text`, `data-var-src`, `var(--id)`).
- Nội dung trong vùng an toàn 90% khung; chữ quan trọng và phụ đề trong 80%.

## Vòng làm việc

1. Viết xong lượt đầu và sau mỗi thay đổi lớn: `./hf lint`.
2. Cổng kiểm: `./hf check --json`, sửa hết lỗi, cân nhắc từng cảnh báo. Còn lỗi lint thì kiểm bố cục và độ tương phản chưa chạy ("0 samples" là chưa kiểm gì).
3. Xem bằng mắt: `./hf snapshot` (thêm `--at <giây,…>` hoặc `--range A,B`), đọc ảnh PNG trong `.hyperframes/artifacts/snapshots/`; nhiều cảnh thì chụp giữa mỗi cảnh. Gửi ảnh cho Kiểm duyệt làm bằng chứng.
4. Xem thử: `./hf preview --background`, kiểm địa chỉ trả 200, báo vào phiếu rồi chờ duyệt. Kiểm xanh chưa phải lý do để xuất.
5. Xuất khi đã được duyệt: `./hf render --quality draft -o out/<tên>.mp4` khi đang sửa, `--quality delivery` cho bản cuối. Không ghi đè bản đã giao: tên mới `-v2`, `-v3`.
6. Kiểm file: `ffprobe -v error -show_entries format=duration:stream=codec_name,width,height out/<tên>.mp4` — khác rỗng, thời lượng khớp `data-duration` của gốc, đúng khổ; xem vài khung đã giải mã. Ghi kết quả vào phiếu.

Sửa dòng thời gian bằng `timeline --json` (xem) và `timeline move|trim|split|set … --plan --json` (xem trước) rồi chạy lại không có `--plan`; mỗi lần sửa in một biên nhận, `timeline undo <biên-nhận>` để hoàn tác.

## Khi lỗi

| Hiện tượng | Cách xử lý |
| --- | --- |
| Thiếu Chrome hoặc không mở được | `browser ensure`; `doctor --json` (xem `.ok`, lệnh luôn thoát 0) |
| Trang nặng chưa sẵn sàng kịp | Tăng `--timeout` của `check` hoặc `snapshot` |
| Xuất chậm trên Linux | Bình thường khi không có GPU; xuất `draft` khi đang sửa |
| Đầy đĩa | `clean --dry-run` rồi `clean`; không xoá `.hyperframes` (giữ lịch sử) |

## Chọn HyperFrames hay Remotion

Xem luật chọn trong `phong-video/SKILL.md`. Chuyển project Remotion sang HyperFrames: viết lại từng cảnh theo luật dựng ở trên, không chạy công cụ chuyển đổi tự động.
