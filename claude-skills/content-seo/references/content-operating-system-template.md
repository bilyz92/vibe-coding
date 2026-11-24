# Content Operating System Template

Áp dụng cho `softwareengineer.vn` và các cluster mở rộng sau này.

## 1. Mục tiêu của hệ thống
Biến website từ nơi đăng bài rời rạc thành một content engine có thể:
- mở rộng cluster có kiểm soát
- theo dõi trạng thái từng bài
- chuẩn hóa visual layer
- refresh bài cũ đúng ưu tiên
- tái sử dụng bài viết thành social/video assets
- hỗ trợ quyết định tăng traffic bằng dữ liệu

## 2. Các lớp quản lý chính
Mỗi bài nên được theo dõi qua các lớp sau:

1. **Cluster**
   - software engineer
   - backend developer
   - frontend developer
   - full stack developer
   - devops
   - ...

2. **Intent**
   - definition
   - process / roadmap
   - comparison
   - checklist / skills
   - outcome / salary / jobs
   - context / daily work

3. **Content status**
   - idea
   - briefed
   - drafted
   - reviewed
   - visual-ready
   - published
   - refreshed

4. **Live status**
   - local only
   - ready to publish
   - live
   - live but outdated

5. **Visual status**
   - no visual spec
   - featured only
   - full visual spec
   - visuals generated
   - visuals uploaded

6. **Refresh priority**
   - P1: pillar / high-value / high-potential
   - P2: supporting / medium opportunity
   - P3: low urgency / minor support content

7. **Tracking status**
   - no data yet
   - has impressions
   - has clicks
   - CTR weak
   - needs refresh
   - performing well

## 3. Core content record cho mỗi bài
Mỗi bài nên có record tối thiểu gồm:
- Title
- Slug
- Primary keyword
- Secondary keywords
- Cluster
- Intent
- Parent/pillar article
- Related supporting articles
- Category
- Content status
- Live status
- Visual status
- Refresh priority
- Last updated date
- Internal link status
- Visual asset status
- Social asset status
- Notes / next action

## 4. Flow vận hành chuẩn
### Flow A. New article production
1. chọn cluster
2. khóa intent
3. viết brief
4. draft bài
5. tối ưu title/meta
6. thêm internal links
7. làm visual spec
8. publish/live sync
9. lưu outbox/commit
10. đưa vào tracking queue

### Flow B. Refresh existing article
1. check bài có nằm trong P1/P2 không
2. xem vấn đề chính là gì
   - thin content
   - overlap intent
   - CTR thấp
   - thiếu visual
   - outdated info
3. update bài
4. update visual spec nếu thiếu
5. sync live
6. ghi log refresh

### Flow C. Repurpose/distribution
1. chọn bài có tiềm năng
2. trích social angle
3. tạo post ngắn / carousel / short video prompt
4. distribute ra channel phù hợp
5. theo dõi phản hồi / traffic support

## 5. Weekly operating cadence
### Hàng tuần
- review bài mới publish
- review bài có impression nhưng CTR thấp
- chọn 1-3 bài refresh ưu tiên
- thêm internal links khi cluster mở rộng
- kiểm tra visual gap

### Hàng tháng
- review performance theo cluster
- xem cluster nào nên mở tiếp
- refresh pillar articles
- rà cannibalization / overlap
- update homepage/category strategy nếu cần

## 6. Ưu tiên decision-making
Khi phải chọn việc tiếp theo, ưu tiên theo thứ tự:
1. technical blockers
2. tracking visibility blockers
3. pillar article quality
4. cluster expansion
5. supporting visuals
6. repurpose/distribution

## 7. Mẫu bảng quản lý đơn giản
```md
| Title | Slug | Cluster | Intent | Status | Live | Visual | Priority | Next Action |
|---|---|---|---|---|---|---|---|---|
| Software Engineer là gì | software-engineer-la-gi | software engineer | definition | published | live | full visual spec | P1 | monitor + refresh when needed |
| Backend Developer là gì | backend-developer-la-gi | backend developer | definition | briefed | local only | pending | P1 | draft article |
```

## 8. Rule vận hành
- Không viết bài mới nếu intent chưa khóa rõ.
- Không coi bài là xong nếu chưa có internal link và visual spec.
- Không mở cluster mới quá rộng khi cluster hiện tại còn pillar yếu.
- Mỗi batch mới cần đi kèm kế hoạch refresh bài cũ.
- Ưu tiên authority theo cluster trước, breadth sau.
