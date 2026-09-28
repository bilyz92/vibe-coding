---
name: dev-workflow
description: Quy trình làm việc chuẩn của một dev cho mọi thay đổi code — nhận task, làm rõ, plan, code tối giản & surgical, viết/chạy test, verify bằng bằng chứng (lint/typecheck/build/test), rồi mới commit. Dùng khi bắt đầu một task code mới, sửa bug, hoặc khi cần một checklist kỷ luật trước khi nói "đã xong".
---

# Dev Workflow — quy trình chuẩn của một dev

Đóng gói vòng lặp làm việc kỷ luật để giảm lỗi LLM thường gặp: làm thừa, sửa lan man, nhận "xong" mà không có bằng chứng. Bổ trợ cho [[karpathy-guidelines]] và phần "Engineering discipline" trong CLAUDE.md project.

## When to Use

- Bắt đầu bất kỳ task code nào (feature, sửa bug, refactor).
- Trước khi commit / mở PR.
- Khi định nói "đã sửa xong" — chạy qua checklist Verification trước.

KHÔNG cần dùng cho: câu hỏi thuần lý thuyết, đọc/giải thích code, thao tác không sinh diff.

## Process

1. **Làm rõ trước khi code** → verify: nêu rõ giả định; nếu có nhiều cách hiểu, hỏi thay vì chọn im lặng. Nếu có cách đơn giản hơn, đề xuất.
2. **Định nghĩa success criteria** → verify: viết tiêu chí kiểm chứng được. "Thêm validation" → "viết test cho input sai, làm cho pass". "Sửa bug" → "viết test tái hiện lỗi (fail trước), làm cho pass".
3. **Rà soát phạm vi ảnh hưởng (impact sweep)** → trước khi sửa, tìm MỌI nơi dùng logic/symbol/chuỗi sẽ đổi (grep toàn repo, không chỉ file đang mở). Liệt kê từng call-site + màn hình/route dùng nó, và phân biệt cái GIỐNG tên nhưng KHÁC nghĩa (đừng sửa nhầm). Verify: có danh sách đầy đủ nơi phải đổi đồng bộ; xác nhận không có bản sao logic ở client/nơi khác. → tránh "sửa chỗ nọ, chỗ khác không update theo".
4. **Plan ngắn cho task nhiều bước** → verify: liệt kê các bước kèm cách kiểm tra từng bước.
5. **Code tối giản & surgical** → verify: mỗi dòng đổi truy được về yêu cầu; sửa ĐỒNG BỘ mọi call-site ở bước 3; không "cải thiện" code lân cận; khớp style hiện có; không thêm abstraction/flexibility không được yêu cầu. Chất lượng code (tên/hàm/trùng lặp/pattern đúng chỗ) → áp [[clean-code]].
6. **Viết test cùng lúc với code** → verify: bug fix có test tái hiện (fail trước khi sửa, pass sau). Không "viết test sau".
7. **Verify bằng bằng chứng** → verify: chạy lint + typecheck + build + test liên quan, dán output thật. Một việc chỉ "xong" khi có bằng chứng cụ thể.
8. **Dọn orphan của chính mình** → verify: gỡ import/biến/hàm mà thay đổi của bạn làm thừa; KHÔNG xoá dead code có sẵn (chỉ nhắc).
9. **Review diff trong ngữ cảnh sạch** → trước khi nói "xong", cho một subagent/lần đọc độc lập xem `git diff` + success criteria (chỉ thấy diff và tiêu chí, không thấy lý lẽ tạo ra nó). Verify: không còn lỗi/thiếu sót; cần sâu hơn → [[codex-impl-review]].
10. **Commit khi được yêu cầu** → verify: message rõ ràng, theo convention repo; nếu đang ở branch mặc định thì tạo branch trước.

## Rationalizations — các cớ cần phản bác

| Cái cớ | Phản bác |
|--------|----------|
| "Viết test sau" | Sẽ không viết; test viết sau chỉ kiểm chứng code đã có, không phải hành vi mong muốn. |
| "Cái này đơn giản, khỏi test" | Code đơn giản rồi sẽ phức tạp; test là tài liệu hành vi. |
| "Đã test tay rồi" | Test tay không bền; thay đổi ngày mai không kích hoạt lại. |
| "Tiện tay refactor luôn" | Mở rộng phạm vi ngoài yêu cầu; tăng rủi ro, khó review. |
| "Build chắc pass thôi" | Không có output = chưa verify. Chạy đi. |
| "Thêm option cho linh hoạt" | YAGNI; chỉ code đúng cái được yêu cầu. |

## Red Flags — dừng lại

- Ship code không có test tương ứng.
- Test pass ngay lần đầu (chưa chứng minh nó thật sự fail được).
- Bug fix thiếu test tái hiện.
- Test bị skip/disable để "cho qua".
- Sửa 1 nơi dùng logic mà chưa grep xem còn nơi nào khác dùng nó (nguy cơ sót màn hình).
- Diff chạm vào file/dòng không liên quan tới yêu cầu.
- Nói "đã xong" mà không có output test/build/typecheck.

## Verification checklist

- [ ] Giả định đã nêu rõ; chỗ mơ hồ đã hỏi.
- [ ] Có success criteria kiểm chứng được.
- [ ] Bug fix: có test fail-trước/pass-sau.
- [ ] Lint sạch — có output.
- [ ] Typecheck/build pass — có output.
- [ ] Test liên quan pass — có output.
- [ ] Đã grep toàn repo tìm MỌI nơi dùng logic sẽ đổi; sửa đồng bộ, không sót màn hình/call-site.
- [ ] Trước commit code: đã áp [[clean-code]] lên diff + đề xuất chỗ dọn (tên/hàm/trùng lặp/pattern đúng chỗ).
- [ ] Diff chỉ gồm thay đổi cần thiết; không refactor lan man.
- [ ] Orphan do mình tạo đã dọn.
- [ ] Đã review diff trong ngữ cảnh sạch (subagent/đọc độc lập) trước khi "xong".
