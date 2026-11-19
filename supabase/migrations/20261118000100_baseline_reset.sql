-- Lần thí nghiệm sau sửa chữa / đại tu được lấy làm giá trị khởi đầu mới cho các lần sau.
--  'INSULATION' — có lọc dầu, sấy chân không: số liệu cách điện cuộn dây (item IR, WTGD) — quy định của đơn vị;
--  'ALL'        — thay cuộn dây / thay đổi kết cấu cách điện: mọi số liệu (QĐ 1901 Điều 2, định nghĩa giá trị khởi đầu).
-- Mốc khởi đầu trong v_trend_delta: lần đặt lại gần nhất có phạm vi gồm đại lượng; không có thì xuất xưởng (FAT); không có thì lần sớm nhất.
-- App (TrendInline.series) chọn mốc theo cùng quy tắc.

alter table public.test_sessions
  add column if not exists baseline_reset text check (baseline_reset in ('INSULATION', 'ALL'));

comment on column public.test_sessions.baseline_reset is
  'Lần sau sửa chữa lấy làm giá trị khởi đầu mới: INSULATION (lọc dầu, sấy chân không — cách điện cuộn dây IR, WTGD) | ALL (thay cuộn dây / kết cấu cách điện — mọi số liệu, QĐ 1901 Điều 2)';

-- v_trend_delta dùng t.* của v_trend → bỏ rồi tạo lại cả hai view (thêm cột baseline_reset vào cuối v_trend)
drop view if exists public.v_trend_delta;

create or replace view public.v_trend as
select m.id, m.equipment_id, e.serial_no, e.class_code, e.name as equipment_name, e.position,
       ts.id as session_id, ts.kind, ts.test_date, ts.report_no, ts.status as session_status,
       m.item, m.param, m.config, m.phase, m.tap,
       m.value, m.value_text, m.unit, m.temp_c, m.value_norm, m.norm_temp_c,
       coalesce(m.value_norm, m.value) as value_cmp,
       case when m.value_norm is not null then 'norm' else 'raw' end as cmp_basis,  -- không so giá trị quy đổi với giá trị thô
       m.status, m.note,
       ts.baseline_reset
from public.measurements m
join public.test_sessions ts on ts.id = m.session_id
join public.equipment e on e.id = m.equipment_id;
alter view public.v_trend set (security_invoker = true);

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
           is_reset desc, (case when is_reset then test_date end) desc nulls last, (kind = 'FAT') desc, test_date
)
select t.*, b.base_value, b.base_date, b.base_kind,
       case when b.base_value is not null and b.base_value <> 0
            then round(((t.value_cmp - b.base_value) / abs(b.base_value) * 100)::numeric, 3) end as change_pct
from public.v_trend t
left join base b using (equipment_id, item, param, config, phase, tap, cmp_basis);
alter view public.v_trend_delta set (security_invoker = true);

grant select on public.v_trend, public.v_trend_delta to authenticated;
