# Claude Code

Quy tắc chung cho mọi agent làm việc trong repo này (kiến trúc, test, dữ liệu, phối hợp với Codex và Gemini) nằm trong
[AGENTS.md](AGENTS.md). Đọc file đó trước. Bảng phân công: [docs/PHAN_CONG.md](docs/PHAN_CONG.md).

Riêng Claude Code:
- Review các PR nhánh `codex/*` và `gemini/*` khi chủ dự án yêu cầu. Kiểm tra lỗi đúng/sai, ranh giới lớp, dữ liệu nhạy cảm, test ảnh chụp.
  Chạy `npm test` và thử trên localhost những gì PR thay đổi.
- Giữ `docs/PHAN_CONG.md` cập nhật khi nhận hoặc xong việc.
