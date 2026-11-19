-- =====================================================================================
-- G2.3 — Thay thiết bị con của MBA (sứ xuyên, OLTC, TI chân sứ): mỗi sứ có số chế tạo riêng và lịch sử riêng.
-- Thay sứ: sứ cũ ghi ngày tháo (removed_on), vẫn giữ máy chính + vị trí để tra lịch sử; sứ mới lắp vào cùng vị trí.
-- Xu hướng đi theo số chế tạo sứ → sứ mới có giá trị khởi đầu riêng (test report sứ / lần sau lắp đặt).
-- =====================================================================================

alter table public.equipment
  add column if not exists installed_on date,   -- ngày lắp vào máy chính (thiết bị con) / đưa vào vận hành
  add column if not exists removed_on   date;   -- ngày tháo khỏi máy chính; null: đang lắp
alter table public.equipment drop constraint if exists equipment_removed_after_installed;
alter table public.equipment add constraint equipment_removed_after_installed
  check (removed_on is null or installed_on is null or removed_on >= installed_on);
comment on column public.equipment.removed_on is 'Thiết bị con đã tháo khỏi máy chính (thay sứ / OLTC / TI chân sứ). Giữ parent_id, position để tra lịch sử.';

-- Mỗi vị trí của máy chính chỉ một thiết bị con đang lắp (cùng loại). Dữ liệu cũ bị trùng thì không tạo ràng buộc, báo để dọn.
do $$
begin
  if exists (select 1 from public.equipment where parent_id is not null and removed_on is null and coalesce(position, '') <> ''
             group by parent_id, class_code, position having count(*) > 1) then
    raise notice 'Có vị trí trên máy chính đang gắn nhiều thiết bị con cùng loại — chưa tạo ràng buộc equipment_component_slot_uq. Dọn dữ liệu rồi chạy lại khối này.';
  else
    create unique index if not exists equipment_component_slot_uq on public.equipment (parent_id, class_code, position)
      where parent_id is not null and removed_on is null and coalesce(position, '') <> '';
  end if;
end $$;

-- Thay thiết bị con: tháo cái cũ (ngày tháo, trạng thái), lắp cái mới cùng máy chính / vị trí / pha / loại.
-- Số chế tạo mới đã có trong danh mục (vd sứ dự phòng, đã nhập test report) → dùng lại bản ghi đó. Trả về id thiết bị mới.
create or replace function public.replace_component(
  p_old uuid, p_serial text, p_date date default current_date,
  p_old_status text default 'retired', p_model text default null, p_manufacturer text default null, p_note text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare o record; new_id uuid;
begin
  select * into o from public.equipment where id = p_old;
  if not found then raise exception 'Không tìm thấy thiết bị cần thay'; end if;
  if o.parent_id is null then raise exception 'Chỉ thay được thiết bị con (sứ, OLTC, TI chân sứ); máy chính đổi ngăn hoặc thay trong tổ máy'; end if;
  if o.removed_on is not null then raise exception 'Thiết bị % đã tháo ngày %', o.serial_no, o.removed_on; end if;
  if coalesce(trim(p_serial), '') = '' then raise exception 'Thiếu số chế tạo thiết bị mới'; end if;
  if p_old_status not in ('in_service', 'spare', 'retired') then raise exception 'Trạng thái thiết bị cũ không hợp lệ: %', p_old_status; end if;

  update public.equipment
     set removed_on = greatest(coalesce(installed_on, p_date), p_date),
         status = p_old_status,
         notes = concat_ws(E'\n', nullif(notes, ''), format('Tháo %s, thay bằng %s%s', to_char(p_date, 'DD/MM/YYYY'), trim(p_serial), coalesce(' — ' || p_note, '')))
   where id = p_old;

  select id into new_id from public.equipment where class_code = o.class_code and serial_no = trim(p_serial);
  if new_id is not null then
    if new_id = p_old then raise exception 'Số chế tạo mới trùng thiết bị cũ'; end if;
    update public.equipment
       set parent_id = o.parent_id, position = o.position, phase = o.phase, installed_on = p_date, removed_on = null, status = 'in_service',
           model = coalesce(p_model, model), manufacturer = coalesce(p_manufacturer, manufacturer)
     where id = new_id;
  else
    insert into public.equipment (class_code, parent_id, position, phase, serial_no, model, manufacturer, installed_on, status)
    values (o.class_code, o.parent_id, o.position, o.phase, trim(p_serial), coalesce(p_model, o.model), coalesce(p_manufacturer, o.manufacturer), p_date, 'in_service')
    returning id into new_id;
  end if;
  return new_id;
end $$;
grant execute on function public.replace_component(uuid, text, date, text, text, text, text) to authenticated;

-- Ngày lắp của thiết bị con đã có: lần thí nghiệm đầu tiên của nó (không tính FAT), không có thì để trống
update public.equipment e set installed_on = (
  select min(ts.test_date) from public.test_sessions ts where ts.equipment_id = e.id and ts.kind <> 'FAT')
where e.parent_id is not null and e.installed_on is null;

-- v_equipment dùng e.* → tạo lại để có cột mới (installed_on, removed_on); thêm cờ "đang lắp"
drop view if exists public.v_equipment;
create view public.v_equipment as
select e.*, s.name as substation_name, b.code as bay_code, b.name as bay_name,
       c.name_vi as class_name, p.serial_no as parent_serial, p.name as parent_name,
       coalesce(p.id, e.id) as root_id,
       (select count(*) from public.test_sessions ts where ts.equipment_id = e.id) as n_sessions,
       (e.removed_on is null) as is_installed
from public.equipment e
left join public.bays b on b.id = e.bay_id
left join public.substations s on s.id = e.substation_id
left join public.equipment_classes c on c.code = e.class_code
left join public.equipment p on p.id = e.parent_id;
alter view public.v_equipment set (security_invoker = true);
grant select on public.v_equipment to authenticated;
