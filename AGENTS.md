# Hướng dẫn cho agent lập trình (Codex, Gemini, Claude Code)

Repo này do **ba agent cùng làm**: Codex, Gemini (Gemini CLI) và Claude Code. Người dùng (chủ dự án) giao việc, duyệt và quyết định gộp.
Đọc hết file này trước khi sửa mã. Bảng phân công và trạng thái từng việc: [docs/PHAN_CONG.md](docs/PHAN_CONG.md).

## Dự án

**Site Test Report**: web app tĩnh (GitHub Pages) lập biên bản thí nghiệm hiện trường (BBTN) thiết bị nhất thứ.
- Đánh giá theo **QĐ 1901/QĐ-EVNNPT**, so với số liệu xuất xưởng.
- Xuất BBTN `.docx` theo template của đơn vị; lưu CSDL Supabase.
- Loại thiết bị đã có: máy biến áp (MBA). TI, TU, máy cắt… làm theo lộ trình.

- Vanilla JS, mỗi file là một IIFE gán vào `window` (không bundler, không framework, không `import`).
- Thư viện vendor trong `js/vendor/` (JSZip, SheetJS, supabase-js); thư viện tải khi dùng chỉ từ CDN jsdelivr, ghim phiên bản.
- Giao diện, chú thích mã, câu chữ trong app: **tiếng Việt**.

## Ba lớp — không được gọi tắt

| Lớp | Thư mục | Chứa | Không được |
|---|---|---|---|
| Nghiệp vụ | `js/domain/` | Hàm thuần: QĐ 1901, bộ tiêu chí, hạng mục dùng chung, mô-đun thiết bị `types/<loại>/` | DOM, `document.`, `localStorage`, `fetch`, gọi `DB.` trực tiếp, `App.`, `Notify` |
| Dữ liệu | `js/data/` | Supabase (`db.js`), đọc/ghi .docx, bộ đọc máy đo `instruments/`, OCR, kho file | Quyết định Đạt/Không đạt |
| Giao diện | `js/ui/` | Trang, hộp thoại, `types/<loại>/` cho phần riêng của loại thiết bị | Truy vấn Supabase trực tiếp (đi qua `js/data/db.js`) |

- `test/layers.test.js` kiểm tra tự động các ranh giới trên. Nó cũng kiểm tra `index.html` nạp đủ mọi file `js/domain|data|ui`, theo thứ tự domain → data → ui.
- Thêm file mới thì phải thêm thẻ `<script>` vào `index.html` đúng nhóm. File thuộc lớp nghiệp vụ cũng phải thêm vào `DOMAIN` trong `test/harness.js`.
- Loại thiết bị đăng ký bằng `EquipmentTypes.register({...})`; xem `js/domain/types/mba/index.js`.
- Ngưỡng đánh giá lấy từ `Criteria.limits()`, **không** dùng thẳng `QD.LIMITS`. Phép so sánh dùng chung nằm trong `TestItems` (`js/domain/test-items.js`).

## Chạy và kiểm tra

```
npm test                      # node --test test/*.test.js — Node 22, không cần cài gói
start.bat                     # http://localhost:8000 (python -m http.server)
```

- **Mọi PR phải giữ `npm test` xanh.** GitHub Actions chạy test cho mỗi PR và trước bước triển khai Pages.
- **Test ảnh chụp:** `test/snapshots/evaluate.json` và `to-rows.json` khóa kết quả đánh giá MBA và các dòng CSDL.
  - Đổi một trong hai file này nghĩa là đổi kết quả BBTN của người dùng.
  - Chỉ cập nhật khi việc được giao yêu cầu đổi kết quả: chạy `UPDATE_SNAPSHOTS=1 node --test test/*.test.js` (PowerShell: `$env:UPDATE_SNAPSHOTS=1; node --test test/`).
  - Ghi rõ trong PR dòng nào đổi và vì sao.
- Tính năng có giao diện: chạy thử trên localhost (Playwright có sẵn trên máy chủ dự án qua Python). Báo trong PR những gì đã thử và chưa thử được.
- Test dùng **số liệu giả**, không dùng số liệu thật (xem mục dưới).

## Dữ liệu và bảo mật — bắt buộc

Repo là **công khai**.
- **Không commit:** `js/embedded.js`, `js/config.js`, file `.docx .xlsx .xlsm .pdf`, ảnh nameplate, file đo thật (`.csv .bin .frax…`), biên bản thật, số chế tạo / tên trạm thật trong test.
- **Không commit** văn bản tiêu chuẩn có bản quyền (IEC, IEEE, GB/T, DL/T…).
- **Supabase:** chỉ dùng anon key trong app, không bao giờ dùng `service_role`.
- Thay đổi CSDL: thêm file migration mới trong `supabase/migrations/` (tên `YYYYMMDDHHMMSS_mo_ta.sql`), có RLS. Không sửa migration đã gộp. Chủ dự án tự chạy migration trên Supabase, nên PR phải nhắc tên migration cần chạy.

## Quy tắc nghiệp vụ không được tự đổi

- **Kết quả đánh giá MBA:** không đổi nếu việc được giao không yêu cầu (test ảnh chụp sẽ đỏ).
- **Quy đổi theo QĐ 1901** (đã xác nhận với chủ dự án):
  - tgδ sứ: tgδ20 = tgδ(t) × K.
  - tgδ cuộn dây: chia K2, K2(16 °C) = 2,4 đúng nguyên văn.
  - R một chiều: R2 = R1·(235+t2)/(235+t1).
- **Không tự tạo ngưỡng.** Chỗ QĐ 1901 không nêu ngưỡng thì ghi "Tham khảo" / "Cần xem xét" kèm căn cứ.
- **Không đổi khóa lưu trình duyệt** `bbtn-mba.*`, nếu đổi người dùng mất biên bản đang nhập.
- **Biên bản cũ phải mở được:** file .json, bản lưu trình duyệt và bản lưu CSDL. Thêm trường mới thì có giá trị mặc định khi đọc biên bản cũ (`normalizeCfg`, `loadState`).

## Phối hợp giữa các agent

- **Mỗi việc một nhánh, một PR.** Nhánh `codex/<viec>`, `gemini/<viec>` hoặc `claude/<viec>`, tách từ `main` mới nhất. Không push thẳng `main`.
- Trước khi bắt đầu, **ghi tên mình và nhánh vào dòng việc** trong `docs/PHAN_CONG.md`. Việc đang có người nhận thì không làm.
- **Vùng file:** mỗi việc trong bảng phân công ghi rõ các file được sửa.
  - Cần sửa file ngoài vùng: sửa nhỏ, chỉ thêm, không tái cấu trúc, và ghi trong PR.
  - Các file dùng chung (`js/ui/app.js`, `index.html`, `css/app.css`, `README.md`, `test/harness.js`) hay xung đột: chỉ thêm đoạn mới, không sắp xếp lại; rebase lên `main` trước khi mở PR.
- **Review chéo:** PR của Codex và của Gemini do Claude Code review; PR của Claude Code do Codex review; chủ dự án duyệt và gộp. Review tập trung vào lỗi đúng/sai, ranh giới lớp, dữ liệu nhạy cảm, test ảnh chụp.
- **Xong việc:**
  - Cập nhật trạng thái trong `docs/PHAN_CONG.md`.
  - Cập nhật `README.md` nếu đổi chức năng người dùng thấy.
  - Mô tả PR bằng tiếng Việt: làm gì; đã thử gì; còn gì chưa thử; migration cần chạy.
- Commit message tiếng Việt, dòng đầu ngắn gọn.

## Phong cách mã

- Giữ đúng cách viết của file xung quanh: IIFE, `'use strict'`, hàm ngắn, chú thích tiếng Việt vừa đủ ở đầu file và chỗ khó hiểu.
- Không thêm framework, bundler, TypeScript hay gói npm khi chủ dự án chưa đồng ý.
- **Giao diện:**
  - Dùng các lớp CSS sẵn có (`.btn`, `.field`, `.callout`, `.badge st-*`, `.ftable`, `.grid`).
  - Màu lấy từ biến trên `:root`.
  - Không tràn ngang ở bề rộng 390 px.
  - Có nhãn cho ô nhập và `aria-label` cho nút chỉ có ký hiệu.
- Câu chữ: tiếng Việt rõ ràng, viết theo cách người thí nghiệm hiểu. Thông báo lỗi nói cái gì sai và cách sửa.
