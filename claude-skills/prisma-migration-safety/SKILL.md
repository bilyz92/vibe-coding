---
name: prisma-migration-safety
description: Kiểm tra an toàn cho Prisma migration TRƯỚC khi merge/deploy — phát hiện thao tác destructive (drop/rename cột-bảng, thêm cột NOT NULL không default), ép migrate deploy (không db push), và pattern multi-step cho thay đổi phá vỡ. Dùng khi tạo/sửa migration, review PR có `prisma/migrations`, hoặc trước khi deploy có bước migrate.
---

# Prisma Migration Safety

Rào an toàn cho migration Prisma trên HRM (deploy qua GitLab CI, entrypoint auto `migrate deploy`). Migration chạy tự động khi deploy → một migration destructive = mất dữ liệu prod. Bổ trợ [[safe-deploy]] (skill này lo riêng tầng schema/migration).

## When to Use

- Vừa tạo/sửa migration (`prisma/migrations/**`).
- Review PR đụng schema hoặc migration.
- Trước khi deploy mà entrypoint sẽ chạy `migrate deploy`.

## Process (mỗi bước có cách verify)

1. **Đọc SQL migration thật** → mở file `migration.sql` mới, KHÔNG chỉ nhìn `schema.prisma`. Verify: đọc từng câu lệnh DDL.
2. **Soi thao tác destructive** → tìm `DROP COLUMN`, `DROP TABLE`, `RENAME`, đổi kiểu thu hẹp, `ADD COLUMN ... NOT NULL` không `DEFAULT`. Verify: mỗi cái destructive phải có lý do + kế hoạch dữ liệu cũ.
3. **Cột NOT NULL mới → dùng pattern an toàn** → hoặc (a) nullable, hoặc (b) có `DEFAULT`, hoặc (c) multi-step: thêm nullable → backfill → set NOT NULL ở migration sau. Verify: không có `NOT NULL` trần trên bảng đang có dữ liệu.
4. **Rename/drop → multi-step (expand→migrate→contract)** → thêm cái mới, chuyển dữ liệu, xoá cái cũ ở lần deploy sau; không drop-and-recreate 1 nhịp. Verify: dữ liệu cũ được bảo toàn qua từng bước.
5. **Lệnh đúng môi trường** → dev: `prisma migrate dev`; prod: `prisma migrate deploy`. NEVER `db push`/`migrate reset` trên prod (drop dữ liệu). Verify: entrypoint/CI dùng `migrate deploy`.
6. **Không sửa migration đã applied** → cần đổi → tạo migration MỚI. Verify: file migration cũ không bị chỉnh.
7. **Trước deploy prod** → test migration trên bản COPY dữ liệu prod (staging); có backup/PITR về mốc trước migration. Verify: đã chạy thử trên dữ liệu thật, có đường lùi.

## Rationalizations — các cớ cần phản bác

| Cái cớ | Phản bác |
|--------|----------|
| "Bảng còn ít data, drop cho nhanh" | Prod khác local; drop là mất, không lùi được nếu thiếu backup. |
| "Thêm NOT NULL luôn cho gọn" | Migrate sẽ fail hoặc chèn rác trên hàng cũ; dùng nullable/default/multi-step. |
| "Sửa lại file migration cũ tí thôi" | Migration đã applied mà sửa → lệch checksum, hỏng lịch sử; tạo cái mới. |
| "db push nhanh hơn migrate" | `db push` bỏ qua migration history + có thể drop cột; cấm trên prod. |
| "Local chạy ok là được" | Vấn đề nằm ở DỮ LIỆU CŨ prod, unit test không bắt; phải test trên copy prod. |

## Red Flags — dừng lại

- `DROP COLUMN`/`DROP TABLE`/`RENAME` mà không có kế hoạch dữ liệu + backup.
- `ADD COLUMN ... NOT NULL` không `DEFAULT` trên bảng có dữ liệu.
- Deploy sẽ auto `migrate deploy` nhưng migration chưa test trên copy prod.
- Sửa file migration đã applied.
- Dùng `db push`/`migrate reset` ở môi trường có dữ liệu thật.

## Verification checklist

- [ ] Đã đọc SQL migration thật (không chỉ schema.prisma).
- [ ] Không có thao tác destructive thiếu kế hoạch dữ liệu + backup.
- [ ] Cột NOT NULL mới: nullable / có default / multi-step.
- [ ] Rename/drop theo expand→migrate→contract.
- [ ] Prod dùng `migrate deploy`; không `db push`/`reset`.
- [ ] Không sửa migration đã applied.
- [ ] Đã test trên copy dữ liệu prod + có backup/PITR trước khi deploy.
