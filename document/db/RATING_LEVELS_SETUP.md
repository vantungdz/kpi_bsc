# Khung điểm đánh giá (GM) — Hướng dẫn chạy SQL

Tài liệu share cho team: file SQL nào, thứ tự chạy.

> **File duy nhất:** [`V6__rating_levels_setup.sql`](./V6__rating_levels_setup.sql)  
> (schema migration + seed dữ liệu mẫu)

---

## Thứ tự chạy (database mới)

| # | File | Bắt buộc |
|---|------|----------|
| 1 | `init-db.sql` | Có |
| 2 | `V3__sample_data.sql` | Tuỳ chọn (user, `kpi_cycles` 2025/2026, KPI mẫu) |
| 3 | `V4__admin_module.sql` | Nếu dùng module Admin |
| 4 | `V5__score_direct_encryption_no_new_columns.sql` | Nếu dùng mã hóa điểm |
| 5 | **`V6__rating_levels_setup.sql`** | **Khung điểm GM** |

```bash
psql -U <user> -d <database> -f document/db/init-db.sql
psql -U <user> -d <database> -f document/db/V3__sample_data.sql
psql -U <user> -d <database> -f document/db/V6__rating_levels_setup.sql
```

**DBeaver / pgAdmin:** mở từng file → Execute script (cả file).

---

## Database đang chạy (nâng cấp)

Chỉ cần:

```bash
psql -U <user> -d <database> -f document/db/V6__rating_levels_setup.sql
```

Script sẽ:

1. Gộp `performance_rating_scales` → `kpi_cycles` (nếu DB cũ còn bảng scales)
2. Đặt `performance_rating_levels.cycle_id` NOT NULL, bỏ `scale_id`
3. Seed 9 mức/năm (2024–2026), bỏ qua bản ghi đã có (`ON CONFLICT DO NOTHING`)

An toàn **chạy lại** nhiều lần.

---

## Kiểm tra sau khi chạy

```sql
SELECT c.year, c.name, COUNT(l.id) AS level_count
FROM kpi_cycles c
LEFT JOIN performance_rating_levels l
    ON l.cycle_id = c.id AND l.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.year, c.name
ORDER BY c.year;

SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'performance_rating_scales'
) AS scales_table_still_exists;
-- Kỳ vọng: false
```

---

## UUID chu kỳ (seed)

| Năm | `kpi_cycles.id` |
|-----|------------------|
| 2026 | `c2000000-0000-0000-0000-000000000001` |
| 2025 | `c2000000-0000-0000-0000-000000000002` |
| 2024 | `c2000000-0000-0000-0000-000000000003` |

Nếu môi trường dùng UUID `kpi_cycles` khác, sửa Phần 2 trong `V6__rating_levels_setup.sql`.

---

## Lỗi thường gặp

**`cycle_id contains null values`** — chạy lại `V6__rating_levels_setup.sql` (bản mới đã xử lý soft-delete).

Nếu vẫn lỗi:

```sql
SELECT id, scale_id, deleted_at
FROM performance_rating_levels
WHERE cycle_id IS NULL;
```

Sau đó chạy lại V6.
