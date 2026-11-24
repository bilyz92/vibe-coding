# Họp giao ban giữa các phòng

> Phần chi tiết của skill `tro-ly-giam-doc`. `T=~/.claude/skills/tro-ly-giam-doc/scripts`.

Hai cuộc họp, Trợ lý giám đốc chủ trì. Chương trình do `hop.mjs` dựng từ phiếu việc (không gọi model, không gửi gì), nên họp chỉ tốn công ở chỗ có việc thật.

## Giao ban hằng ngày (06:30, ngắn)

1. `node $T/hop.mjs giao-ban` → file `<companyDir>/hop/<ngày>-giao-ban-chuong-trinh.md`: mỗi phòng có việc thì có bốn dòng: hôm qua xong gì, đang làm gì, vướng gì, chờ phòng nào.
2. Không gọi Lead nào khi phòng chỉ có "xong" và "đang làm" bình thường: chương trình đã đủ.
3. Phòng có "vướng" hoặc "chờ phòng khác": hỏi đúng Lead đó (gọi agent Lead với `phiếu <id>`) hôm nay làm gì, cần phòng nào; vấn đề `need: "trợ lý"` thì xử lý ngay theo mục "Lead báo vấn đề".
4. Viết biên bản `<companyDir>/hop/<ngày>.md`: từng phòng một dòng, các việc giao thêm.

## Họp tuần (thứ Hai 08:00, đủ thành phần)

1. `node $T/hop.mjs tuan` → `<ngày>-tuan-chuong-trinh.md`: việc 7 ngày của từng phòng, báo cáo mới nhất của Ban Cố vấn, Phòng An ninh, Phòng Nhân sự, bản tin học hỏi, và chi phí AI tuần (`chi-phi.mjs tuan`).
2. Thành phần: Lead các phòng có việc trong tuần, `cv-lead` (Ban Cố vấn), `an-lead` (Phòng An ninh), `tc-lead` (Phòng Tài chính – Pháp chế). Mỗi người đọc chương trình và báo cáo của mình, trả: kết quả tuần so với KPI (hồ sơ nhân sự), việc tuần tới, phụ thuộc cần phòng khác.
3. Trợ lý giải phụ thuộc: phiếu nào chờ phiếu nào, phòng nào làm trước (`after`), và việc trùng giữa các phòng.
4. Biên bản `<companyDir>/hop/<ngày>-tuan.md`: quyết định, việc giao (mỗi việc: phòng, mục tiêu, hạn), rủi ro.

## Việc giao sau họp

- Mỗi việc giao thành phiếu: `tickets.mjs create`, `analysis` (mục tiêu, tiêu chí từ biên bản, `questions: []`), rồi `assign` cho đúng phòng, ghi mã phiếu vào biên bản. Không hỏi anh.
- Chỉ trình anh (phiếu sang `chờ anh`, `PushNotification`) khi việc tốn tiền, pháp lý, hay gửi/đăng ra ngoài; ghi các việc đó ở cuối biên bản dưới "Chờ anh".
- Bản tin buổi sáng (`digest.mjs`) đọc biên bản mới nhất nếu có.

## Lịch (đề xuất, chưa cài)

`nhip.mjs` không gọi model nên không chủ trì họp được. Cron chỉ cài khi anh đồng ý; chạy headless cần thêm cờ quyền (`--permission-mode` hoặc `--allowedTools`) do phiên chính chốt khi trình anh:

```
30 6 * * * cd /home/bilyz/project/my-office && /home/bilyz/.local/bin/claude -p "Trợ lý giám đốc: họp giao ban hôm nay theo references/hop-giao-ban.md" >> /home/bilyz/.claude/company/hop/cron.log 2>&1
0 8 * * 1 cd /home/bilyz/project/my-office && /home/bilyz/.local/bin/claude -p "Trợ lý giám đốc: họp tuần theo references/hop-giao-ban.md" >> /home/bilyz/.claude/company/hop/cron.log 2>&1
```

Thư mục `~/.claude/company/hop` phải có trước lần chạy đầu (`hop.mjs` tạo khi chạy tay lần đầu).
