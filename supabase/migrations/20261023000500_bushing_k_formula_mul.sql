-- QĐ 1901: tgδ sứ quy đổi về 20 °C = tgδ(t) × K (sửa bảng đã nạp bằng migration 000400 bản đầu, khi đó ghi ÷ K)
alter table public.bushing_k_tables alter column formula set default 'MUL';
update public.bushing_k_tables
   set formula = 'MUL', note = replace(note, 'tgδ20 = tgδ(t) ÷ K', 'tgδ20 = tgδ(t) × K')
 where basis = 'QD1901' and formula = 'DIV';
