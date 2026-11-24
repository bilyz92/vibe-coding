---
name: gsap-animation
description: Viết chuyển động bằng GSAP cho video (HyperFrames) và trang tĩnh — tween, timeline, vị trí trên dòng thời gian, ease, stagger, tiện ích gsap.utils, và luật để video xuất ra giống hệt mỗi lần. Dùng khi phòng Video dựng cảnh bằng hyperframes-create, hoặc khi cần chuyển động GSAP trong một trang.
---

# Chuyển động bằng GSAP

Nguồn ý tưởng: greensock/gsap-skills @aed9cfd (`gsap-core`, `gsap-timeline`, `gsap-performance`, `gsap-utils`, MIT), viết lại cho My Company và cho video. GSAP là thư viện chuyển động JavaScript; HyperFrames tua dòng thời gian GSAP từng khung để xuất video.

## Luật cho video (HyperFrames)

Video phải ra giống hệt mỗi lần xuất, nên:

- Mỗi composition dựng **một** `gsap.timeline({ paused: true })` và đăng ký nó (xem `hyperframes-create`). Không tự `play()`; HyperFrames tua.
- Không `repeat: -1`. Muốn lặp thì đặt số lần cụ thể sao cho vừa thời lượng cảnh.
- Không `gsap.utils.random`, `shuffle`, chuỗi `"random(...)"`, `Math.random()` hay `Date.now()`: mỗi lần xuất ra một kiểu. Cần "ngẫu nhiên" thì viết sẵn danh sách giá trị cố định, hoặc tính từ chỉ số phần tử.
- Không dùng ScrollTrigger, Draggable, `gsap.matchMedia()`, `gsap.quickTo()`: chúng chạy theo người xem (cuộn, chuột, khổ màn hình) hay theo thời gian thật, không theo dòng thời gian của video.
- Không chuyển động `autoAlpha`, `display`, `visibility` trên phần tử `.clip`; làm trên phần tử con. Mờ dần dùng `opacity` trên phần tử con.
- Chỉ dùng phần lõi của GSAP (gsap, timeline, gsap.utils, ease có sẵn). Không dùng plugin (CustomEase, MorphSVG, SplitText, ScrollTrigger…) trong video. Cần plugin thì mở phiếu riêng để kiểm giấy phép và sửa skill này trước khi dùng.

## Tween

- `gsap.to(đích, { … })`: từ trạng thái hiện tại tới giá trị đích. Dùng nhiều nhất.
- `gsap.from(đích, { … })`: từ giá trị cho trước về trạng thái hiện tại; hợp cho phần tử xuất hiện.
- `gsap.fromTo(đích, { từ }, { tới })`: ghi rõ cả hai đầu; an toàn nhất cho video vì không phụ thuộc trạng thái đọc lúc chạy.
- `gsap.set(đích, { … })`: đặt ngay, không có thời lượng.

Tên thuộc tính viết kiểu camelCase (`backgroundColor`, `fontSize`). Các tham số hay dùng: `duration` (giây, mặc định 0.5), `delay`, `ease`, `stagger`.

Hai `from()`/`fromTo()` cùng đích, cùng thuộc tính trên một timeline: thêm `immediateRender: false` cho cái sau, nếu không cái sau ghi đè trạng thái đầu của cái trước và cảnh đầu bị sai.

## Biến hình và hiệu năng

- Di chuyển, phóng to, xoay bằng bí danh biến hình: `x`, `y` (px), `xPercent`, `yPercent`, `scale`, `scaleX`, `scaleY`, `rotation` (độ), `rotationX`, `rotationY`, `skewX`, `skewY`, `transformOrigin`. Không chuyển động `left`, `top`, `width`, `height`, `margin`, `padding` (gây tính lại bố cục, video giật và xuất chậm).
- Không viết chuỗi `transform` thô trên phần tử mà GSAP đang biến hình.
- Giá trị tương đối: `x: "+=40"`, `rotation: "-=15"`.
- Xoay theo chiều: `rotation: "180_cw"` (theo chiều kim), `"_ccw"`, `"_short"` (đường ngắn nhất).
- SVG xoay quanh một điểm chung: `svgOrigin: "200 120"` (không dùng cùng `transformOrigin`).
- Biến CSS chuyển động được: `"--muc-sang": 1.2`.
- Nhiều phần tử cùng một chuyển động: dùng `stagger` thay vì nhiều tween có `delay` tay.

## Ease

Dùng ease có sẵn, đặt bằng chuỗi: `"none"` (đều), `"power1.out"` (mặc định), `"power2.inOut"`, `"power3.out"`, `"back.out(1.7)"` (vượt rồi về), `"elastic.out(1, 0.3)"`, `"expo.out"`, `"sine.inOut"`. Họ ease: `power1`–`power4` (số càng lớn càng gắt), `back`, `bounce`, `circ`, `elastic`, `expo`, `sine`; mỗi họ có `.in`, `.out`, `.inOut`.

Gợi ý cho video: vào cảnh `power3.out` hoặc `expo.out`; ra cảnh `power2.in`; chuyển giữa hai trạng thái `power2.inOut`; chữ nảy nhẹ `back.out(1.4)`. Không dùng tên ease tự bịa.

## Stagger

- `stagger: 0.08`: mỗi phần tử bắt đầu sau phần tử trước 0.08 giây.
- `stagger: { each: 0.08, from: "center" }` hoặc `{ amount: 0.6, from: "end" }`. `from`: `"start"`, `"center"`, `"end"`, `"edges"`, hoặc chỉ số. Không dùng `from: "random"` trong video.

## Timeline

```javascript
const tl = gsap.timeline({ paused: true, defaults: { duration: 0.6, ease: "power3.out" } });
tl.addLabel("vao", 0)
  .fromTo("#tieu-de", { y: 60, opacity: 0 }, { y: 0, opacity: 1 }, "vao")
  .fromTo(".dong-phu", { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1 }, "<0.25")
  .addLabel("ra", 3.2)
  .to("#khung", { scale: 0.95, opacity: 0, duration: 0.4, ease: "power2.in" }, "ra");
```

Vị trí (tham số thứ ba):

| Viết | Nghĩa |
| --- | --- |
| `1.5` | đúng giây 1.5 của timeline |
| (bỏ trống, mặc định) | nối vào cuối timeline hiện tại |
| `">"` | khi cái vừa thêm kết thúc (khác với mặc định khi các tween chồng lên nhau) |
| `"<"` | cùng lúc cái vừa thêm bắt đầu |
| `"<0.2"` | 0.2 giây sau khi cái vừa thêm bắt đầu |
| `"+=0.5"` / `"-=0.2"` | 0.5 giây sau / 0.2 giây trước khi timeline hiện tại kết thúc |
| `"nhan"`, `"nhan+=0.3"` | tại nhãn, hoặc lệch so với nhãn |

- Xếp thứ tự bằng timeline và vị trí, không bằng `delay`.
- Đặt `defaults` cho timeline khi nhiều tween dùng chung thời lượng và ease.
- Timeline lồng được: dựng timeline con cho một nhóm phần tử rồi `tl.add(con, "nhan")`.
- Thời lượng timeline là do các tween con quyết định. Tổng thời lượng phải nằm gọn trong thời lượng cảnh của HyperFrames; trạng thái cuối xong trước khi cảnh hết.

## gsap.utils (tiện ích, không ngẫu nhiên)

- `clamp(min, max, v)`: kẹp giá trị trong khoảng.
- `mapRange(a, b, c, d, v)`: đổi từ khoảng a–b sang c–d (vd tiến độ 0–1 sang góc 0–360).
- `normalize(min, max, v)`: đưa về 0–1.
- `interpolate(đầu, cuối, t)`: nội suy số, màu, hay object cùng khoá.
- `snap(bước, v)` hoặc `snap([danh sách], v)`: làm tròn về bước hay giá trị gần nhất.
- `distribute({ base, amount | each, from, grid, ease })`: trả về hàm chia giá trị theo vị trí phần tử (vd cỡ to ở giữa, nhỏ dần ra rìa); `from: "random"` không dùng trong video.
- `toArray(".lop")`: lấy danh sách phần tử.
- Bỏ đối số cuối (giá trị) thì các hàm trên trả về một hàm để dùng lại: `const kep = gsap.utils.clamp(0, 100); kep(140)`.

## Kiểm

Sau khi viết: chạy cổng kiểm và chụp khung theo `hyperframes-create` (`./hf check --json`, `./hf snapshot --at …`). Chụp ở đầu, giữa, cuối mỗi chuyển động để chắc phần tử không nhảy, không bị cắt, và trạng thái cuối đúng.
