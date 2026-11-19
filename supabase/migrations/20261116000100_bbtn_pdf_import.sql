-- Cho phép lưu file PDF BBTN gốc cạnh dữ liệu thí nghiệm đã nhập.
-- RLS và Storage policy hiện hữu của documents/test-documents tiếp tục được áp dụng.
alter table public.documents
  drop constraint if exists documents_kind_check;

alter table public.documents
  add constraint documents_kind_check
  check (kind in ('BBTN_DOCX', 'BBTN_PDF', 'FACTORY_REPORT', 'TEMPLATE', 'PHOTO', 'OTHER'));

comment on constraint documents_kind_check on public.documents is
  'Loại tài liệu BBTN, gồm DOCX/PDF gốc, báo cáo xuất xưởng, template và ảnh hiện trường.';
