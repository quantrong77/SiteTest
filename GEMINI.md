# Gemini CLI

Quy tắc chung cho mọi agent làm việc trong repo này (kiến trúc, ba lớp, test, dữ liệu và bảo mật, phối hợp với Codex và
Claude Code) nằm trong [AGENTS.md](AGENTS.md). Đọc file đó trước. Bảng phân công: [docs/PHAN_CONG.md](docs/PHAN_CONG.md).

Riêng Gemini:
- Chỉ nhận việc ghi "Gemini" ở cột "Giao cho" (hiện có X5). Nhánh `gemini/<ten-viec>` tách từ `main` mới nhất;
  ghi "Đang làm (Gemini, gemini/<ten-viec>)" vào dòng việc trước khi bắt đầu.
- Chỉ sửa file trong "Vùng file được sửa" của việc; file dùng chung chỉ thêm đoạn mới.
- `npm test` phải xanh; không đổi `test/snapshots/`. Test dùng số liệu giả.
- Repo công khai: không commit `js/config.js`, `js/embedded.js`, file .docx/.xlsx/.pdf, file đo thật, số chế tạo / tên trạm thật.
  Supabase chỉ dùng anon key; thay đổi CSDL bằng migration mới có RLS, chủ dự án tự chạy.
- Xong việc: chuyển trạng thái thành "Chờ review (Claude Code)", báo cáo bằng tiếng Việt: làm gì, đã thử gì, chưa thử gì,
  migration cần chạy.
