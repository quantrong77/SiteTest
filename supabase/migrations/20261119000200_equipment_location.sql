-- =====================================================================================
-- G2.1 — Lịch sử vị trí lắp đặt của thiết bị (Trạm → Ngăn theo thời gian).
-- Thiết bị (máy chính) được chuyển sang ngăn khác cùng trạm hoặc khác trạm: giữ lại nơi lắp đặt cũ,
-- và mỗi lần thí nghiệm ghi ngăn tại thời điểm thí nghiệm (test_sessions.bay_id) — xu hướng vẫn đi theo số chế tạo.
-- Thiết bị con (sứ, OLTC, TI chân sứ) đi theo máy chính (trigger equipment_cascade_bay) nên không ghi lịch sử riêng.
-- =====================================================================================

-- ---------------------------------------------------------------- bảng lịch sử
create table public.equipment_location (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.equipment (id) on delete cascade,
  bay_id        uuid not null references public.bays (id) on delete restrict,
  from_date     date not null default current_date,
  to_date       date,                    -- null: đang lắp ở ngăn này
  note          text,                    -- vd 'Chuyển từ AT1 sang AT2 do thay MBA'
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  check (to_date is null or to_date >= from_date)
);
create index equipment_location_eq_idx on public.equipment_location (equipment_id, from_date);
create index equipment_location_bay_idx on public.equipment_location (bay_id);
-- mỗi thiết bị chỉ có một vị trí đang lắp
create unique index equipment_location_open_uq on public.equipment_location (equipment_id) where to_date is null;

comment on table public.equipment_location is
  'Lịch sử vị trí lắp đặt (ngăn) của máy chính. Ghi tự động khi đổi equipment.bay_id; sửa ngày / ghi chú được (editor).';

-- ---------------------------------------------------------------- ghi tự động khi đổi ngăn
-- Đóng vị trí đang mở (to_date = hôm nay) rồi mở vị trí mới; bỏ gán ngăn chỉ đóng vị trí cũ.
-- Ngày chuyển mặc định là hôm nay — sửa lại ngày thực tế trong bảng lịch sử nếu cần.
create or replace function public.equipment_log_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is not null then return null; end if;
  if tg_op = 'UPDATE' and new.bay_id is not distinct from old.bay_id then return null; end if;
  update public.equipment_location set to_date = greatest(from_date, current_date)
   where equipment_id = new.id and to_date is null;
  if new.bay_id is not null then
    insert into public.equipment_location (equipment_id, bay_id, from_date)
    values (new.id, new.bay_id, current_date);
  end if;
  return null;
end $$;
create trigger equipment_log_location after insert or update of bay_id on public.equipment
  for each row execute function public.equipment_log_location();

-- ---------------------------------------------------------------- vị trí tại thời điểm thí nghiệm
alter table public.test_sessions
  add column if not exists bay_id uuid references public.bays (id) on delete set null;
create index if not exists test_sessions_bay_idx on public.test_sessions (bay_id);
comment on column public.test_sessions.bay_id is
  'Ngăn của thiết bị tại thời điểm thí nghiệm (lấy theo lịch sử vị trí; không có thì ngăn hiện tại). Thí nghiệm xuất xưởng: null.';

-- Lần thí nghiệm mới: tự lấy ngăn theo lịch sử vị trí ở ngày thí nghiệm (thiết bị con: theo máy chính); FAT để trống
create or replace function public.test_session_set_bay() returns trigger
language plpgsql security definer set search_path = public as $$
declare root uuid;
begin
  if new.bay_id is not null or new.kind = 'FAT' then return new; end if;
  select coalesce(e.parent_id, e.id) into root from public.equipment e where e.id = new.equipment_id;
  select l.bay_id into new.bay_id from public.equipment_location l
   where l.equipment_id = root and l.from_date <= new.test_date and (l.to_date is null or l.to_date >= new.test_date)
   order by l.from_date desc limit 1;
  if new.bay_id is null then
    select e.bay_id into new.bay_id from public.equipment e where e.id = new.equipment_id;
  end if;
  return new;
end $$;
create trigger test_session_set_bay before insert on public.test_sessions
  for each row execute function public.test_session_set_bay();

-- ---------------------------------------------------------------- số liệu đã có
-- Vị trí hiện tại của máy chính: từ ngày sớm nhất biết được (đưa vào vận hành → lần thí nghiệm hiện trường đầu tiên → ngày tạo)
insert into public.equipment_location (equipment_id, bay_id, from_date, note)
select e.id, e.bay_id,
       coalesce(e.commissioned_on,
                (select min(ts.test_date) from public.test_sessions ts where ts.equipment_id = e.id and ts.kind <> 'FAT'),
                e.created_at::date),
       'Vị trí lúc bật lịch sử vị trí (ngày bắt đầu ước tính)'
from public.equipment e
where e.parent_id is null and e.bay_id is not null
  and not exists (select 1 from public.equipment_location l where l.equipment_id = e.id);

-- Các lần thí nghiệm đã lưu (không phải FAT): ngăn hiện tại của thiết bị (chưa có lịch sử cũ hơn)
update public.test_sessions ts set bay_id = e.bay_id
from public.equipment e
where e.id = ts.equipment_id and ts.bay_id is null and ts.kind <> 'FAT' and e.bay_id is not null;

-- ---------------------------------------------------------------- views
create view public.v_equipment_location as
select l.*, b.code as bay_code, b.name as bay_name, b.substation_id, s.name as substation_name,
       e.serial_no, e.name as equipment_name, e.class_code
from public.equipment_location l
join public.bays b on b.id = l.bay_id
join public.substations s on s.id = b.substation_id
join public.equipment e on e.id = l.equipment_id;
alter view public.v_equipment_location set (security_invoker = true);

-- Danh sách lần thí nghiệm: trạm / ngăn tại thời điểm thí nghiệm (không có thì nơi lắp hiện tại); thêm cột vị trí hiện tại ở cuối
create or replace view public.v_session_list as
select ts.id, ts.test_date, ts.kind, ts.status, ts.report_no, ts.reason, ts.source, ts.updated_at,
       e.id as equipment_id, e.serial_no, e.name as equipment_name, e.class_code,
       coalesce(ts_s.name, s.name) as substation_name, coalesce(ts_b.code, b.code) as bay_code,
       (select count(*) from public.measurements m where m.session_id = ts.id) as n_values,
       (select count(*) from public.test_findings f where f.session_id = ts.id and f.status = 'fail') as n_fail,
       (ts.app_state is not null) as has_form,
       s.name as current_substation_name, b.code as current_bay_code
from public.test_sessions ts
join public.equipment e on e.id = ts.equipment_id
left join public.bays b on b.id = e.bay_id
left join public.substations s on s.id = e.substation_id
left join public.bays ts_b on ts_b.id = ts.bay_id
left join public.substations ts_s on ts_s.id = ts_b.substation_id;
alter view public.v_session_list set (security_invoker = true);

-- ---------------------------------------------------------------- RLS
alter table public.equipment_location enable row level security;
create policy equipment_location_read   on public.equipment_location for select to authenticated using (public.current_role_name() <> 'none');
create policy equipment_location_insert on public.equipment_location for insert to authenticated with check (public.can_edit());
create policy equipment_location_update on public.equipment_location for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy equipment_location_delete on public.equipment_location for delete to authenticated using (public.is_admin());

grant select on public.v_equipment_location, public.v_session_list to authenticated;
