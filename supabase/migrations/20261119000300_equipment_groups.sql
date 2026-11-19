-- =====================================================================================
-- G2.2 — Tổ máy: tổ 3 MBA 1 pha rời (pha A, B, C) là một bản ghi riêng, không suy ra theo ngăn.
-- Thay một máy của tổ (vd máy pha B hỏng, lắp máy dự phòng) thì tổ giữ nguyên, chỉ đổi thành viên của pha đó
-- (lịch sử thành viên theo thời gian). MBA 3 pha chung là một thiết bị, không cần tổ.
-- =====================================================================================

create table public.equipment_groups (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'BANK_1P' check (kind in ('BANK_1P')),   -- tổ 3 máy 1 pha rời
  class_code  text not null default 'MBA' references public.equipment_classes (code),
  name        text not null,           -- vd 'Tổ MBA AT1'
  bay_id      uuid references public.bays (id) on delete restrict,          -- ngăn đang lắp tổ (thành viên đi theo)
  notes       text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index equipment_groups_bay_idx on public.equipment_groups (bay_id);
create trigger equipment_groups_touch before update on public.equipment_groups for each row execute function public.touch_updated_at();

create table public.equipment_group_members (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.equipment_groups (id) on delete cascade,
  equipment_id  uuid not null references public.equipment (id) on delete restrict,
  phase         text not null check (phase in ('A', 'B', 'C')),
  from_date     date not null default current_date,
  to_date       date,                  -- null: đang là máy của pha này
  note          text,                  -- vd 'Thay máy pha B bằng máy dự phòng SN…'
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  check (to_date is null or to_date >= from_date)
);
create index equipment_group_members_group_idx on public.equipment_group_members (group_id, phase, from_date);
create index equipment_group_members_eq_idx on public.equipment_group_members (equipment_id);
-- mỗi pha của tổ chỉ một máy đang lắp; mỗi máy chỉ thuộc một tổ tại một thời điểm
create unique index equipment_group_members_phase_uq on public.equipment_group_members (group_id, phase) where to_date is null;
create unique index equipment_group_members_eq_uq on public.equipment_group_members (equipment_id) where to_date is null;

comment on table public.equipment_groups is 'Tổ máy (BANK_1P: tổ 3 MBA 1 pha rời). Thành viên theo pha và theo thời gian ở equipment_group_members.';

-- Thành viên chỉ là máy chính (không phải sứ / OLTC) cùng loại với tổ
create or replace function public.equipment_group_member_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare e record; g record;
begin
  select id, parent_id, class_code into e from public.equipment where id = new.equipment_id;
  select class_code into g from public.equipment_groups where id = new.group_id;
  if e.parent_id is not null then raise exception 'Thành viên tổ phải là máy chính, không phải thiết bị con (sứ, OLTC…)'; end if;
  if e.class_code <> g.class_code then raise exception 'Thành viên tổ phải cùng loại thiết bị với tổ (%)', g.class_code; end if;
  return new;
end $$;
create trigger equipment_group_member_check before insert or update of equipment_id, group_id on public.equipment_group_members
  for each row execute function public.equipment_group_member_check();

-- Thay máy của một pha: đóng thành viên đang mở của pha đó và mở thành viên mới (một giao dịch)
create or replace function public.replace_group_member(p_group uuid, p_phase text, p_equipment uuid, p_date date default current_date, p_note text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare new_id uuid;
begin
  update public.equipment_group_members set to_date = greatest(from_date, p_date)
   where group_id = p_group and phase = p_phase and to_date is null;
  -- máy mới đang thuộc tổ khác → rời tổ đó
  update public.equipment_group_members set to_date = greatest(from_date, p_date)
   where equipment_id = p_equipment and to_date is null;
  insert into public.equipment_group_members (group_id, equipment_id, phase, from_date, note)
  values (p_group, p_equipment, p_phase, p_date, p_note) returning id into new_id;
  return new_id;
end $$;
grant execute on function public.replace_group_member(uuid, text, uuid, date, text) to authenticated;

-- ---------------------------------------------------------------- số liệu đã có
-- Ngăn có đúng một MBA chính cho mỗi pha A / B / C (ít nhất 2 pha) → tạo tổ 'Tổ MBA <mã ngăn>'.
-- Kiểm tra lại trên trang danh mục: ngăn có máy dự phòng cùng pha sẽ không tự tạo tổ.
-- (hai câu lệnh riêng: câu sau cần thấy tổ vừa tạo — trigger kiểm tra loại thiết bị đọc bảng equipment_groups)
create temporary table g2_cand as
select e.bay_id, upper(e.phase) as phase, count(*) as n, min(e.id::text)::uuid as equipment_id,
       min(coalesce(e.commissioned_on, e.created_at::date)) as from_date
from public.equipment e
where e.parent_id is null and e.class_code = 'MBA' and e.bay_id is not null and upper(coalesce(e.phase, '')) in ('A', 'B', 'C')
group by e.bay_id, upper(e.phase);
delete from g2_cand where bay_id in (select bay_id from g2_cand group by bay_id having count(*) < 2 or not bool_and(n = 1));

insert into public.equipment_groups (kind, class_code, name, bay_id, notes)
select distinct 'BANK_1P', 'MBA', 'Tổ MBA ' || b.code, b.id, 'Tạo tự động từ các máy pha A / B / C trong ngăn — kiểm tra lại'
from g2_cand c join public.bays b on b.id = c.bay_id;

insert into public.equipment_group_members (group_id, equipment_id, phase, from_date, note)
select g.id, c.equipment_id, c.phase, c.from_date, 'Tạo tự động'
from g2_cand c join public.equipment_groups g on g.bay_id = c.bay_id and g.notes like 'Tạo tự động%';
drop table g2_cand;

-- ---------------------------------------------------------------- views
-- Thành viên đang lắp của mỗi tổ (một dòng / pha)
create view public.v_equipment_group_members as
select m.*, g.name as group_name, g.kind as group_kind, g.bay_id as group_bay_id,
       e.serial_no, e.name as equipment_name, e.status as equipment_status
from public.equipment_group_members m
join public.equipment_groups g on g.id = m.group_id
join public.equipment e on e.id = m.equipment_id;
alter view public.v_equipment_group_members set (security_invoker = true);

create view public.v_equipment_groups as
select g.*, b.code as bay_code, s.name as substation_name,
       (select m.equipment_id from public.equipment_group_members m where m.group_id = g.id and m.phase = 'A' and m.to_date is null) as eq_a,
       (select m.equipment_id from public.equipment_group_members m where m.group_id = g.id and m.phase = 'B' and m.to_date is null) as eq_b,
       (select m.equipment_id from public.equipment_group_members m where m.group_id = g.id and m.phase = 'C' and m.to_date is null) as eq_c
from public.equipment_groups g
left join public.bays b on b.id = g.bay_id
left join public.substations s on s.id = b.substation_id;
alter view public.v_equipment_groups set (security_invoker = true);

-- ---------------------------------------------------------------- RLS
alter table public.equipment_groups enable row level security;
alter table public.equipment_group_members enable row level security;
create policy equipment_groups_read   on public.equipment_groups for select to authenticated using (public.current_role_name() <> 'none');
create policy equipment_groups_insert on public.equipment_groups for insert to authenticated with check (public.can_edit());
create policy equipment_groups_update on public.equipment_groups for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy equipment_groups_delete on public.equipment_groups for delete to authenticated using (public.can_edit());
create policy equipment_group_members_read   on public.equipment_group_members for select to authenticated using (public.current_role_name() <> 'none');
create policy equipment_group_members_insert on public.equipment_group_members for insert to authenticated with check (public.can_edit());
create policy equipment_group_members_update on public.equipment_group_members for update to authenticated using (public.can_edit()) with check (public.can_edit());
create policy equipment_group_members_delete on public.equipment_group_members for delete to authenticated using (public.is_admin());

grant select on public.v_equipment_groups, public.v_equipment_group_members to authenticated;
