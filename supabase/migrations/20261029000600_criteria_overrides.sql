-- Bộ tiêu chí của đơn vị: ngưỡng đánh giá chỉnh khác giá trị gốc QĐ 1901 (giá trị gốc nằm trong mã nguồn, js/domain/qd1901.js).
-- Mỗi dòng là một ngưỡng đã chỉnh; không có dòng nghĩa là dùng giá trị QĐ 1901.
-- Mọi người dùng đã đăng nhập được đọc; chỉ admin được thêm/sửa/xóa.
create table public.criteria_overrides (
  key           text primary key check (key ~ '^[A-Z0-9_]+$'),
  value         numeric not null,
  note          text,                                  -- lý do / văn bản của đơn vị
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid default auth.uid() references auth.users(id) on delete set null
);
create trigger criteria_overrides_touch before update on public.criteria_overrides
  for each row execute function public.touch_updated_at();

alter table public.criteria_overrides enable row level security;
create policy criteria_read on public.criteria_overrides for select to authenticated
  using (public.current_role_name() <> 'none');
create policy criteria_admin on public.criteria_overrides for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.criteria_overrides to authenticated;
