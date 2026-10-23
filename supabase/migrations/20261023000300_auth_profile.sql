-- =====================================================================================
-- Hồ sơ người dùng: lưu tên & ảnh đại diện (đăng nhập Google / email)
-- =====================================================================================
alter table public.app_users add column avatar_url text, add column last_sign_in_at timestamptz;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_users (user_id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'))
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.app_users.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.app_users.avatar_url);
  return new;
end $$;

-- Cập nhật hồ sơ & thời điểm đăng nhập gần nhất (đăng nhập lại bằng Google có thể đổi ảnh/tên)
create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.app_users
     set email = new.email,
         full_name = coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', full_name),
         avatar_url = coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', avatar_url),
         last_sign_in_at = new.last_sign_in_at
   where user_id = new.id;
  return new;
end $$;
create trigger on_auth_user_updated after update on auth.users
  for each row execute function public.handle_user_updated();

-- Bổ sung hồ sơ cho tài khoản đã tạo trước migration này
update public.app_users a
   set full_name = coalesce(a.full_name, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
       avatar_url = coalesce(a.avatar_url, u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture'),
       last_sign_in_at = u.last_sign_in_at
  from auth.users u
 where u.id = a.user_id;
