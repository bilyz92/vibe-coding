---
name: ui-ux-review
description: Quy trình DUYỆT UI/UX cho một màn hình/component trước khi coi là xong — chạy thật để xem (không chỉ đọc code), rồi soát theo 7 lens: deslop baseline, accessibility, trạng thái (loading/empty/error), responsive, nhất quán design-system, metadata, và verify bằng bằng chứng (screenshot). Dùng khi review UI mới/đổi, đặc biệt UI do AI sinh ra, trước khi merge.
---

# UI/UX Review — cổng duyệt giao diện

Duyệt một thay đổi UI đi qua đủ các lens, kết luận bằng bằng chứng thật (không chỉ đọc code). Gom các lens sẵn có ([[baseline-ui]], [[fixing-accessibility]], [[fixing-metadata]]) + kỷ luật verification của HRM. Sinh thiết kế mới thì dùng [[ui-ux-pro-max]] trước, rồi duyệt bằng skill này.

## When to Use

- Review một màn hình/component mới hoặc vừa sửa, trước khi merge.
- Đặc biệt sau khi vibe-code UI (AI sinh) — dễ "slop".

Chỉ cần dọn nhanh 1 file → gọi thẳng `/baseline-ui <file>`. Đây là cổng đầy đủ hơn.

## Process (mỗi bước có cách verify)

1. **Xác định phạm vi + chạy THẬT** → liệt kê màn hình/component đổi; mở app xem tận mắt (browser/screenshot), không chỉ đọc code. Verify: có ảnh/nhìn thấy trạng thái thật.
2. **Deslop baseline** → áp [[baseline-ui]]: spacing/hierarchy/typography/layout, `cn`/CVA, dùng `components/ui` sẵn có. Verify: liệt kê vi phạm + cách sửa.
3. **Accessibility** → áp [[fixing-accessibility]]: keyboard/focus, aria-label cho icon-button, contrast, lỗi form đặt cạnh field, dialog focus-trap. Verify: tab thử được qua các control.
4. **Trạng thái đầy đủ** → loading (skeleton có cấu trúc), empty (một hành động kế tiếp rõ ràng), error (cạnh nơi hành động), disabled/pending. Verify: xem được cả 3-4 trạng thái, không chỉ happy path.
5. **Responsive & dày dữ liệu** → mobile↔desktop; `h-dvh` (không `h-screen`); bảng/hàng dài có `overflow`/`truncate`/`line-clamp`; `tabular-nums` cho số (bảng công/KPI). Verify: thu hẹp cửa sổ không vỡ layout.
6. **Nhất quán design-system** → dùng token màu/theme + primitive sẵn có; không tự chế primitive; ≤1 màu nhấn/view; shadow/gradient theo baseline. Verify: không có màu/spacing "lạc" khỏi hệ.
7. **Metadata (nếu là page mới)** → áp [[fixing-metadata]]: title/description/canonical/OG. Verify: tab trình duyệt + share preview đúng.
8. **Kết luận có phân mức** → xuất finding chia **MUST-fix / SHOULD / nice**, mỗi cái kèm vị trí (file:dòng) + cách sửa cụ thể. Cần review đối kháng sâu → [[codex-impl-review]].

## Rationalizations — các cớ cần phản bác

| Cái cớ | Phản bác |
|--------|----------|
| "Đọc code là đủ, khỏi chạy" | UI phải NHÌN mới thấy vỡ; nhiều lỗi (overflow, contrast, empty state) không lộ khi đọc code. |
| "Happy path chạy ok là xong" | Loading/empty/error mới là chỗ UX hay hỏng; phải xem đủ trạng thái. |
| "A11y để sau" | Form/dialog thiếu keyboard/focus là lỗi chặn người dùng thật, không phải "nice-to-have". |
| "Tự viết component cho nhanh" | Lệch design-system; dùng `components/ui` sẵn có trước. |
| "Mobile tính sau" | HRM dùng trên nhiều thiết bị; bảng dày vỡ mobile là lỗi thấy ngay. |

## Red Flags — dừng lại

- Kết luận "UI ổn" mà chưa chạy/chưa xem ảnh thật.
- Chỉ kiểm happy path, bỏ loading/empty/error.
- Icon-button không `aria-label`; dialog không focus-trap.
- Màu/spacing/shadow tự chế ngoài token hệ thống.
- Bảng/nội dung dài không xử lý overflow → vỡ layout.

## Verification checklist

- [ ] Đã chạy app & xem/chụp màn hình thật (không chỉ đọc code).
- [ ] Deslop baseline ([[baseline-ui]]) — có danh sách vi phạm + sửa.
- [ ] Accessibility ([[fixing-accessibility]]) — tab/keyboard/focus/contrast ok.
- [ ] Đủ trạng thái: loading / empty (có next action) / error (cạnh hành động).
- [ ] Responsive: mobile↔desktop không vỡ; `h-dvh`; overflow/truncate; `tabular-nums`.
- [ ] Nhất quán design-system: token màu, primitive sẵn có, ≤1 màu nhấn/view.
- [ ] (Page mới) Metadata đúng ([[fixing-metadata]]).
- [ ] Finding chia MUST/SHOULD/nice, kèm vị trí + cách sửa.
