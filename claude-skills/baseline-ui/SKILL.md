---
name: baseline-ui
description: Nhanh chóng "deslop" code UI — sửa spacing, hierarchy, typography, và các lỗi layout nhỏ. Dùng khi giao diện cần dọn/polish nhanh, đặc biệt UI do AI sinh ra. Đã chỉnh stack cho HRM (Tailwind v4 + shadcn/Radix + cn/CVA, không dùng JS animation lib).
---

# Baseline UI

Áp một baseline UI có chủ kiến để chống "slop" giao diện AI sinh ra. (Nguồn: ibelick/ui-skills, đã chỉnh stack cho HRM.)

## How to use

- `/baseline-ui` — áp các ràng buộc dưới đây cho mọi việc UI trong hội thoại.
- `/baseline-ui <file>` — review file theo các ràng buộc, xuất: vi phạm (trích đúng dòng) + vì sao (1 câu) + cách sửa cụ thể (code).

## Stack (HRM)

- MUST dùng Tailwind CSS mặc định trừ khi đã có custom hoặc được yêu cầu rõ.
- MUST dùng util `cn` (`clsx` + `tailwind-merge`) cho class logic.
- SHOULD dùng `class-variance-authority` (CVA) cho biến thể component (đúng pattern shadcn hiện có).
- HRM KHÔNG dùng JS animation lib (không có motion/react, tw-animate-css). Cần animation → dùng CSS/Tailwind transition; tuân mục Animation bên dưới.

## Components

- MUST dùng primitive có sẵn của dự án TRƯỚC (`src/components/ui/*` — shadcn trên Radix).
- MUST dùng primitive accessible cho mọi thứ có keyboard/focus (dự án dùng **Radix**).
- NEVER trộn nhiều hệ primitive trong cùng một bề mặt tương tác.
- MUST thêm `aria-label` cho button chỉ có icon.
- NEVER tự dựng lại keyboard/focus bằng tay trừ khi được yêu cầu rõ.

## Interaction

- MUST dùng `AlertDialog` cho hành động phá huỷ/không hoàn tác được.
- SHOULD dùng skeleton có cấu trúc cho trạng thái loading.
- NEVER dùng `h-screen`, dùng `h-dvh`.
- MUST tôn trọng `safe-area-inset` cho phần tử fixed.
- MUST hiện lỗi ngay cạnh nơi hành động xảy ra.
- NEVER chặn paste trong `input`/`textarea`.

## Animation

- NEVER thêm animation trừ khi được yêu cầu rõ.
- MUST chỉ animate prop compositor (`transform`, `opacity`).
- NEVER animate layout (`width`, `height`, `top`, `left`, `margin`, `padding`).
- SHOULD tránh animate paint (`background`, `color`) trừ UI nhỏ cục bộ (text, icon).
- SHOULD dùng `ease-out` khi vào; NEVER quá `200ms` cho feedback tương tác.
- SHOULD tôn trọng `prefers-reduced-motion`.
- NEVER dùng easing tuỳ biến trừ khi được yêu cầu.

## Typography

- MUST dùng `text-balance` cho heading, `text-pretty` cho body/đoạn văn.
- MUST dùng `tabular-nums` cho dữ liệu số (bảng công/KPI...).
- SHOULD dùng `truncate` / `line-clamp` cho UI dày.
- NEVER đổi `letter-spacing` (`tracking-*`) trừ khi được yêu cầu.

## Layout

- MUST dùng thang `z-index` cố định (không `z-*` tuỳ tiện).
- SHOULD dùng `size-*` cho phần tử vuông thay vì `w-*` + `h-*`.

## Performance

- NEVER animate `blur()` / `backdrop-filter` diện lớn.
- NEVER đặt `will-change` ngoài lúc đang animate.
- NEVER dùng `useEffect` cho thứ có thể biểu diễn bằng render logic.

## Design

- NEVER dùng gradient trừ khi được yêu cầu; NEVER gradient tím/đa màu.
- NEVER dùng glow làm affordance chính.
- SHOULD dùng thang shadow mặc định của Tailwind trừ khi được yêu cầu.
- MUST cho empty state một hành động kế tiếp rõ ràng.
- SHOULD giới hạn 1 màu nhấn mỗi view.
- SHOULD dùng token màu theme/Tailwind sẵn có trước khi thêm màu mới.
