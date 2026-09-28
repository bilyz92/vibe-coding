# Design Patterns — tra khi bước 7 cần (chỉ nạp khi có mùi thật)

Mỗi pattern: **mùi kích hoạt → pattern → khi KHÔNG dùng**. Nguyên tắc: pattern là *phản ứng* với trùng lặp/biến thể ĐANG tồn tại, không áp phòng xa. Ngữ cảnh: Next.js + TS + Prisma (HRM).

## Behavioral (hành vi) — hay gặp nhất

**Strategy** — hoán đổi thuật toán.
- Mùi: `if/switch` theo "loại" lặp ở nhiều nơi, mỗi nhánh một cách tính.
- Dùng: quy tắc tính công theo loại ca (`congFactor`), tính phạt đi muộn theo bậc, prorate phép. Tách mỗi quy tắc thành hàm/đối tượng cùng interface, chọn theo key.
- KHÔNG: chỉ 1-2 nhánh ổn định → cứ để `if`, đừng dựng interface.

**Observer / Pub-Sub** — phát sự kiện, nhiều nơi nghe.
- Mùi: sau một hành động phải gọi tay nhiều việc rời rạc (thông báo, audit, recompute).
- Dùng: HRM đã có (SSE notification bus). Thêm subscriber, đừng nhồi vào chỗ gọi.
- KHÔNG: chỉ 1 người nghe, gọi trực tiếp rõ hơn.

**Command** — đóng gói một thao tác + dữ liệu của nó.
- Mùi: cần undo/redo, hàng đợi, hoặc audit thao tác đồng dạng.
- Dùng: Server Action vốn ~ command (một mutation + input). Giữ mỗi action một việc.

## Structural (cấu trúc)

**Adapter** — bọc API ngoài về interface của mình.
- Mùi: gọi thẳng SDK/DB lạ khắp nơi; đổi nhà cung cấp là sửa loạn.
- Dùng: máy chấm công SQL Server (WiseEyeOn), webhook TopCV, gửi mail. Bọc 1 lớp adapter, phần còn lại phụ thuộc interface mình.
- KHÔNG: gọi 1 chỗ duy nhất, đơn giản → khỏi bọc.

**Facade** — một cửa đơn giản che hệ con phức tạp.
- Mùi: một use-case phải phối hợp nhiều module lằng nhằng, lặp ở nhiều caller.
- Dùng: module `attendance` (compute + recompute + shift) phơi 1 hàm cao cấp cho action gọi.

**Repository** — tách truy cập dữ liệu khỏi logic.
- Mùi: câu Prisma rải khắp component/action, khó test, khó đổi.
- Dùng: gom truy vấn theo domain vào 1 lớp; logic nghiệp vụ gọi repo, không gọi Prisma trực tiếp → test được bằng cách thay repo.
- KHÔNG: query đơn giản 1 chỗ → Prisma trực tiếp vẫn ổn, đừng tạo tầng rỗng.

## Creational (khởi tạo)

**Factory** — tập trung logic tạo khi việc tạo có biến thể.
- Mùi: cùng kiểu `switch` để `new`/dựng object theo loại ở nhiều nơi.
- Dùng: tạo đối tượng "đơn từ" theo type (LATE/EARLY_LEAVE/ATTENDANCE_FIX) nếu việc dựng khác nhau và lặp.
- KHÔNG: tạo thẳng 1-2 chỗ.

**Singleton** — một thể hiện dùng chung.
- Dùng: Prisma client (HRM ĐÃ làm — 1 instance tránh cạn connection). Hiếm khi cần thêm cái mới.
- KHÔNG: lạm dụng làm global state ẩn → khó test.

**Builder** — dựng object/ăn query phức tạp từng bước.
- Mùi: hàm nhận rất nhiều tham số optional; dựng `where` Prisma dài theo điều kiện.
- Dùng: build filter báo cáo công/KPI nhiều tiêu chí.

## React/Next đặc thù

- **Custom hook** = tách logic stateful tái dùng khỏi component (mùi: cùng `useEffect`/state lặp ở nhiều component).
- **Server Action = Command**: mỗi action một mutation, tự validate + auth (xem [[nextjs-server-action-security]]).
- **Service layer**: logic nghiệp vụ ở module thuần (`src/modules/*`), action/route chỉ điều phối — dễ test (HRM đã theo hướng này).

## Tự vấn trước khi thêm pattern

1. Mùi có THẬT và ĐANG tồn tại không (không phải "sau này có thể")?
2. Pattern làm code ĐƠN GIẢN hơn để đọc/sửa/test không, hay chỉ thêm tầng?
3. Có cách nhẹ hơn (tách hàm, đặt tên lại) đạt 80% lợi ích không?
→ Không chắc thì ĐỪNG thêm. Gỡ pattern thừa cũng là clean code.
