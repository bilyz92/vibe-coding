---
name: nextjs-server-action-security
description: Review an toàn cho Next.js Server Action — mỗi action tự kiểm auth/authz (không dựa page/middleware), validate MỌI input bằng Zod, coi action như endpoint public thù địch. Dùng khi viết/sửa server action ("use server"), review PR đụng actions.ts, hoặc trước khi ship mutation mới.
---

# Next.js Server Action Security

Rào an toàn cho Server Action (`"use server"`). Trên HRM, actions.ts chứa nhiều mutation (đơn từ, chấm công, KPI...) — mỗi action là một **endpoint POST public**: ai cũng gọi được nếu không tự bảo vệ. Bổ trợ [[vibesec]] (skill này soi riêng tầng server action).

## When to Use

- Viết/sửa hàm `"use server"` (server action).
- Review PR đụng `*/actions.ts` hoặc thêm mutation.
- Trước khi ship tính năng có thao tác ghi dữ liệu.

## Nguyên tắc gốc

Server Action = **API public, coi như thù địch**. UI ẩn nút / check ở client / check ở page hay middleware đều KHÔNG phải hàng rào bảo mật (middleware bị bypass được — CVE-2025-29927). Mọi kiểm tra phải nằm TRONG action.

## Process (mỗi bước có cách verify)

1. **Auth trong từng action** → mỗi action tự xác thực người dùng (vd `getCurrentEmployee`/`requireUser`), không dựa việc "page đã bảo vệ". Verify: dòng đầu action có check danh tính, thiếu → chặn.
2. **Authz đúng đối tượng** → kiểm quyền trên TÀI NGUYÊN cụ thể (user này được sửa bản ghi này không?), không chỉ "đã đăng nhập". HRM: dùng `canActOnEmployee`/`getLiveRole`/scope. Verify: có kiểm quyền theo resource, không chỉ role chung.
3. **Validate mọi input bằng Zod** → parse toàn bộ field từ FormData/tham số bằng schema; từ chối nếu fail. Client validation chỉ là UX. Verify: có `schema.safeParse`, không đọc thẳng `formData.get` rồi dùng.
4. **Không tin ID từ client** → id bản ghi nhận từ client phải kiểm chủ sở hữu/scope trước khi thao tác. Verify: query có ràng buộc `where` theo quyền, không `update({ where: { id } })` trần.
5. **Chỉ trả về dữ liệu cần** → không leak field nhạy cảm trong giá trị trả về của action. Verify: `select` field cụ thể, không trả nguyên bản ghi.
6. **Audit thao tác ghi** → mutation quan trọng ghi `audit(...)` (HRM có sẵn). Verify: có dấu vết ai làm gì.

## Rationalizations — các cớ cần phản bác

| Cái cớ | Phản bác |
|--------|----------|
| "Page đã check đăng nhập rồi" | Auth ở page KHÔNG phủ tới action bên trong; action là endpoint riêng, phải tự check. |
| "Nút này chỉ admin thấy" | Ẩn UI không chặn được HTTP request thô; phải check quyền trong action. |
| "Client đã validate form" | Attacker gửi request thô bỏ qua client; validate lại bằng Zod trong action. |
| "Middleware chặn rồi" | Middleware không phải hàng rào bảo mật (bypass được — CVE-2025-29927); check trong action. |
| "Nhận id từ form cho nhanh" | id client là input thù địch; phải ràng buộc quyền/sở hữu trước khi thao tác. |

## Red Flags — dừng lại

- Action `"use server"` không có check danh tính ở đầu.
- Chỉ kiểm "đã đăng nhập", không kiểm quyền trên resource cụ thể.
- Đọc `formData.get(...)` dùng thẳng, không qua Zod.
- `update/delete({ where: { id } })` với id từ client, không ràng buộc scope/owner.
- Dựa vào ẩn UI / page / middleware làm lớp bảo vệ.
- Mutation nhạy cảm không có audit.

## Verification checklist

- [ ] Mỗi action tự check danh tính (không dựa page/middleware).
- [ ] Kiểm quyền theo TÀI NGUYÊN cụ thể, không chỉ role chung.
- [ ] Mọi input qua Zod `safeParse`, từ chối khi fail.
- [ ] ID/tham số từ client được ràng buộc scope/owner trước khi thao tác.
- [ ] Giá trị trả về không leak field nhạy cảm (`select` cụ thể).
- [ ] Mutation quan trọng có `audit(...)`.
