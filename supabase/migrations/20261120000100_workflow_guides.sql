-- Chủ dự án tự chạy migration này trên Supabase sau khi review.
-- Hướng dẫn đo theo hạng mục (bước 2 của mỗi hạng mục BBTN): nội dung Markdown do Admin chỉnh cho đơn vị,
-- thay cho nội dung mặc định có sẵn trong app. Xóa dòng = khôi phục nội dung mặc định.
-- Ảnh hướng dẫn nằm trong bucket riêng tư 'library' (đã có, migration 20261114000700), thư mục guide/<loại thiết bị>/;
-- quyền đọc / ghi theo chính sách của bucket đó (mọi tài khoản có vai trò đọc, Admin ghi).
create table if not exists public.workflow_guides (
  class_code text not null,
  section_id text not null,
  kind text not null default 'guide' check (kind in ('prep', 'guide')),
  content_md text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (class_code, section_id, kind)
);
create trigger workflow_guides_touch before update on public.workflow_guides for each row execute function public.touch_updated_at();
alter table public.workflow_guides enable row level security;
create policy workflow_guides_read on public.workflow_guides for select to authenticated using (public.current_role_name() <> 'none');
create policy workflow_guides_admin on public.workflow_guides for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.workflow_guides to authenticated;
