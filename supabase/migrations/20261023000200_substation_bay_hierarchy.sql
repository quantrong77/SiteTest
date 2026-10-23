-- =====================================================================================
-- Phân cấp Trạm → Ngăn lộ → Thiết bị. Một trạm có nhiều ngăn, một ngăn có nhiều thiết bị;
-- thiết bị con (sứ, OLTC, BCT) thuộc ngăn thông qua thiết bị cha.
-- =====================================================================================

-- ---------------------------------------------------------------- Trạm: bổ sung thông tin
alter table public.substations
  add column address        text,
  add column region         text,      -- vd 'Truyền tải điện Lâm Đồng'
  add column commissioned_on date,
  add column notes          text,
  add column updated_at     timestamptz not null default now();
create trigger substations_touch before update on public.substations for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- Ngăn lộ
create table public.bays (
  id            uuid primary key default gen_random_uuid(),
  substation_id uuid not null references public.substations (id) on delete restrict,
  code          text not null,          -- tên vận hành: 'AT1', '571', '272'…
  name          text,                   -- vd 'Ngăn MBA AT1', 'Đường dây 500 kV Di Linh – Pleiku 2'
  bay_type      text,                   -- MBA, Đường dây, Tụ bù, Kháng, Phân đoạn, Liên lạc, Tự dùng…
  voltage_kv    numeric,
  status        text not null default 'in_service' check (status in ('in_service', 'construction', 'retired')),
  notes         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (substation_id, code)
);
create index bays_substation_idx on public.bays (substation_id);
create trigger bays_touch before update on public.bays for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- Thiết bị: gắn ngăn
alter table public.equipment
  add column bay_id     uuid references public.bays (id) on delete restrict,
  add column voltage_kv numeric;
create index equipment_bay_idx on public.equipment (bay_id);

-- Trạm của thiết bị luôn suy ra từ ngăn (hoặc từ thiết bị cha) để không lệch dữ liệu
create or replace function public.equipment_sync_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.bay_id is null and new.parent_id is not null then
    select bay_id into new.bay_id from public.equipment where id = new.parent_id;
  end if;
  if new.bay_id is not null then
    select substation_id into new.substation_id from public.bays where id = new.bay_id;
  end if;
  return new;
end $$;
create trigger equipment_sync_location before insert or update of bay_id, parent_id on public.equipment
  for each row execute function public.equipment_sync_location();

-- Đổi ngăn của thiết bị cha thì thiết bị con đi theo
create or replace function public.equipment_cascade_bay() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.bay_id is distinct from old.bay_id then
    update public.equipment set bay_id = new.bay_id where parent_id = new.id;
  end if;
  return null;
end $$;
create trigger equipment_cascade_bay after update of bay_id on public.equipment
  for each row execute function public.equipment_cascade_bay();

-- ---------------------------------------------------------------- bảo vệ lịch sử thí nghiệm
-- Không cho xóa thiết bị khi đã có số liệu thí nghiệm (trước đây là cascade)
alter table public.test_sessions drop constraint test_sessions_equipment_id_fkey,
  add constraint test_sessions_equipment_id_fkey foreign key (equipment_id) references public.equipment (id) on delete restrict;
alter table public.measurements drop constraint measurements_equipment_id_fkey,
  add constraint measurements_equipment_id_fkey foreign key (equipment_id) references public.equipment (id) on delete restrict;

-- ---------------------------------------------------------------- RLS
alter table public.bays enable row level security;
create policy bays_read   on public.bays for select to authenticated using (public.current_role_name() <> 'none');
create policy bays_insert on public.bays for insert to authenticated with check (public.can_edit());
create policy bays_update on public.bays for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy bays_delete on public.bays for delete to authenticated using (public.can_edit());
-- Danh mục: editor được xóa (khóa ngoại "restrict" chặn xóa khi còn ngăn / thiết bị / số liệu)
drop policy substations_delete on public.substations;
create policy substations_delete on public.substations for delete to authenticated using (public.can_edit());
drop policy equipment_delete on public.equipment;
create policy equipment_delete on public.equipment for delete to authenticated using (public.can_edit());

-- ---------------------------------------------------------------- views
drop view public.v_session_list;
drop view public.v_equipment;

create view public.v_equipment as
select e.*, s.name as substation_name, b.code as bay_code, b.name as bay_name,
       c.name_vi as class_name, p.serial_no as parent_serial, p.name as parent_name,
       coalesce(p.id, e.id) as root_id,
       (select count(*) from public.test_sessions ts where ts.equipment_id = e.id) as n_sessions
from public.equipment e
left join public.bays b on b.id = e.bay_id
left join public.substations s on s.id = e.substation_id
left join public.equipment_classes c on c.code = e.class_code
left join public.equipment p on p.id = e.parent_id;
alter view public.v_equipment set (security_invoker = true);

create view public.v_bays as
select b.*, s.name as substation_name,
       (select count(*) from public.equipment e where e.bay_id = b.id and e.parent_id is null) as n_equipment
from public.bays b join public.substations s on s.id = b.substation_id;
alter view public.v_bays set (security_invoker = true);

create view public.v_substations as
select s.*, (select count(*) from public.bays b where b.substation_id = s.id) as n_bays
from public.substations s;
alter view public.v_substations set (security_invoker = true);

create view public.v_session_list as
select ts.id, ts.test_date, ts.kind, ts.status, ts.report_no, ts.reason, ts.source, ts.updated_at,
       e.id as equipment_id, e.serial_no, e.name as equipment_name, e.class_code,
       s.name as substation_name, b.code as bay_code,
       (select count(*) from public.measurements m where m.session_id = ts.id) as n_values,
       (select count(*) from public.test_findings f where f.session_id = ts.id and f.status = 'fail') as n_fail,
       (ts.app_state is not null) as has_form
from public.test_sessions ts
join public.equipment e on e.id = ts.equipment_id
left join public.bays b on b.id = e.bay_id
left join public.substations s on s.id = e.substation_id;
alter view public.v_session_list set (security_invoker = true);

grant select on public.v_equipment, public.v_bays, public.v_substations, public.v_session_list to authenticated;
