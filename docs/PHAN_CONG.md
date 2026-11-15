# Phân công Codex – Gemini – Claude Code

Quy tắc chung: [AGENTS.md](../AGENTS.md). File này là bảng việc; agent nhận việc thì ghi tên, nhánh và trạng thái ngay tại đây.

## Cách chia việc

- **Claude Code — phần lõi và nghiệp vụ.** Kiến trúc lõi, thêm loại thiết bị, đọc template/biên bản của đơn vị, diễn giải QĐ 1901, việc phải sửa nhiều lớp cùng lúc. Review PR của Codex.
- **Gemini (Gemini CLI) — việc có đặc tả rõ, ít chạm lõi, như Codex:** đang giữ X5 (X2, X3 chuyển cho Codex vì giới hạn gói miễn phí của API Gemini). Nhánh `gemini/<viec>`; Claude Code review PR.
- **Codex — việc có đặc tả rõ, ít chạm lõi:** tính năng giao diện độc lập, hàm thuần có test riêng, hạ tầng (migration, Storage), test tự động. Review PR của Claude Code khi chủ dự án yêu cầu.
- **Chủ dự án:** giao việc (dùng mẫu ở cuối file), cung cấp file nội bộ (template, biên bản, file đo — không đưa lên Git), chạy migration trên Supabase, duyệt và gộp PR.

Thứ tự gộp khi hai PR cùng sửa file dùng chung: PR mở trước gộp trước, PR sau rebase rồi chạy lại `npm test`.

## Bảng việc

Trạng thái: `Chưa nhận` · `Đang làm (agent, nhánh)` · `Chờ review (#PR)` · `Đã gộp` · `Chờ chủ dự án` (thiếu file / quyết định).

| # | Việc | Giao cho | Vùng file được sửa | Điều kiện | Trạng thái |
|---|---|---|---|---|---|
| X1 | **Nhập số liệu bằng giọng nói**: chọn ô, bấm micro, đọc số tiếng Việt ("một trăm hai mươi lăm phẩy ba" → 125,3); chế độ đọc liên tục sang ô kế; lệnh "lùi", "xóa", "dừng" | Codex | `js/domain/vn-number.js` (mới), `js/ui/voice-input.js` (mới), `test/vn-number.test.js` (mới); thêm nhỏ: `index.html`, `test/harness.js`, `css/app.css`, `js/ui/app.js` (gắn nút) | Không | Đã gộp (Claude Code review) |
| X2 | **Xu hướng ngay tại ô nhập**: ô có số liệu các lần trước hiện biểu đồ nhỏ, % thay đổi so với xuất xưởng và lần trước; tô vàng khi lệch xa | Codex | `js/domain/trend-inline.js` (mới, hàm thuần), `js/ui/trend-inline-ui.js` (mới), test mới; thêm nhỏ: `js/data/db.js` (hàm đọc lịch sử thiết bị), `js/ui/app.js`, `index.html`, `css/app.css` | Đã chạy migration 000100–000600 | Đã gộp (Claude Code + Codex review) |
| X3 | **Thư viện tiêu chuẩn**: bucket Storage riêng tư + bảng danh mục (số hiệu, phiên bản, loại thiết bị, file, tóm tắt .md); trang quản lý (Admin tải lên); khung "Tài liệu tham khảo" của từng hạng mục hiện tiêu chuẩn liên quan | Codex | migration mới, `js/data/db.js` (thêm hàm), `js/ui/standards-ui.js` (mới), `js/ui/workflow.js` (khung tham khảo), `index.html`, `css/app.css` | Danh mục mẫu: `TieuChuan/Danh_muc_tieu_chuan_IEC.xlsx` (ngoài repo). **Không** đưa file tiêu chuẩn lên Git | Đã gộp (Claude Code + Codex review); chủ dự án chạy migration 20261114000700 |
| X4 | **Test giao diện tự động** (Playwright) cho các luồng chính: nhập file 2293, xóa/hoàn tác, xuất .docx, bộ tiêu chí | Codex | `test/e2e/` (mới), workflow CI | **Chờ chủ dự án** đồng ý thêm gói npm `@playwright/test` | Chờ chủ dự án |
| X5 | **Bộ đọc file máy đo cấu hình được**: Admin khai báo ánh xạ cột CSV/Excel của máy mới (DV Power, Megger…) vào hạng mục, không phải viết mã | Gemini | `js/data/instruments/generic-csv.js` (mới), `js/ui/instrument-map-ui.js` (mới), migration mới | Sau X1–X3; cần 1–2 file mẫu của máy mới | Chưa nhận |
| X6 | **Phụ lục đáp ứng tần số điện môi (DFR/FDS) sứ đầu vào từ OMICRON DIRANA** | Codex | `js/data/instruments/dirana.js`, `js/domain/dfr.js`, `js/domain/appendix.js`, `js/domain/types/mba/report.js`, `js/data/docx.js`, `js/ui/types/mba/dfr-chart.js`, `js/ui/appendix-ui.js`, `js/ui/types/mba/ui.js`, `index.html`, `css/app.css`, `test/harness.js`, `test/dfr.test.js`, `README.md` | Chỉ dùng CSV giả trong repo; file mẫu thật chỉ đọc ngoài repo | Đã gộp (Claude Code review, Codex review) |
| X7 | **Tài liệu kiến thức dự án và hướng dẫn sử dụng** | Codex | `docs/KIEN_THUC.md` (mới), `docs/HUONG_DAN_SU_DUNG.md` (mới); thêm nhỏ: `README.md`, `docs/PHAN_CONG.md` | Nội dung đối chiếu mã nguồn, test, migration và lịch sử git | Đã gộp (Claude Code review) |
| X8 | **Nút Hướng dẫn sử dụng trên header + xem hướng dẫn ngay trong app** | Codex | `js/ui/help-ui.js` (mới), `index.html`, `css/app.css`, `.github/workflows/pages.yml`, `test/help.test.js` (mới), `README.md`, `docs/HUONG_DAN_SU_DUNG.md`, `docs/PHAN_CONG.md` | Không đổi snapshots; thử trên trình duyệt nếu khả thi | Đã gộp (Claude Code review) |
| X9 | **Mô hình 3D MBA: click bộ phận để mở hạng mục thí nghiệm** | Codex | `js/domain/types/mba/model3d-map.js` (mới), `js/ui/types/mba/model3d-ui.js` (mới), `test/model3d.test.js` (mới); thêm nhỏ: `index.html`, `test/harness.js`, `css/app.css`, `js/ui/app.js`, `README.md`, `docs/HUONG_DAN_SU_DUNG.md`, `docs/PHAN_CONG.md` | Lấy hạng mục động theo schema; giữ nguyên logic đánh giá | Đã gộp (#3, Claude Code review); sửa chọn cuộn dây/lõi từ: nhánh claude/m3d-cuon-day |
| X10 | **Module Dầu MBA**: liên kết app DGA và nạp BBTN dầu (.docx) làm phụ lục | Codex | `js/domain/appendix.js`, `js/domain/types/mba/report.js` (vòng phụ lục), `js/ui/appendix-ui.js`, `index.html` (thêm input file), `js/data/docx.js` (`lines()`), mô hình 3D: `js/domain/types/mba/model3d-map.js`, `js/ui/types/mba/model3d-ui.js`, `js/ui/app.js`, `test/model3d.test.js`, `test/oil-appendix.test.js` (mới), `css/app.css`, `README.md`, `docs/HUONG_DAN_SU_DUNG.md`, `docs/PHAN_CONG.md` | Chỉ dùng outline giả trong test; file mẫu thật chỉ đọc ngoài repo | Chờ review (#6) |
| X11 | **Quy trình thí nghiệm MBA theo hạng mục**: hướng dẫn đo và phụ lục thí nghiệm ngắn mạch, nhập số liệu, so sánh Test Report, đánh giá theo QĐ 1901 | Codex (`codex/quy-trinh-thi-nghiem-mba`) | `js/domain/types/mba/index.js`, `js/domain/types/mba/factory.js`, `js/domain/types/mba/report.js`, `js/domain/qd1901.js`, `js/domain/appendix.js`, `js/ui/appendix-ui.js`, `js/data/docx.js`, `js/domain/types/mba/schema.js`, `README.md`, `docs/HUONG_DAN_SU_DUNG.md`, `docs/PHAN_CONG.md` | Dùng dữ liệu Test Report đọc được; không đưa DOCX/XLSX/PDF nguồn vào repo công khai. Pk chỉ đánh giá khi quy đổi được về cùng điều kiện | Đang làm (Codex, codex/quy-trinh-thi-nghiem-mba) |
| C1 | **Nhập BBTN cũ** (.docx đã ban hành) vào CSDL làm chuỗi xu hướng; màn soát; nhập cả thư mục. Mẫu ưu tiên: MBA 110–220 kV (thêm mẫu xuất BBTN 3 pha 110–220) | Claude Code | `js/domain/types/mba/import-report.js` (mới), `js/ui/import-report-ui.js` (mới), `js/domain/report.js` (readValues), `js/domain/types/mba/schema.js` (mẫu 110), `to-rows.js` (nguồn manual), `js/data/docx.js` (bodyTableCount), `js/ui/app.js`, `index.html`, `test/mba-110.test.js` (mới) | Mẫu trống do chủ dự án cung cấp; chưa có BBTN thật đã điền để thử (thử bằng vòng xuất → nhập số liệu giả) | Đã gộp (Codex review) — chờ BBTN thật để thử thêm |
| C2 | **MBA 3 pha và kháng điện** (thuộc tính cấu tạo 1 pha / 3 pha; mô-đun kháng) | Claude Code | `js/domain/types/mba/`, `js/domain/types/kh/` (mới), `js/ui/types/` | **Chờ chủ dự án:** template BBTN MBA 3 pha, kháng 1 pha / 3 pha, Test report mẫu | Phần MBA 3 pha 110–220 kV làm cùng C1; còn chờ: kháng 1 pha / 3 pha, test report MBA 3 pha |
| C3 | **TI, TU** (loại thiết bị thứ hai, kiểm chứng lõi) | Claude Code | `js/domain/types/ti/`, `js/domain/types/tu/` (mới), `js/ui/types/` | **Chờ chủ dự án:** template BBTN TI, TU | Chờ chủ dự án |
| C4 | **Nhắc chu kỳ thí nghiệm định kỳ** theo QĐ 1901 (thiết bị sắp đến hạn, lập sẵn biên bản nháp) | Claude Code | `js/domain/periodic.js` (mới), `js/ui/db-ui.js` | Sau C1 (cần lịch sử thí nghiệm) | Chưa nhận |
| C5 | **Review PR của Codex** | Claude Code | — | Khi có PR | Thường xuyên |
| C6 | **Nhập Megger MRCT** (TI chân sứ mục 11): `.pdbxml` PowerDB + báo cáo PDF "CT TEST REPORT" → tỷ số, sai số, R, từ hóa, cực tính | Claude Code | `js/data/instruments/mrct.js`, `js/data/pdf-text.js`, `js/ui/types/mba/mrct-dialog.js` (mới), `test/mrct.test.js` (mới); thêm nhỏ: `cpc100.js` (nhãn nguồn khuỷu), `ui.js`, `index.html`, `css/app.css`, `test/harness.js` | — | Đã gộp (Codex review) |
| C7 | **Mẫu BBTN chung 3 pha** (tổ 3 máy 1 pha A, B, C trong một biên bản): biểu mẫu theo máy, đánh giá, CSDL, xuất BBTN, phụ lục BCT | Claude Code | `js/domain/types/mba/schema.js` (build3P), `evaluate.js`, `to-rows.js`, `report.js`, `index.js`, `js/domain/report.js`, `js/domain/appendix.js`, `js/data/docx.js` (số trang), `js/ui/app.js`, `js/ui/types/mba/ui.js`, `wa2293-dialog.js`, `tools/build_embedded.py`, `test/mba-3p.test.js` (mới) | Bản trống template tạo ngoài repo | Đã gộp (Codex review) |
| C8 | **Nhiều file xuất xưởng / test report sứ** (AT1, AT2…): bộ đọc nhận bố cục cột theo pha; app giữ nhiều file, tự chọn theo số chế tạo; gộp test report sứ theo S/N | Claude Code | `js/domain/types/mba/factory.js`, `js/domain/bushing-hitachi.js`, `js/ui/app.js`, `js/ui/types/mba/ui.js`, `test/factory-layouts.test.js` (mới), README | File mẫu ngoài repo (MBA/Test report) | Đã gộp |
| C9 | **Vị trí số liệu BCT trong BBTN mẫu 3 pha chung**: tùy chọn đưa vào thân biên bản tại mục 13 hoặc đính kèm cuối BBTN như phụ lục (mặc định phụ lục như trước) | Claude Code | `js/domain/types/mba/report.js`, `js/domain/types/mba/index.js` (cfg `bctPlace`), `js/data/docx.js` (chèn khối sau đoạn văn), `js/ui/types/mba/ui.js`, `test/mba-3p.test.js` | Không đổi snapshots | Chờ review (#5) |

## Mẫu giao việc cho Codex / Gemini

Dán vào Codex hoặc Gemini CLI, thay `<X…>` bằng số việc; với Gemini dùng nhánh `gemini/<ten-viec>` và ghi "Đang làm (Gemini, gemini/<ten-viec>)":

```
Đọc AGENTS.md và docs/PHAN_CONG.md. Nhận việc <X1> trong bảng phân công:
1. Tạo nhánh codex/<ten-viec> từ main mới nhất; ghi "Đang làm (Codex, codex/<ten-viec>)" vào dòng <X1> trong docs/PHAN_CONG.md.
2. Chỉ sửa các file trong "Vùng file được sửa" của việc này; cần sửa file khác thì sửa nhỏ, chỉ thêm, và ghi lý do trong PR.
3. Viết test cho phần hàm thuần; npm test phải xanh; test ảnh chụp (test/snapshots) không được đổi.
4. Không commit số liệu thật, js/config.js, js/embedded.js, file .docx/.xlsx/.pdf.
5. Mở PR vào main, mô tả bằng tiếng Việt: làm gì, đã thử gì, chưa thử gì, migration cần chạy (nếu có).
```

Gợi ý đặc tả thêm cho từng việc (dán kèm khi giao):

- **X1 – giọng nói:**
  - Dùng Web Speech API (`webkitSpeechRecognition`, `lang = 'vi-VN'`); trình duyệt không hỗ trợ thì ẩn nút.
  - Hàm thuần `VnNumber.parse(text)` trong lớp nghiệp vụ hiểu:
    - "phẩy" / "chấm" là dấu thập phân;
    - "nghìn / ngàn", "triệu", "lẻ / linh", "mươi / mười", "mốt", "tư", "lăm / nhăm";
    - số âm "âm …";
    - chữ số đọc liền ("không phẩy không bốn").
  - Chế độ liên tục đi theo thứ tự hàng → cột như phím Enter đang làm.
  - Ghi vào ô bằng đúng đường nhập tay (sự kiện `input` + `change`), để hoàn tác theo hạng mục và tô nền đọc ảnh vẫn hoạt động.
- **X2 – xu hướng tại ô:**
  - Chuỗi so sánh theo cùng thiết bị, hạng mục, đại lượng, sơ đồ, pha, nấc; dùng **giá trị đã quy đổi** (20 °C, 75 °C) như trang Xu hướng (`v_trend_delta`).
  - Tải một lần khi mở biên bản đã gắn thiết bị, lưu tạm để dùng khi mất mạng.
  - Không đổi kết quả đánh giá: chỉ hiển thị.
- **X3 – thư viện tiêu chuẩn:**
  - Bucket riêng tư.
  - RLS: người đã đăng nhập (vai trò khác `none`) xem; admin tải lên, sửa, xóa.
  - Khung tham khảo: hiện QĐ 1901 (như hiện nay) cộng các tiêu chuẩn gắn với hạng mục; mở file qua URL ký tạm thời.
