# Content Visual Production Standard

Áp dụng cho mọi bài content SEO từ nay về sau trên site.

## Mục tiêu
- Mỗi bài không chỉ có text tốt mà còn có lớp visual hỗ trợ đọc, tăng CTR, tăng time on page, và tăng khả năng tái sử dụng content.
- Ảnh phải phục vụ intent của bài, không chỉ để lấp chỗ trống.
- Toàn site cần có phong cách hình ảnh đồng bộ để tạo cảm giác chuyên nghiệp và đáng tin cậy.

## 1. Visual asset layer mặc định cho mỗi bài
Mỗi bài mới mặc định nên có đủ các lớp sau:

1. **Featured image**
   - 1 ảnh cover chính của bài
   - dùng cho listing page, social preview, share preview, đầu bài viết

2. **In-content images**
   - 2-4 ảnh trong bài tùy độ dài và độ phức tạp
   - dùng để giải thích, minh họa, so sánh, chia nhịp đọc

3. **Alt text cho từng ảnh**
   - mô tả sát nội dung ảnh
   - có ích cho accessibility và image SEO

4. **Social asset / repurpose angle**
   - ít nhất 1 angle để tái dùng cho social snippet, carousel, short video, hoặc motion cover

## 2. Image intent, bắt buộc phải xác định trước khi viết prompt
Mỗi ảnh phải thuộc một trong các intent sau:

- **Definition intent**: minh họa bản chất khái niệm/nghề/chủ đề
- **Process intent**: minh họa quy trình, lộ trình, các bước thực hiện
- **Comparison intent**: minh họa khác biệt giữa hai vai trò/lựa chọn/công nghệ
- **Checklist intent**: trực quan hóa danh sách kỹ năng, lỗi sai, tiêu chí đánh giá
- **Outcome intent**: thể hiện kết quả, cơ hội nghề nghiệp, tăng trưởng, thành quả
- **Context intent**: tạo bối cảnh nghề nghiệp/thực tế công việc để bài bớt khô

Quy tắc:
- Mỗi ảnh phải gắn rõ 1 intent chính.
- Không tạo ảnh “đẹp cho có”.
- Nếu không trả lời được ảnh này giúp người đọc hiểu gì hơn, ảnh đó không nên có.

## 3. Sitewide visual style guide
### 3.1. Style tổng thể
- Hiện đại, sạch, chuyên nghiệp, thiên về tech editorial
- Ưu tiên realistic-digital hybrid hoặc editorial illustration sạch
- Không quá hoạt hình
- Không quá stock-photo giả
- Không lạm dụng icon rời rạc

### 3.2. Màu sắc ưu tiên
- Navy
- Indigo
- Cyan
- White
- Accent tím nhạt nếu cần

### 3.3. Composition
- 1 chủ thể chính + 2-3 yếu tố phụ
- Nền sạch, có chiều sâu nhẹ
- Có thể dùng dashboard, code editor, architecture blocks, timeline, comparison panels tùy bài
- Tránh nhồi quá nhiều chữ trực tiếp trong ảnh

### 3.4. Typography trong ảnh
- Tốt nhất không dùng text overlay dài
- Nếu dùng text overlay, chỉ dùng cực ngắn như:
  - Roadmap 2026
  - Salary 2026
  - Backend vs Frontend
  - Interview Questions

### 3.5. Tỉ lệ khuyến nghị
- Featured image: 16:9
- In-content image: 16:9 hoặc 4:3 tùy layout site
- Social card/carousel có thể tách riêng sau

### 3.6. Negative prompt mặc định
- no watermark
- no blurry text
- no distorted hands
- no cheap stock photo look
- no childish cartoon
- no excessive clutter
- no unreadable UI text
- no random logos

## 4. Quy tắc chèn ảnh trong content
### 4.1. Số lượng gợi ý
- Bài ngắn (<1200 từ): 1-2 ảnh trong content
- Bài trung bình (1200-1800 từ): 2-3 ảnh trong content
- Bài dài (>1800 từ): 3-4 ảnh trong content

### 4.2. Vị trí ưu tiên
1. Sau phần mở đầu, nếu cần tạo bối cảnh
2. Ở section giải thích chính của bài
3. Ở section checklist / roadmap / comparison / process
4. Gần phần kết hoặc CTA nếu có visual hỗ trợ quyết định

### 4.3. Section nên ưu tiên ảnh
- lộ trình học
- quy trình xin việc
- checklist kỹ năng
- sai lầm thường gặp
- so sánh nghề nghiệp
- mốc lương/career progression

## 5. Alt text standard
### 5.1. Mục tiêu
- mô tả ảnh đúng và ngắn gọn
- hỗ trợ accessibility
- hỗ trợ image SEO tự nhiên

### 5.2. Quy tắc viết alt text
- mô tả điều chính đang diễn ra trong ảnh
- nếu ảnh minh họa một khái niệm nghề nghiệp, nói rõ khái niệm đó
- không nhồi keyword máy móc
- dài khoảng 8-20 từ là hợp lý

### 5.3. Ví dụ
- "Minh họa software engineer làm việc với code và sơ đồ hệ thống"
- "Lộ trình học backend developer với các mốc kỹ năng chính"
- "So sánh trực quan giữa backend developer và frontend developer"
- "Checklist kỹ năng cần có để trở thành software engineer"

## 6. Workflow chuẩn cho mỗi bài mới
Mỗi bài mới nên có các phần sau:

1. Title + slug + keyword intent
2. Meta title + meta description
3. Content body
4. Internal links
5. Featured image prompt
6. In-content image plan
   - vị trí chèn ảnh
   - image intent của từng ảnh
   - prompt sơ bộ
7. Alt text draft cho từng ảnh
8. Social asset angle
   - post ngắn
   - carousel idea
   - short video/motion prompt angle

## 7. Mẫu output visual spec cho một bài
```md
## Visual spec

### Featured image
- Intent: Definition / Process / Comparison / Checklist / Outcome / Context
- Prompt: ...
- Alt text: ...

### In-content image 1
- Vị trí chèn: sau H2 ...
- Intent: ...
- Mục đích: ...
- Prompt: ...
- Alt text: ...

### In-content image 2
- Vị trí chèn: sau H2 ...
- Intent: ...
- Mục đích: ...
- Prompt: ...
- Alt text: ...

### Social asset angle
- Carousel idea: ...
- Short post angle: ...
- Video prompt angle: ...
```

## 8. Rule vận hành từ nay
- Mọi bài mới mặc định phải có visual spec.
- Prompt ảnh phải đi kèm content, không làm sau cho có.
- Nếu bài đã publish mà chưa có visual spec, ưu tiên bổ sung khi refresh/update.
- Giữ cùng một style hệ thống để toàn site đồng bộ.
- Với batch content mới, visual layer là một phần của definition of done.
## 9. Sourced image rule: không bắt buộc phải tự tạo ảnh

Ảnh cho bài SEO không nhất thiết phải do AI/manual tạo ra. Có thể dùng ảnh có sẵn trên mạng nếu nguồn cho phép và đúng ngữ cảnh. Ưu tiên:

1. Ảnh/sơ đồ từ nguồn chính thức: hãng, vendor docs, engineering blog, press kit, GitHub/project docs.
2. Ảnh open-license/permissive: CC0, public domain, CC BY có attribution đầy đủ.
3. Ảnh/sơ đồ cộng đồng chia sẻ khi license hoặc quyền reuse rõ ràng.
4. Screenshot tự chụp từ tài liệu/product/public UI khi phù hợp và không lộ dữ liệu riêng tư.

Không dùng ảnh random từ Google/Pinterest/blog cá nhân nếu không rõ quyền. Nếu license mơ hồ, hãy tạo diagram riêng hoặc chỉ link nguồn thay vì rehost.

Mỗi ảnh sourced cần lưu source record trong draft/log:

```md
- File: ...
- Source URL: ...
- Owner/vendor: ...
- License/permission: ...
- Required attribution: ...
- Date accessed: YYYY-MM-DD
- Transformations: resized/compressed/cropped/annotated
```

Nếu attribution là bắt buộc, chèn vào figcaption hoặc source note gần ảnh.

Với softwareengineer.vn vẫn giữ chuẩn kỹ thuật: static JPG public URL, ưu tiên <50KB, alt text hữu ích, ảnh đúng intent bài viết, tránh ActiveStorage/WebP/SVG trực tiếp khi có rủi ro render.

Khi cần workflow chi tiết về tìm/download/validate ảnh bên thứ ba, dùng skill `content-image-sourcing`.

