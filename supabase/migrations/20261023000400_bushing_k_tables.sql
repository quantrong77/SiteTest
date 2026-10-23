-- Bảng hệ số quy đổi tgδ sứ xuyên về 20 °C (QĐ 1901 và theo hãng).
-- Mọi người dùng đã đăng nhập được đọc; chỉ admin được thêm/sửa/xóa.
create table public.bushing_k_tables (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  basis         text not null default 'MANUFACTURER' check (basis in ('QD1901', 'MANUFACTURER')),
  manufacturer  text,                                  -- hãng sứ (bỏ trống với bảng QĐ 1901)
  columns       text[] not null,                       -- loại cách điện theo thứ tự cột K: {OIP,RIP}
  rows          jsonb not null,                        -- [[t °C, K cột 1, K cột 2, …], …]
  formula       text not null default 'MUL' check (formula in ('DIV', 'MUL')),   -- tgδ20 = tgδ × K | ÷ K
  lookup        text not null default 'NEAREST' check (lookup in ('NEAREST', 'LINEAR')), -- tra dòng gần nhất | nội suy
  note          text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid default auth.uid() references auth.users(id) on delete set null,
  constraint bushing_k_rows_array check (jsonb_typeof(rows) = 'array'),
  constraint bushing_k_columns_nonempty check (cardinality(columns) > 0)
);
create trigger bushing_k_tables_touch before update on public.bushing_k_tables
  for each row execute function public.touch_updated_at();

alter table public.bushing_k_tables enable row level security;
create policy bushing_k_read on public.bushing_k_tables for select to authenticated
  using (public.current_role_name() <> 'none');
create policy bushing_k_admin on public.bushing_k_tables for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.bushing_k_tables to authenticated;

-- Bảng QĐ 1901 (file Cauhinh/Kquidoi_1901.xlsx): t 17–60 °C, cột OIP / RIP
insert into public.bushing_k_tables (name, basis, columns, rows, formula, lookup, note) values (
  'QĐ 1901 – hệ số quy đổi tgδ sứ về 20 °C', 'QD1901', '{OIP,RIP}',
  '[[17,0.95,0.93],[18,1,1],[19,1,1],[20,1,1],[21,1,1],[22,1,1],[23,1.05,1.07],[24,1.05,1.07],[25,1.05,1.07],[26,1.05,1.07],[27,1.05,1.07],[28,1.1,1.14],[29,1.1,1.14],[30,1.1,1.14],[31,1.1,1.14],[32,1.1,1.14],[33,1.15,1.21],[34,1.15,1.21],[35,1.15,1.21],[36,1.15,1.21],[37,1.15,1.21],[38,1.2,1.27],[39,1.2,1.27],[40,1.2,1.27],[41,1.2,1.27],[42,1.2,1.27],[43,1.25,1.33],[44,1.25,1.33],[45,1.25,1.33],[46,1.25,1.33],[47,1.25,1.33],[48,1.25,1.33],[49,1.3,1.37],[50,1.3,1.37],[51,1.3,1.37],[52,1.3,1.37],[53,1.34,1.41],[54,1.34,1.41],[55,1.34,1.41],[56,1.34,1.41],[57,1.34,1.41],[58,1.35,1.43],[59,1.35,1.43],[60,1.35,1.43]]'::jsonb,
  'MUL', 'NEAREST', 'tgδ20 = tgδ(t) × K; t = nhiệt độ sứ (lấy bằng nhiệt độ dầu MBA – Điều 38)'
) on conflict (name) do nothing;
