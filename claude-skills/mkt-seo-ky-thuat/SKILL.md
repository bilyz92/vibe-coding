---
name: mkt-seo-ky-thuat
description: "Kiểm tra SEO kỹ thuật cho một website (crawl/index, tốc độ, cấu trúc URL, canonical, schema, meta, hreflang) chỉ dựa trên trang công khai anh chỉ định, kèm checklist và mẫu báo cáo; site tiếng Việt và tiếng Anh. Dùng khi anh nói \"audit SEO\", \"SEO kỹ thuật\", \"tại sao Google không index\", \"kiểm tra robots.txt / sitemap\", \"technical SEO audit\", \"site crawl\", \"canonical\", \"Core Web Vitals\". Sửa meta/OG chuyển sang skill fixing-metadata."
---

# SEO kỹ thuật: audit và báo cáo

Mục tiêu: tìm lỗi khiến Google không crawl, không index hoặc hiểu sai trang; xếp ưu tiên; đưa bản sửa cụ thể. Chỉ đọc, không sửa site, không gửi gì ra ngoài.

## Phạm vi và an toàn

- Chỉ audit site của anh, hoặc trang công khai anh chỉ rõ. Không quét hàng loạt, không vượt đăng nhập, không bỏ qua robots.txt của site người khác.
- Với site của người khác: chỉ mở vài URL tiêu biểu (trang chủ, 1 trang dịch vụ, 1 bài blog), không crawl sâu.
- Lệnh `curl` dưới đây chỉ dùng cho site của anh. Đưa lệnh cho anh chạy hoặc chạy khi anh cho phép; không dán token hay cookie vào lệnh.

## Bước 0: chốt đầu vào

- [ ] URL gốc, ngôn ngữ (vi / en / cả hai), loại site (tĩnh, Next.js, WordPress...).
- [ ] Mục tiêu: lên top cho nhóm từ nào, trang nào quan trọng nhất (trang dịch vụ, liên hệ).
- [ ] Anh có Search Console / PageSpeed số liệu thật không. Nếu không, ghi rõ "chưa có dữ liệu thật", không đoán thứ hạng hay lượng truy cập.
- [ ] Loại của từng trang sẽ kiểm (bảng dưới). Ghi loại vào báo cáo. Một site có thể có nhiều loại trang; xếp loại theo trang, không theo cả site.

### Nhận loại trang trước khi kiểm

Mọi loại vẫn chạy đủ checklist 1–4. Bảng này chỉ nói kiểm kỹ thêm chỗ nào và schema nào hợp. Không chắc loại thì ghi "chưa rõ loại" và chạy checklist chung.

| Loại trang | Dấu hiệu | Kiểm kỹ thêm |
| --- | --- | --- |
| Dịch vụ / công ty (agency, SaaS) | Trang dịch vụ, bảng giá, nút liên hệ hoặc dùng thử | Mỗi dịch vụ một trang riêng có link nội bộ; title nêu đúng dịch vụ; schema `Organization`, `Service` hoặc `ProfessionalService` |
| Doanh nghiệp địa phương (nha khoa, văn phòng luật, cửa hàng) | Địa chỉ, giờ mở cửa, bản đồ, số điện thoại | Tên, địa chỉ, số điện thoại của mỗi cơ sở giống hệt nhau ở trang của cơ sở đó, schema và hồ sơ Google (mỗi chi nhánh có địa chỉ, số riêng đúng với nó); trang riêng cho mỗi chi nhánh; schema `LocalBusiness` khớp nội dung hiển thị; hồ sơ Google Business do anh hoặc khách tự kiểm |
| Bán hàng (shop, Shopify, WooCommerce) | Giỏ hàng, trang sản phẩm, danh mục | Trang lọc, sắp xếp, biến thể không sinh hàng loạt bản trùng (canonical); hàng hết không thành soft 404; schema `Product` với giá, tình trạng hàng đúng như trên trang |
| Blog / tin | Bài có ngày đăng, tác giả, chuyên mục | Ngày đăng và cập nhật đúng; có tên tác giả; phân trang và trang thẻ không trùng; schema `Article`; bài cũ không mồ côi |

## Checklist 1: crawl và index

```bash
curl -sI https://example.com/            # mã trạng thái, redirect, header
curl -sI -L https://example.com/trang    # theo redirect, đếm số bước nhảy
curl -s https://example.com/robots.txt   # có chặn nhầm thư mục không
curl -s https://example.com/sitemap.xml | head -50
curl -sI -A "Googlebot" https://example.com/   # so sánh với user-agent thường
```

- [ ] Trang chính trả `200`; không chuỗi redirect quá 1 bước; HTTP chuyển sang HTTPS bằng `301`.
- [ ] Chỉ một phiên bản canonical của host (www hay không www), phiên bản kia `301` về.
- [ ] robots.txt không `Disallow: /` nhầm và không chặn CSS/JS cần để render.
- [ ] robots.txt có dòng `Sitemap:`; sitemap chỉ chứa URL `200`, canonical, cho phép index.
- [ ] Header `X-Robots-Tag` và thẻ `meta robots` không có `noindex` ngoài ý muốn (hay gặp sau khi chuyển từ staging).
- [ ] Trang 404 thật sự trả `404`, không phải `200` (soft 404).
- [ ] Trang quan trọng nằm trong 3 click từ trang chủ, có link nội bộ trỏ tới, không phải trang mồ côi.

## Checklist 2: cấu trúc và nội dung trang

- [ ] URL ngắn, chữ thường, dấu gạch ngang. Tiếng Việt: slug không dấu (`dich-vu-ai-agent`), không để `%C3%A1` trong URL.
- [ ] Mỗi trang một `<title>` riêng (khoảng 50-60 ký tự), một `<h1>`, thứ bậc h2/h3 hợp lý.
- [ ] Mỗi trang có `<link rel="canonical">` tự trỏ về chính nó (hoặc về bản gốc nếu trùng nội dung).
- [ ] Trang phân trang, lọc, tham số `?utm_` không sinh ra hàng loạt bản trùng.
- [ ] Site hai ngôn ngữ: `hreflang` có đủ cặp hai chiều (`vi`, `en`, `x-default`), `<html lang>` đúng, bản dịch không canonical về nhau.
- [ ] Ảnh có `alt` mô tả thật (vi hoặc en đúng ngôn ngữ trang), định dạng hiện đại, có width/height.
- [ ] Link nội bộ dùng anchor text có nghĩa, không "bấm vào đây"; không link gãy (4xx).

## Checklist 3: tốc độ và trải nghiệm

Dùng số đo thật (PageSpeed Insights, Lighthouse trong Chrome, báo cáo Core Web Vitals trong Search Console) do anh cung cấp; không tự bịa điểm.

- [ ] LCP dưới 2,5 s, INP dưới 200 ms, CLS dưới 0,1 (ngưỡng "tốt" Google công bố; anh kiểm lại trên tài liệu hiện hành).
- [ ] Ảnh hero được ưu tiên tải, không lazy-load ảnh đầu trang.
- [ ] Font có `font-display: swap`, JS không chặn render, bật nén (`curl -sI -H "Accept-Encoding: gzip, br"` xem `content-encoding`).
- [ ] Cache header hợp lý cho file tĩnh (`cache-control`).
- [ ] Hiển thị tốt trên mobile (viewport meta, chữ đọc được, nút không dính nhau).
- [ ] Nội dung chính có trong HTML trả về lần đầu hay chỉ sinh ra bằng JS (so `curl -s URL` với trang trên trình duyệt).

## Checklist 4: dữ liệu có cấu trúc

- [ ] JSON-LD hợp lệ, khớp nội dung hiển thị: `Organization`, `WebSite`, `Service` hoặc `ProfessionalService`, `Article`, `BreadcrumbList`, `FAQPage` (chỉ khi trang thật sự có phần hỏi đáp).
- [ ] Không gắn `AggregateRating` hay `Review` nếu không có đánh giá thật hiển thị trên trang.
- [ ] Kiểm bằng Rich Results Test của Google (anh tự mở); không khẳng định "sẽ có rich result".

## Kiểm nhanh ngay sau khi đăng một trang mới

Dùng khi phòng Marketing vừa đăng một trang/bài mới (không cần audit cả site). Chạy trên URL thật (production) ngay sau khi đăng, không chạy trên staging (staging đúng chuẩn có `noindex`, sẽ báo trượt sai). Đây là cổng trước khi báo "xong": ghi kết quả vào phiếu việc; còn mục bắt buộc nào hỏng thì chưa báo "xong". Bị 403 hoặc Cloudflare chặn curl thì kiểm bằng trình duyệt (xem nguồn trang) và ghi rõ.

```bash
U=https://example.com/trang-moi
SITE=https://example.com
# 1. Mã trạng thái, redirect, X-Robots-Tag: dùng GET (bỏ thân trang), không dùng HEAD (-I) vì server/CDN có thể trả HEAD khác GET
curl -sSL -o /dev/null -D - -w '\nfinal=%{url_effective} status=%{http_code} redirects=%{num_redirects}\n' "$U" | grep -iE '^HTTP|^location|^x-robots-tag|^final='
# 2. title, h1, canonical, robots/googlebot, og
curl -sL "$U" | grep -ioE '<title[^>]*>[^<]*|<h1[ >]|<link[^>]*canonical[^>]*>|<meta[^>]*(robots|googlebot)[^>]*>|<meta[^>]*og:(title|image)[^>]*>'
# 3. robots.txt: in đủ cả file (giữ các nhóm User-agent), không lọc riêng dòng Disallow
curl -sL "$SITE/robots.txt"
# 4. Sitemap: lấy URL ở dòng "Sitemap:" trong robots.txt; nếu là sitemap index (<sitemapindex>) thì làm tiếp với từng sitemap con.
#    In các <loc> (đã bỏ khoảng trắng) có chứa slug, rồi so với $U (có/không dấu / cuối, ký tự mã hóa &amp; hay %xx)
curl -sL "<url-sitemap>" | tr -d ' \t\r\n' | grep -oE '<loc>[^<]*</loc>' | grep -F 'trang-moi'
#    Sitemap nén .gz: giải nén TRƯỚC khi lọc
curl -sL "<url-sitemap>.gz" | gunzip | tr -d ' \t\r\n' | grep -oE '<loc>[^<]*</loc>' | grep -F 'trang-moi'
# 5. Link nội bộ từ một trang đã index (vd trang chủ hoặc trang danh mục) trỏ tới slug mới
curl -sL "$SITE/" | grep -c 'href="[^"]*trang-moi'
# 6. Nội dung có sẵn trong HTML: grep một câu trong thân bài
curl -sL "$U" | grep -c "một câu trong thân bài"
```

Bắt buộc:
- [ ] Kết thúc ở `200`, tối đa 1 bước redirect; không `noindex` trong meta (`robots`/`googlebot`) lẫn header `X-Robots-Tag`.
- [ ] robots.txt không chặn trang mới với Googlebot: xét nhóm `User-agent` áp cho Googlebot (gộp mọi nhóm `Googlebot` nếu có, khi đó bỏ qua nhóm `*`; không có thì dùng nhóm `*`), so `Disallow`/`Allow` theo tiền tố và ký tự `*`, `$` (luật khớp dài nhất thắng; dài bằng nhau thì `Allow` thắng), không so chữ y hệt. Không chắc thì kiểm bằng Search Console (Kiểm tra URL) và ghi rõ.
- [ ] Có `<title>`, khớp từ khóa hoặc ý định tìm kiếm của trang; slug không dấu.
- [ ] `canonical` trỏ về chính URL này.
- [ ] Đã có trong sitemap (hoặc ghi rõ "sitemap tự cập nhật sau N giờ", kiểm lại sau).
- [ ] Có ít nhất 1 link nội bộ từ trang đã index trỏ tới.
- [ ] Nội dung chính có trong HTML trả về, không chỉ sinh bằng JS.

Nên có:
- [ ] Một `<h1>` rõ ràng.
- [ ] `og:title`, `og:image` (khi dán link lên Facebook/Zalo hiện đúng tiêu đề và ảnh); thiếu thì sửa bằng skill `fixing-metadata`.

Đạt phần bắt buộc thì anh tự gửi URL trong Search Console (Kiểm tra URL → Yêu cầu lập chỉ mục); skill không gọi API index thay anh. Không hứa ngày được index. Bước này chỉ chặn lỗi kỹ thuật, không tự sinh traffic.

## Phân loại mức độ

| Mức | Ví dụ | Hành động |
| --- | --- | --- |
| Nghiêm trọng | `noindex` nhầm, robots chặn cả site, trang chính 5xx, canonical sai | Sửa ngay |
| Cao | Chuỗi redirect, trùng nội dung, thiếu sitemap, LCP rất chậm | Trong tuần |
| Trung bình | Title trùng, thiếu alt, thiếu schema | Trong tháng |
| Thấp | Slug dài, thiếu `x-default` | Khi tiện |

## Mẫu báo cáo (lưu `docs/seo-audit-<site>-<ngày>.md` nếu anh cần file)

1. Tóm tắt 5 dòng: tình trạng chung, 3 việc làm trước.
2. Phạm vi: URL đã kiểm, loại trang, ngày, công cụ, dữ liệu nào là đo thật, dữ liệu nào chưa có.
3. Bảng phát hiện, mỗi lỗi một dòng: mức, URL, bằng chứng (lệnh + kết quả rút gọn), **vì sao quan trọng** (một câu: lỗi này làm Google không crawl, không index, hiểu sai trang, hay làm người dùng bỏ đi), cách sửa, **cách biết đã sửa xong** (lệnh hoặc bước kiểm lại và kết quả phải thấy, vd `curl ... | grep -i x-robots-tag` không còn `noindex`), công sức ước lượng (S/M/L). Lỗi chỉ kiểm được bằng công cụ của anh (Search Console, PageSpeed) thì ghi rõ bước anh tự làm.
4. Việc nên làm tiếp: chạy lại đúng cột "cách biết đã sửa xong"; dòng nào chưa đạt thì chưa đóng.

## Chuyển giao

- Lỗi title, description, Open Graph, Twitter card, favicon, JSON-LD, canonical trong HTML: dùng skill `fixing-metadata` để sửa; báo cáo này chỉ nêu phát hiện và mức ưu tiên.
- Nội dung bài cần viết lại theo từ khóa: skill `mkt-viet-bai-seo`.

## Luật

- Việc ra bên ngoài (đăng, gửi cho người khác, tiêu tiền, gọi dịch vụ trả phí, tạo tài khoản) luôn chờ anh duyệt.
- Không bịa số liệu, khách hàng hay lời khen.
- Không hứa thứ hạng hay thời gian lên top; SEO không có bảo đảm.
