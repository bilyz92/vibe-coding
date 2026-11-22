---
name: content-seo
description: SEO content operating system for softwareengineer.vn style sites. Use when planning, writing, refreshing, auditing, or scaling article clusters; when standardizing content production workflows; when adding internal links, visual specs, alt text, featured-image prompts, in-content image prompts, social asset angles, growth plans, or definition-of-done rules for content teams/pipelines.
---

# Content SEO

Dùng skill này để đóng gói toàn bộ workflow content thành một hệ vận hành thống nhất.

## Core rule
Mỗi bài content không chỉ là text. Mặc định phải nghĩ theo asset stack:
- SEO article
- featured/source-backed thumbnail
- in-content images
- alt text + source record
- internal links
- social asset angle
- refresh path

## softwareengineer.vn strategic publishing rule
Áp dụng mặc định cho `softwareengineer.vn` trừ khi user đổi chiến lược:
- Cadence tự nhiên: **2 bài publish/ngày + 1 draft/ngày**, không publish 2 bài cùng một thời điểm.
- Tách block: 1 bài sớm/morning, 1 bài afternoon/evening, 1 draft ở block riêng.
- Chất lượng ưu tiên hơn số lượng; không quay lại automation cũ kiểu 3 bài generic/ngày.
- Nội dung phải deep technical cho IT professionals, không beginner glossary/template mỏng.
- Không tự tạo sub-agent để viết bài cho workstream này nếu user không yêu cầu; làm trực tiếp hoặc hỏi khi thật sự block.
- Chỉ publish/live sync khi user yêu cầu rõ trong việc đang làm; mặc định chỉ làm bản nháp.
- Nếu publish job bị `[blocked]`, lỗi credential/API/image/validation, hoặc article chưa live đúng kỳ vọng: **báo trực tiếp ở current user channel ngay**, không chỉ rely vào cron announce/Telegram/isolated delivery.
- Không đưa thao tác live-site destructive như delete/unpublish/ẩn bài khỏi site live vào workflow mặc định. Khi có bài sai, mặc định chỉ dừng nguồn gây lỗi, audit, báo cáo rõ post IDs/slugs và chờ chỉ đạo cụ thể của user cho từng hành động live-site.

## Image/source rule for softwareengineer.vn
- Featured/thumbnail phải ưu tiên **nguồn chính thống hoặc source-backed**: official vendor docs/blog/press kit, OWASP/PostgreSQL/etc., docs screenshot, official/open-license asset, hoặc ảnh tự chụp/tự dựng có nguồn dữ liệu rõ.
- AI/custom diagram chỉ dùng khi không có nguồn phù hợp hoặc cần giải thích riêng; nếu dùng phải nói rõ là custom diagram và không gọi là official.
- Không dùng thumbnail generic, stock vô nghĩa, `picsum.photos`, old placeholder, live SVG/WebP/ActiveStorage redirect cho article image.
- Static public JPG vẫn là target triển khai; nên <50KB khi feasible.
- Mỗi ảnh sourced phải có source record: source URL, owner/vendor, license/permission, date accessed, transformations, attribution nếu cần.
- Trước khi publish phải verify live image URL `200`, context-fit, file size, alt text, và không broken links.

## Workflow chuẩn
1. Khóa cluster, intent và cadence block trước khi viết/publish.
2. Viết bài theo search intent, không kéo dài máy móc.
3. Tối ưu title/meta/canonical/internal links.
4. Source/chuẩn hóa visual trước: featured + in-content images + source record (lưu cục bộ).
5. Dừng ở bản nháp và báo user. Bước 6-8 chỉ làm khi user yêu cầu publish rõ trong việc đang làm:
6. Upload static images rồi verify live URLs trước khi gọi API publish.
7. Publish/live sync bằng credential/context mà user chỉ định cho site đó; không tự tìm token, không assume isolated cron có token.
8. Verify bài live: article URL 200, homepage/listing, canonical/meta, images, sitemap khi cần; đưa vào tracking/refresh queue và ghi log nếu có incident.

## Definition of done
Bản nháp xong khi có đủ các mục dưới đây trừ những mục ghi "(publish)"; các mục "(publish)" chỉ áp dụng khi user đã yêu cầu publish:
- intent rõ
- content đủ chiều sâu
- title/meta/canonical/on-page
- internal links
- featured/source-backed image (publish: đã live)
- in-content images nếu dùng (publish: đã live)
- alt text + source record
- social asset angle
- (publish) publish/log/commit
- (publish) verification evidence: article URL 200 + homepage/listing hoặc API/sitemap check phù hợp

## Files cần đọc khi dùng skill
- `references/content-operating-system-template.md` để quản lý cluster, status, refresh priority, tracking status
- `references/content-visual-production-standard.md` để áp dụng image intent, visual style guide, alt text standard, asset layer
- `references/content-definition-of-done-checklist.md` để kiểm bài đã đủ chuẩn chưa
- `references/softwareengineer-vn-30-day-growth-plan.md` khi cần định hướng tăng traffic 30 ngày
- `references/software-engineer-featured-image-prompts.md` khi cần mẫu visual spec cụ thể cho cluster software engineer
- `references/legacy-content-visual-backfill.md` khi cần backfill visual spec cho bài cũ
- `references/website-project-template.md` để khởi tạo project cho từng website riêng
- `references/site-profile-template.md` để tạo hồ sơ chiến lược riêng cho từng site
- `references/execution-scoreboard-template.md` để điều phối nhiều website/cluster/batch cùng lúc
- `references/project-master-plan-template.md` để tạo plan tổng thể cho từng website/dự án riêng
- `references/search-console-weekly-review-template.md` để review Search Console hàng tuần theo cùng một format

## Quy tắc vận hành
- Không mở rộng cluster mới nếu cluster cũ còn pillar yếu mà chưa có lý do rõ.
- Không publish hàng loạt bài mới mà bỏ qua refresh các bài đang có tiềm năng.
- Không coi visual là phần optional.
- Khi thiếu tracking, ưu tiên fix nền đo lường trước các quyết định tối ưu sâu.

## Khi nào nên dùng ngay
- Khi user muốn “đóng gói toàn bộ content workflow thành chuẩn chung”.
- Khi cần tạo hoặc cải tiến content pipeline cho site SEO.
- Khi cần mở cluster mới theo batch 5.
- Khi cần đồng bộ content + visual + asset + refresh strategy trong một hệ.
