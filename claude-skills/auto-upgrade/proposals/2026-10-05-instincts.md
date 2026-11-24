# Đề xuất: thêm cơ chế "instincts" cho auto-upgrade

**Ngày:** 2026-10-05 · **Trạng thái:** ĐỀ XUẤT, chưa áp dụng · **Nguồn ý tưởng:** ECC `continuous-learning-v2` (affaan-m/ECC, MIT)

## 1. Hiện trạng

- `auto-upgrade` học từ **tin tức bên ngoài** (WebSearch 3-5 truy vấn/tuần) → đổi tối đa 1 skill/lần.
- Nó **không học từ chính cách bạn làm việc**: những lần bạn sửa lưng Claude, những quy ước lặp lại giữa các dự án.
- Đang **tắt** trên máy này: file `auto-upgrade/DISABLED` có từ 2026-07-02, log từ đó chỉ ghi "bỏ qua". Việc backlog "Consolidate discipline-skills" vẫn PENDING.
- Trong khi đó Claude Code đã tự ghi **44 memory** trong `~/.claude/projects/*/memory/`, **14 cái là `type: feedback`** (lời sửa/xác nhận của bạn kèm lý do). Đây chính là "observation" có sẵn, đã được chắt lọc — chưa ai dùng nó để nâng cấp skill.

## 2. Ý tưởng lấy từ ECC (và cái KHÔNG lấy)

| Lấy | Không lấy |
|---|---|
| **Instinct** = 1 hành vi nguyên tử: 1 trigger → 1 action, có bằng chứng | Hook PreToolUse/PostToolUse ghi lại MỌI tool call (chậm, phình dữ liệu, dễ dính secret) |
| **Điểm tin cậy** 0.3–0.9, tăng khi lặp lại, giảm khi bị sửa/lâu không thấy | Agent Haiku chạy nền liên tục (tốn token, khó kiểm soát) |
| **Phạm vi**: project vs global; lên global khi thấy ở ≥2 dự án | Tự "evolve" thành agent/command mà không người duyệt |
| **Thăng cấp** instinct mạnh → sửa skill | |

Điểm khác cốt lõi: **nguồn quan sát là memory feedback có sẵn**, không cần cài hook mới. Chạy trong vòng cron hàng tuần như hiện tại.

## 3. Thiết kế đề xuất

### 3.1 Dữ liệu

```
auto-upgrade/instincts/
  global/<id>.md
  projects/<project-slug>/<id>.md      # gitignore — xem §5
```

Mỗi instinct một file (giảm xung đột git khi 2 máy cùng ghi):

```markdown
---
id: codex-review-before-commit
trigger: "sắp commit thay đổi code"
action: "đề xuất/chạy /codex-impl-review trước"
confidence: 0.7
scope: global            # project | global
project_count: 2
first_seen: 2026-09-05
last_seen: 2026-10-01
target_skill: dev-workflow   # skill sẽ nhận thay đổi nếu thăng cấp
---
## Evidence
- 2026-09-05 dự án Next.js/Prisma: memory feedback_codex_review_before_commit (feedback)
- 2026-10-01 dự án Rails: memory codex_review_before_commit (feedback)
```

> Ví dụ trên là **dữ liệu thật** trên máy này: cùng một feedback xuất hiện độc lập ở 2 dự án → đúng loại instinct nên lên `global`.

### 3.2 Nguồn quan sát (chỉ ĐỌC, theo thứ tự ưu tiên)

1. `~/.claude/projects/*/memory/*.md` có `type: feedback` — tín hiệu mạnh nhất.
2. Git log repo skills: commit `Revert`/sửa tay sau một commit `[auto-upgrade]` → tín hiệu **âm** cho thay đổi đó.
3. (Tuỳ chọn, giai đoạn sau) transcript `~/.claude/projects/*/*.jsonl` 7 ngày gần nhất, chỉ quét tin nhắn user có dấu hiệu sửa lưng ("không phải", "sai rồi", "đừng", "sao lại"...). Giới hạn số phiên để khỏi tốn token.

### 3.3 Quy tắc điểm

| Sự kiện | Điểm |
|---|---|
| Tạo mới từ 1 memory feedback | 0.5 |
| Thêm bằng chứng độc lập (phiên/dự án khác) | +0.1 (tối đa 0.9) |
| Memory ghi **rõ con số** user lặp lại lời dặn ≥3 lần ("nhiều lần" chung chung không tính) | +0.1 thêm, mỗi memory 1 lần (thêm 2026-10-05) |
| User sửa ngược / revert thay đổi sinh từ instinct | −0.2 |
| 60 ngày không thấy lại | −0.1 mỗi 60 ngày |
| < 0.3 | chuyển `archived/`, không xoá |

### 3.4 Thăng cấp (vẫn tuân "1 thay đổi/lần")

- **project → global**: cùng id ở ≥2 dự án và điểm TB ≥ 0.7.
- **global → sửa skill**: điểm ≥ 0.8 → thành **ứng viên**. Mỗi vòng chọn **1** ứng viên điểm cao nhất, sửa surgical `target_skill` (append 1 dòng vào Process/Red Flags), commit `[auto-upgrade] v<N>: instinct <id>`. Nếu cần gỡ/gộp skill → chỉ ghi đề xuất, chờ duyệt (giữ nguyên luật hiện tại).
- Không có ứng viên → quay về nhánh cũ: quét tin tức như hiện nay.

### 3.5 Thay đổi vào `auto-upgrade/SKILL.md` (khi được duyệt)

- Bước 1.5 mới: **Cập nhật instincts** từ nguồn §3.2 → ghi/sửa file instinct.
- Bước 3: ưu tiên ứng viên instinct trước, tin tức sau.
- Report thêm mục: instinct mới / tăng / giảm / thăng cấp.
- `run.sh`: không cần thêm quyền — `Read` đã đọc được `~/.claude/projects`, mọi ghi vẫn chỉ trong `~/.claude/skills` (HARD CONSTRAINT #1 giữ nguyên).

## 4. Lộ trình

1. **Quyết định bật lại** auto-upgrade (vì sao tắt từ 07-02?) — cần bạn trả lời.
2. **Chạy tay, chế độ chỉ-ghi-instinct** 2-3 tuần: tạo/cập nhật instinct + report, **không sửa skill**. Bạn đọc xem instinct có đúng ý không.
3. Cho phép thăng cấp → sửa skill (1/lần), như §3.4.
4. (Tuỳ) bật nguồn transcript §3.2.3 nếu memory feedback chưa đủ.

## 5. Rủi ro & cách chặn

| Rủi ro | Chặn |
|---|---|
| Lộ tên khách hàng/dự án, đoạn code, secret | Instinct chỉ ghi **mẫu hành vi trừu tượng**, không trích code/secret. `instincts/projects/` vào `.gitignore`; chỉ `global/` được commit. Lưu ý: repo skills đã từng được chép lên GitHub **public** (`bilyz92/vibe-coding/claude-skills`). |
| Học sai từ 1 lần sửa lẻ | Ngưỡng 0.8 mới thăng cấp ≈ cần ≥4 bằng chứng độc lập. |
| Skill phình dần | Mỗi thăng cấp chỉ 1 dòng; chạy `/context-budget` sau mỗi 5 lần thăng cấp. |
| Hai máy cùng ghi | 1 file/instinct + `git pull --rebase` trước khi ghi (đã có trong bước 8). |
| Trùng với memory | Memory = per-project, Claude đọc khi làm việc; instinct = tổng hợp xuyên dự án để **sửa skill**. Không chép memory sang, chỉ trỏ tới làm bằng chứng. |

## 6. Cần bạn quyết

- [ ] Bật lại auto-upgrade không? Có lý do gì khi tắt hồi 07-02?
- [ ] Đồng ý chỉ commit `instincts/global/`, còn `projects/` để local?
- [ ] Bắt đầu giai đoạn 2 (chỉ-ghi-instinct) bằng một lần chạy tay?
