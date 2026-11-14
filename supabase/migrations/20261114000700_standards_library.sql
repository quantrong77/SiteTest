-- Chủ dự án tự chạy migration này trên Supabase sau khi review.
-- Danh mục tài liệu và kho file riêng tư dùng chung cho đơn vị.
create table public.library_docs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'standard' check (kind in ('standard', 'procedure', 'manual')),
  code text,
  edition text,
  title text not null,
  equipment_group text,
  priority smallint check (priority between 1 and 3),
  scope text,
  sections text[] not null default '{}',
  class_codes text[] not null default '{}',
  status text not null default 'missing' check (status in ('have', 'old', 'searching', 'missing')),
  tcvn text,
  note text,
  summary_md text,
  file_path text unique,
  file_name text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null
);
create unique index library_docs_edition_uq on public.library_docs(kind, code, edition) where code is not null;
create trigger library_docs_touch before update on public.library_docs for each row execute function public.touch_updated_at();
alter table public.library_docs enable row level security;
create policy library_docs_read on public.library_docs for select to authenticated using (public.current_role_name() <> 'none');
create policy library_docs_admin on public.library_docs for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.library_docs to authenticated;

insert into storage.buckets (id, name, public) values ('library', 'library', false)
on conflict (id) do update set public = false;
create policy library_read on storage.objects for select to authenticated using (bucket_id = 'library' and public.current_role_name() <> 'none');
create policy library_insert on storage.objects for insert to authenticated with check (bucket_id = 'library' and public.is_admin());
create policy library_update on storage.objects for update to authenticated using (bucket_id = 'library' and public.is_admin()) with check (bucket_id = 'library' and public.is_admin());
create policy library_delete on storage.objects for delete to authenticated using (bucket_id = 'library' and public.is_admin());
