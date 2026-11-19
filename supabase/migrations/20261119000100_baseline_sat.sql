-- Mốc khởi đầu trong v_trend_delta (QĐ 1901 Điều 2, Điều 3 mục d): lần đặt lại sau sửa chữa gần nhất có phạm vi gồm đại lượng
-- → xuất xưởng (FAT, test report) → lần sau lắp đặt (SAT) sớm nhất → lần đo sớm nhất.
-- Trước đây thiếu bước SAT: thiết bị không có test report lấy nhầm lần đo sớm nhất (vd lần định kỳ nhập từ BBTN cũ).
-- App (TrendInline.series) chọn mốc theo cùng quy tắc. Chỉ tạo lại v_trend_delta, v_trend giữ nguyên.

drop view if exists public.v_trend_delta;

create view public.v_trend_delta as
with tagged as (
  select t.*,
         coalesce(t.baseline_reset = 'ALL' or (t.baseline_reset = 'INSULATION' and t.item in ('IR', 'WTGD')), false) as is_reset
  from public.v_trend t
  where t.value_cmp is not null
),
base as (
  select distinct on (equipment_id, item, param, config, phase, tap, cmp_basis)
         equipment_id, item, param, config, phase, tap, cmp_basis, value_cmp as base_value, test_date as base_date, kind as base_kind
  from tagged
  order by equipment_id, item, param, config, phase, tap, cmp_basis,
           is_reset desc, (case when is_reset then test_date end) desc nulls last,
           (kind = 'FAT') desc, (kind = 'SAT') desc, test_date
)
select t.*, b.base_value, b.base_date, b.base_kind,
       case when b.base_value is not null and b.base_value <> 0
            then round(((t.value_cmp - b.base_value) / abs(b.base_value) * 100)::numeric, 3) end as change_pct
from public.v_trend t
left join base b using (equipment_id, item, param, config, phase, tap, cmp_basis);
alter view public.v_trend_delta set (security_invoker = true);

grant select on public.v_trend_delta to authenticated;
