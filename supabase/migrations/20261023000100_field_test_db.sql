-- =====================================================================================
-- CSDL thí nghiệm thiết bị nhất thứ (giai đoạn 1: máy biến áp)
-- Lưu số liệu thí nghiệm hiện trường + số liệu Test report xuất xưởng (FAT) dưới dạng
-- "một giá trị một dòng" để phân tích xu hướng theo thiết bị / hạng mục / pha / nấc.
-- =====================================================================================

-- ---------------------------------------------------------------- phân quyền
-- viewer: chỉ xem; editor: nhập/sửa số liệu; admin: quản lý danh mục & người dùng
create table public.app_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.app_users where user_id = auth.uid()), 'none');
$$;
create or replace function public.can_edit() returns boolean
language sql stable as $$ select public.current_role_name() in ('editor', 'admin') $$;
create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.current_role_name() = 'admin' $$;

-- Người đăng ký mới mặc định là viewer; admin nâng quyền trong bảng app_users
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_users (user_id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------- danh mục
create table public.substations (
  id          uuid primary key default gen_random_uuid(),
  code        text unique,
  name        text not null unique,
  voltage_kv  numeric,
  owner_unit  text,                       -- đơn vị quản lý vận hành
  created_at  timestamptz not null default now()
);

-- Loại thiết bị nhất thứ (theo các Điều của QĐ 1901)
create table public.equipment_classes (
  code     text primary key,
  name_vi  text not null,
  qd1901   text,                          -- Điều/Bảng tham chiếu
  is_component boolean not null default false
);
insert into public.equipment_classes (code, name_vi, qd1901, is_component) values
  ('MBA',  'Máy biến áp lực',                 'Điều 9 Bảng 1; Điều 26–44', false),
  ('MBA_TD','Máy biến áp tự dùng ≤35 kV',     'Điều 9 Bảng 2', false),
  ('KH',   'Kháng điện dầu',                  'Điều 9 Bảng 3; Điều 57–69', false),
  ('TI',   'Máy biến dòng điện',              'Điều 10', false),
  ('TU',   'Máy biến điện áp',                'Điều 11', false),
  ('MC',   'Máy cắt',                         'Điều 12', false),
  ('DCL',  'Dao cách ly, dao tiếp địa',       'Điều 13', false),
  ('TD',   'Tụ điện',                         'Điều 14', false),
  ('CSV',  'Chống sét van',                   'Điều 15', false),
  ('GIS',  'Thiết bị GIS/HGIS',               'Điều 19', false),
  ('CAP',  'Cáp ngầm',                        'Điều 20–21', false),
  ('SU',   'Sứ xuyên (sứ đầu vào)',           'Điều 38', true),
  ('OLTC', 'Bộ điều áp dưới tải',             'Điều 37', true),
  ('BCT',  'Biến dòng chân sứ',               'Điều 39', true);

create table public.equipment (
  id            uuid primary key default gen_random_uuid(),
  class_code    text not null references public.equipment_classes (code),
  substation_id uuid references public.substations (id) on delete set null,
  parent_id     uuid references public.equipment (id) on delete cascade,  -- sứ/OLTC/BCT thuộc MBA
  name          text,                     -- vd 'AT1 pha A'
  position      text,                     -- vị trí lắp đặt / đầu sứ ('1.1', '2.1', '3.1'…)
  phase         text,
  manufacturer  text,
  model         text,
  serial_no     text not null,
  year_made     int,
  rated         jsonb not null default '{}'::jsonb,   -- thông số định mức / nameplate
  commissioned_on date,
  status        text not null default 'in_service' check (status in ('in_service', 'spare', 'retired')),
  notes         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (class_code, serial_no)
);
create index equipment_parent_idx on public.equipment (parent_id);
create index equipment_substation_idx on public.equipment (substation_id);
create trigger equipment_touch before update on public.equipment for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- lần thí nghiệm
create table public.test_sessions (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.equipment (id) on delete cascade,
  kind          text not null check (kind in ('FAT', 'SAT', 'PERIODIC', 'AFTER_REPAIR', 'ABNORMAL', 'SPARE', 'OTHER')),
  test_date     date not null,
  report_no     text,
  reason        text,                     -- nguyên văn "Lý do thí nghiệm" trên BBTN
  organization  text,
  performed_by  text,
  ambient_temp_c numeric,
  humidity_pct  numeric,
  source        text not null default 'field_app' check (source in ('field_app', 'factory_import', 'manual')),
  source_file   text,
  template_code text,
  status        text not null default 'draft' check (status in ('draft', 'final')),
  conclusion    text,
  remark        text,
  summary       jsonb not null default '{}'::jsonb,   -- đánh giá theo hạng mục
  app_state     jsonb,                                -- toàn bộ dữ liệu biểu mẫu để mở lại / xuất lại BBTN
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index test_sessions_equipment_idx on public.test_sessions (equipment_id, test_date);
create trigger test_sessions_touch before update on public.test_sessions for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- số liệu đo (dạng dài)
-- item  : hạng mục (IR, WTGD, DCR, RATIO, BUSHING, NOLOAD, MOISTURE, OLTC, BCT_IR, BCT_RATIO, BCT_DCR, BCT_EXC…)
-- param : đại lượng (R60, KHT, PI, TGD, C, R, K, ERR, P0, I0, C1, TGD1…)
-- config: sơ đồ đo / cuộn dây / đầu cuộn (vd 'HV+MV+N-LV+TANK', 'HV', 'HV/MV', 'HV/2S1-2S3')
-- value_norm: giá trị đã quy đổi về điều kiện chuẩn (20 °C cho R cách điện, tgδ; 75 °C cho R một chiều)
create table public.measurements (
  id            bigint generated always as identity primary key,
  session_id    uuid not null references public.test_sessions (id) on delete cascade,
  equipment_id  uuid not null references public.equipment (id) on delete cascade,
  item          text not null,
  param         text not null,
  config        text not null default '',
  phase         text not null default '',
  tap           text not null default '',
  value         numeric,
  value_text    text,
  unit          text,
  temp_c        numeric,
  value_norm    numeric,
  norm_temp_c   numeric,
  status        text check (status in ('pass', 'warn', 'fail', 'missing', 'info')),
  note          text,
  unique (session_id, equipment_id, item, param, config, phase, tap)
);
create index measurements_trend_idx on public.measurements (equipment_id, item, param, config, phase, tap);

-- Kết quả so sánh / đánh giá của từng lần thí nghiệm (đầu ra của app)
create table public.test_findings (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.test_sessions (id) on delete cascade,
  section     text not null,
  item        text not null,
  location    text,
  measured    text,
  converted   text,
  reference   text,
  deviation   text,
  limit_text  text,
  status      text not null check (status in ('pass', 'warn', 'fail', 'missing', 'info')),
  basis       text,
  note        text
);
create index test_findings_session_idx on public.test_findings (session_id);

-- Tài liệu: BBTN .docx đã xuất, Test report gốc, ảnh hiện trường (lưu trong Storage)
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references public.test_sessions (id) on delete cascade,
  equipment_id uuid references public.equipment (id) on delete cascade,
  kind         text not null check (kind in ('BBTN_DOCX', 'FACTORY_REPORT', 'TEMPLATE', 'PHOTO', 'OTHER')),
  storage_path text not null unique,
  file_name    text not null,
  size_bytes   bigint,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- views phục vụ xu hướng
create view public.v_equipment as
select e.*, s.name as substation_name, c.name_vi as class_name,
       p.serial_no as parent_serial, p.name as parent_name,
       coalesce(p.id, e.id) as root_id
from public.equipment e
left join public.substations s on s.id = e.substation_id
left join public.equipment_classes c on c.code = e.class_code
left join public.equipment p on p.id = e.parent_id;
alter view public.v_equipment set (security_invoker = true);

create view public.v_trend as
select m.id, m.equipment_id, e.serial_no, e.class_code, e.name as equipment_name, e.position,
       ts.id as session_id, ts.kind, ts.test_date, ts.report_no, ts.status as session_status,
       m.item, m.param, m.config, m.phase, m.tap,
       m.value, m.value_text, m.unit, m.temp_c, m.value_norm, m.norm_temp_c,
       coalesce(m.value_norm, m.value) as value_cmp,
       case when m.value_norm is not null then 'norm' else 'raw' end as cmp_basis,  -- không so giá trị quy đổi với giá trị thô
       m.status, m.note
from public.measurements m
join public.test_sessions ts on ts.id = m.session_id
join public.equipment e on e.id = m.equipment_id;
alter view public.v_trend set (security_invoker = true);

-- Giá trị khởi đầu (FAT nếu có, nếu không thì lần đo sớm nhất) & % thay đổi của từng lần đo
create view public.v_trend_delta as
with base as (
  select distinct on (equipment_id, item, param, config, phase, tap, cmp_basis)
         equipment_id, item, param, config, phase, tap, cmp_basis, value_cmp as base_value, test_date as base_date, kind as base_kind
  from public.v_trend
  where value_cmp is not null
  order by equipment_id, item, param, config, phase, tap, cmp_basis, (kind = 'FAT') desc, test_date
)
select t.*, b.base_value, b.base_date, b.base_kind,
       case when b.base_value is not null and b.base_value <> 0
            then round(((t.value_cmp - b.base_value) / abs(b.base_value) * 100)::numeric, 3) end as change_pct
from public.v_trend t
left join base b using (equipment_id, item, param, config, phase, tap, cmp_basis);
alter view public.v_trend_delta set (security_invoker = true);

create view public.v_session_list as
select ts.id, ts.test_date, ts.kind, ts.status, ts.report_no, ts.reason, ts.source, ts.updated_at,
       e.id as equipment_id, e.serial_no, e.name as equipment_name, e.class_code, s.name as substation_name,
       (select count(*) from public.measurements m where m.session_id = ts.id) as n_values,
       (select count(*) from public.test_findings f where f.session_id = ts.id and f.status = 'fail') as n_fail,
       (ts.app_state is not null) as has_form
from public.test_sessions ts
join public.equipment e on e.id = ts.equipment_id
left join public.substations s on s.id = e.substation_id;
alter view public.v_session_list set (security_invoker = true);

-- ---------------------------------------------------------------- lưu một lần thí nghiệm (nguyên tử)
-- Thay toàn bộ số liệu & đánh giá của session trong một giao dịch để tránh dữ liệu nửa vời.
create or replace function public.replace_session_data(p_session_id uuid, p_measurements jsonb, p_findings jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if not public.can_edit() then raise exception 'Không có quyền ghi dữ liệu' using errcode = '42501'; end if;
  delete from public.measurements where session_id = p_session_id;
  delete from public.test_findings where session_id = p_session_id;
  insert into public.measurements (session_id, equipment_id, item, param, config, phase, tap, value, value_text, unit,
                                   temp_c, value_norm, norm_temp_c, status, note)
  select p_session_id, (x->>'equipment_id')::uuid, x->>'item', x->>'param', coalesce(x->>'config', ''), coalesce(x->>'phase', ''),
         coalesce(x->>'tap', ''), (x->>'value')::numeric, x->>'value_text', x->>'unit', (x->>'temp_c')::numeric,
         (x->>'value_norm')::numeric, (x->>'norm_temp_c')::numeric, x->>'status', x->>'note'
  from jsonb_array_elements(coalesce(p_measurements, '[]'::jsonb)) x
  on conflict (session_id, equipment_id, item, param, config, phase, tap) do update
    set value = excluded.value, value_text = excluded.value_text, value_norm = excluded.value_norm, status = excluded.status;
  get diagnostics n = row_count;
  insert into public.test_findings (session_id, section, item, location, measured, converted, reference, deviation, limit_text, status, basis, note)
  select p_session_id, x->>'section', x->>'item', x->>'location', x->>'measured', x->>'converted', x->>'reference', x->>'deviation',
         x->>'limit_text', x->>'status', x->>'basis', x->>'note'
  from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb)) x;
  return n;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.app_users        enable row level security;
alter table public.substations      enable row level security;
alter table public.equipment_classes enable row level security;
alter table public.equipment        enable row level security;
alter table public.test_sessions    enable row level security;
alter table public.measurements     enable row level security;
alter table public.test_findings    enable row level security;
alter table public.documents        enable row level security;

create policy app_users_self_read on public.app_users for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy app_users_admin_write on public.app_users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy classes_read on public.equipment_classes for select to authenticated using (true);
create policy classes_admin on public.equipment_classes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Bảng nghiệp vụ: người đã đăng nhập (có trong app_users) được xem; editor/admin được ghi;
-- xóa: admin, hoặc editor xóa biên bản nháp do chính mình tạo
do $$
declare t text;
begin
  foreach t in array array['substations', 'equipment', 'test_sessions', 'measurements', 'test_findings', 'documents'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.current_role_name() <> ''none'')', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.can_edit())', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.can_edit()) with check (public.can_edit())', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_admin() or (public.can_edit() and %2$s))',
                   t, case when t in ('measurements', 'test_findings') then 'true'
                           when t = 'test_sessions' then 'status = ''draft'' and created_by = auth.uid()'
                           else 'false' end);
  end loop;
end $$;

-- ---------------------------------------------------------------- Storage (BBTN .docx, Test report gốc)
insert into storage.buckets (id, name, public) values ('test-documents', 'test-documents', false)
on conflict (id) do nothing;

create policy test_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'test-documents' and public.current_role_name() <> 'none');
create policy test_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'test-documents' and public.can_edit());
create policy test_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'test-documents' and public.can_edit());
create policy test_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'test-documents' and public.is_admin());

grant usage on schema public to authenticated;
grant select on public.v_equipment, public.v_trend, public.v_trend_delta, public.v_session_list to authenticated;
grant execute on function public.replace_session_data(uuid, jsonb, jsonb) to authenticated;
