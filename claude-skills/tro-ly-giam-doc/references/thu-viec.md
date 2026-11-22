# Phòng thử việc

> Phần chi tiết của skill `tro-ly-giam-doc` (SKILL.md chỉ giữ tóm tắt). `T=~/.claude/skills/tro-ly-giam-doc/scripts`.

- Phòng mới có `status: "probation"`. Kết quả của phòng dừng ở `chờ anh nhận`.
- Anh **nhận** thì đặt phiếu sang `xong` và chạy `node $T/departments.mjs outcome <phòng> nhan`.
- Anh **trả lại** thì chạy `… outcome <phòng> tra-lai` và đặt phiếu về `đang làm` kèm góp ý của anh.
- `readyToGraduate` (anh đã nhận 3 việc): đề xuất cho phòng ra khỏi thử việc, tức đổi `status` sang `active` trong `department.json` sau khi anh "ok".
- `flagged` (bị trả lại 2 lần liên tiếp): báo anh và đề xuất sửa phòng.
