---
name: clean-code
description: Lens Clean Code + Design Pattern để nâng chất lượng code lên mức "sản phẩm hoàn chỉnh" — đặt tên rõ, hàm nhỏ một-việc, bỏ trùng lặp, xử lý lỗi tường minh, ranh giới sạch; và áp design pattern ĐÚNG CHỖ (khi có trùng lặp/biến thể thật, không phòng xa). Dùng khi viết/refactor một module, review chất lượng code, hoặc muốn dọn code cho gọn và dễ bảo trì.
---

# Clean Code + Design Patterns

Nâng code từ "chạy được" lên "sản phẩm bảo trì được". KHÔNG mâu thuẫn với nguyên tắc đơn-giản-trước: clean code = **vừa đủ rõ**, pattern = **phản ứng với nhu cầu đang tồn tại**, không phải trang trí. Bổ trợ [[dev-workflow]] (bước code) và [[simplify]].

> **Nguyên tắc tối thượng:** đơn giản thắng "đúng pattern". Chỉ đưa abstraction/pattern vào khi có **bằng chứng nhu cầu** (đã trùng ≥3 lần, hoặc biến thể thật đang tồn tại). Pattern áp phòng xa = over-engineer, bị cấm như code thừa.

## When to Use

- **TỰ ĐỘNG khi ship code (Claude hoặc Codex):** trước mỗi commit code, tự áp lens này lên diff và **chủ động đề xuất** chỗ nên dọn (tên/hàm/trùng lặp/pattern). Có PreToolUse hook nhắc ở `git commit`. Bỏ qua nếu commit chỉ là docs/config.
- Viết/refactor một module đủ lớn để chất lượng quan trọng.
- Review chất lượng (dễ đọc/bảo trì), khác [[code-review]] (tìm bug).
- Thấy code lặp/rối/khó test → cân nhắc pattern.

Task nhỏ 1-file → [[dev-workflow]] là đủ, không cần lens này.

## Process — Clean Code trước, Pattern sau

1. **Tên nói đúng ý định** → biến/hàm/loại đặt theo *cái nó là/làm*, không viết tắt tối nghĩa, không `data`/`tmp`/`handle`. Verify: đọc tên đoán được vai trò, không cần đọc thân.
2. **Hàm nhỏ, một việc** → mỗi hàm một mức trừu tượng, làm đúng một việc; tách khi thấy "và". Tham số ít (≤3, nhiều hơn → gộp object). Verify: mô tả hàm bằng 1 câu không có "và".
3. **Bỏ trùng lặp (DRY) — nhưng đúng lúc** → trùng THẬT ≥2-3 lần mới trừu tượng hoá; đừng gộp hai thứ *tình cờ giống* (sẽ tách đau về sau). Verify: mỗi trừu tượng có ≥2 call-site thật.
4. **Xử lý lỗi tường minh** → không nuốt lỗi, không `catch` rỗng; lỗi nói rõ chuyện gì + cách xử lý; tách nhánh lỗi khỏi luồng chính. Verify: mọi `catch` làm gì đó có nghĩa.
5. **Ranh giới & phụ thuộc sạch** → cô lập I/O (DB, API ngoài, fs) khỏi logic thuần để test được; phụ thuộc hướng vào trong (logic không import tầng ngoài). Verify: logic cốt lõi test được không cần mock cả thế giới.
6. **Comment giải thích "tại sao", không "cái gì"** → code tự nói "cái gì"; comment dành cho lý do/ngữ cảnh/cạm bẫy. Verify: xoá comment mà vẫn hiểu code làm gì.
7. **Cân nhắc Design Pattern (chỉ khi có nhu cầu thật)** → thấy mùi cụ thể (nhiều `if/switch` theo loại, tạo object phức tạp lặp lại, cần hoán đổi thuật toán...) → tra `references/design-patterns.md` chọn pattern hợp + kiểm "nó có đơn giản hoá thật không". Verify: pattern giảm được trùng lặp/độ phức tạp đang CÓ, không thêm tầng cho tương lai giả định.

## Rationalizations — các cớ cần phản bác

| Cái cớ | Phản bác |
|--------|----------|
| "Thêm interface/factory cho linh hoạt sau này" | YAGNI — abstraction phòng xa là nợ, không phải tài sản; thêm khi nhu cầu tới. |
| "Dùng pattern cho pro" | Pattern sai chỗ làm code khó hơn; chuyên nghiệp = đơn giản đúng mức, không phô diễn. |
| "Hai đoạn giống nhau, gộp luôn" | Giống *tình cờ* ≠ cùng lý do thay đổi; gộp sớm tạo coupling sai. Chờ nhu cầu rõ. |
| "Comment nhiều cho dễ hiểu" | Comment mô tả "cái gì" là mùi code chưa đủ rõ; sửa tên/tách hàm trước. |
| "Refactor cả file cho sạch" | Ngoài phạm vi task; giữ surgical (xem [[dev-workflow]]), đề xuất phần khác riêng. |

## Red Flags — dừng lại

- Thêm abstraction/pattern mà chỉ có 1 call-site / cho nhu cầu tương lai giả định.
- Hàm dài làm nhiều việc, tên mơ hồ, tham số bầy đàn.
- `catch` rỗng / nuốt lỗi / lỗi chung chung.
- Logic nghiệp vụ dính chặt I/O → không test được nếu không mock cả hệ.
- Refactor lan ra ngoài phạm vi task để "cho sạch".

## Verification checklist

- [ ] Tên phản ánh ý định; không viết tắt tối nghĩa.
- [ ] Hàm một-việc, tham số gọn.
- [ ] Trùng lặp gộp có ≥2 call-site thật (không gộp tình cờ).
- [ ] Không `catch` rỗng; lỗi tường minh.
- [ ] Logic cốt lõi tách khỏi I/O, test được.
- [ ] Comment nói "tại sao", không "cái gì".
- [ ] Pattern (nếu dùng) giảm độ phức tạp ĐANG CÓ, không phòng xa — đối chiếu `references/design-patterns.md`.
