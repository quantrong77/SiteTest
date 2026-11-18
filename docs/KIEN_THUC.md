# Kiến thức dự án Site Test Report

Tài liệu này mô tả kiến trúc và các hợp đồng chính của mã nguồn hiện có.
Nó tập trung vào luồng MBA đang triển khai; các loại thiết bị khác là lộ trình.

## 1. Phạm vi và nguồn sự thật

- Repo là web app tĩnh dùng GitHub Pages.
- Ứng dụng lập biên bản thí nghiệm hiện trường thiết bị nhất thứ.
- MBA là loại thiết bị đã triển khai sâu nhất.
- Kết quả MBA được đánh giá theo QĐ 1901/QĐ-EVNNPT và so với xuất xưởng.
- BBTN được xuất thành DOCX dựa trên template của đơn vị.
- Các phiên và số đo có thể lưu trong Supabase.
- Mã giao diện, chú thích và tài liệu người dùng viết bằng tiếng Việt.
- Kiến trúc là Vanilla JavaScript, không bundler và không `import`.
- Mỗi tệp JavaScript dùng IIFE và gắn API lên `window`.
- `index.html` là điểm lắp ráp các script.
- Mã nguồn trong repo là nguồn sự thật về hành vi hiện tại.
- `README.md` diễn giải tính năng và quy trình ở mức người dùng.
- `AGENTS.md` đặt quy tắc kỹ thuật và bảo mật cho agent.
- `docs/PHAN_CONG.md` ghi phạm vi, người nhận và trạng thái việc.
- Test và snapshot khóa các kết quả tính toán quan trọng.
- Template nội bộ và số liệu thật nằm ngoài repo công khai.

## 2. Ba lớp kiến trúc

| Lớp | Thư mục | Trách nhiệm | Ranh giới |
|---|---|---|---|
| Nghiệp vụ | `js/domain/` | Hàm thuần, schema, đánh giá, quy đổi | Không DOM, lưu trình duyệt, mạng, DB, App hoặc Notify |
| Dữ liệu | `js/data/` | Supabase, DOCX, OCR, file và bộ đọc máy đo | Không quyết định Đạt/Không đạt |
| Giao diện | `js/ui/` | Trang, biểu mẫu, hộp thoại, sự kiện | Gọi DB qua `js/data/db.js` |

`test/layers.test.js` kiểm tra các ranh giới trên.
Test cũng xác nhận `index.html` tải đủ file trong ba lớp.
Thứ tự script bắt buộc là domain, rồi data, rồi ui.
File nghiệp vụ mới phải được khai báo trong `test/harness.js` ở mảng `DOMAIN`.
Mọi file JS mới phải được nạp trong đúng nhóm tại `index.html`.

## 3. Luồng dữ liệu tổng quát

```text
Người dùng / file máy đo / file xuất xưởng / BBTN cũ
                         │
                         ▼
                  js/ui/* giao diện
                         │ nhập tay hoặc bộ đọc
                         ▼
              state = { type, v, cfg, sum, att, db }
                         │
             Type.buildSchema(cfg) → schema
                         │
                         ▼
           Type.evaluate(state, schema, criteria)
                         │
                         ▼
               res = kết quả tính và đánh giá
          ┌──────────────┼─────────────────┐
          │              │                 │
       findings         calc             notes
          │              │                 │
          └──────────────┴──── sec ────────┘
                         │
          ┌──────────────┴────────────────────┐
          ▼                                   ▼
 Type.report.fill → DOCX             Type.toRows → rows
          │                                   │
          ▼                                   ▼
     tải .docx                     Records.saveField → DB
                                              │
                                              ▼
                                      Supabase session,
                                      measurements,
                                      test_findings
```

`state.v` chứa giá trị theo khóa schema.
`state.cfg` chứa mẫu, cấu hình hạng mục, nhãn, nấc và cấu tạo.
`state.sum` giữ trạng thái đánh giá do người dùng chỉnh ở màn tổng hợp.
`state.att` giữ file và dữ liệu phụ lục, OCR, dạng sóng.
`state.db` ghi định danh phiên CSDL gắn với biên bản hiện hành.
`state.type` định danh mô-đun thiết bị.
Một hồ sơ cũ không có `type` được đọc như MBA.

Khóa ô lưới có dạng `${grid}.${row}.${col}`.
Trường đơn có khóa văn bản như `meta.serial` hoặc `b.hv.t`.
`recompute()` dựng lại `schema` và `res` từ state hiện tại.
Màn hình không coi dữ liệu nhập là dữ liệu đã được đánh giá.
Kết quả xuất và lưu được tạo từ state cùng kết quả tính lại.

## 4. Lưu trữ trình duyệt và tương thích

- Khóa lưu trình duyệt bắt đầu bằng `bbtn-mba.`.
- Không đổi các khóa này nếu không có yêu cầu chuyển đổi dữ liệu.
- `loadState` nhận biên bản JSON và áp mặc định cho trường thiếu.
- Mô-đun thiết bị có `normalizeCfg` để bổ sung cấu hình cũ.
- `state.att` có thể chứa tham chiếu file trong IndexedDB.
- File JSON có thể mang file phụ lục đã tuần tự hóa.
- Ctrl+Z hoặc Cmd+Z khi không focus ô nhập gọi hoàn tác hạng mục hiện tại.
- Trong ô nhập, tổ hợp đó vẫn để trình duyệt hoàn tác ký tự đang gõ.
- Lịch sử chỉnh sửa theo hạng mục nằm trong phiên làm việc, không phải lịch sử lâu dài.
- Xóa một hạng mục có thể được hoàn tác trong phiên đó.

## 5. Các kiểu schema và số mục

Schema ánh xạ khóa nghiệp vụ vào các bảng, hàng, cột của DOCX.
Mẫu theo pha và mẫu 110 dùng cùng số mục (110 dựng từ mẫu theo pha, chỉ ánh xạ lại chỉ số bảng).
Mẫu chung 3P tổ chức lại nội dung theo ba MBA một pha và đánh số khác (`id` mục giống nhau, `no` khác).

| `id` mục | Hạng mục | Mẫu theo pha / 110 (`no`) | Mẫu chung 3P (`no`) | Ghi chú 3P |
|---|---|---:|---:|---|
| `visual` | Kiểm tra bên ngoài | 1 | 1 | 9 hạng mục kiểm tra |
| `noload` | Dòng điện và tổn hao không tải | 2 | 2 | theo máy A, B, C |
| `ir` | Điện trở cách điện | 3 | 3 | theo máy, có R180, R360 |
| `vector` | Tổ đấu dây | 4 | 4 | |
| `bushing` | Sứ đầu vào | 5 | 5 | 5 nhóm sứ, nhiệt độ từng sứ |
| `wtgd` | Tgδ và điện dung cuộn dây | 6 | 7 | theo máy |
| `dcr` | Điện trở một chiều | 7 | 8 | 17 nấc, nhiệt độ theo máy |
| `ratio` | Tỷ số biến | 8 | 9 | |
| `oltc` | OLTC | 9 | 11 | số vòng theo pha |
| `moisture` | Độ ẩm cách điện cứng | 10 | 10 | theo pha |
| `bct` | Biến dòng chân sứ | 11 | 13 | không có bảng trong thân BBTN → phụ lục |

Mẫu 3P không có mục số 6 và 12 trong app; ở bảng tổng hợp trang 1 của template 3P, dòng 12 là SFRA (đánh dấu khi có phụ lục SFRA).
Khi viết hướng dẫn theo quy trình, cần nêu rõ đang nói về mẫu nào.

Trong `schema.js`, `layoutOf(cfg)` xác định `1P`, `3P` hoặc `110`.
`build(cfg)` gọi `build3P` cho mẫu 3P.
Với mẫu 110, schema cơ sở được remap theo `MAP_110`.
Mẫu theo pha sử dụng `build1P`.
Các template nhận diện dựa trên số bảng và cấu trúc đọc được.
Đó là heuristic cấu trúc, không thay thế việc kiểm tra template thực tế.

## 6. Hợp đồng các API chính

Bảng dưới tóm tắt API toàn cục đọc từ mã nguồn hiện tại.
Tham số được ghi ở mức vai trò; xem hàm nguồn để biết chi tiết cấu trúc.

| Mô-đun | API | Tham số chính | Trả về / tác dụng |
|---|---|---|---|
| `Schema` | `build(cfg)` | Cấu hình mẫu | Schema sections, head, tail, layout, số bảng |
| `Schema` | `layoutOf(cfg)` | Cấu hình | Mã layout `1P`, `3P`, `110` |
| `Schema` | `eachGrid`, `eachField` | Schema, callback | Duyệt cấu trúc lưới/trường |
| `Evaluate` | `evaluate(state, FX, schema)` | State, bộ đọc xuất xưởng (hoặc null), schema | `res` = { findings, calc, notes, sec } |
| `Evaluate` | `autoConclusion(res, schema, state)` | Kết quả, schema, state | Văn bản kết luận gợi ý |
| `MbaRows` | `fieldRows(state, res, schema, { withKey })` | State, kết quả, schema | `{ mainRef, refs, rows, session, findings }`; `withKey` kèm khóa ô (xu hướng tại ô) |
| `MbaRows` | `factorySessions(...)` | Dữ liệu xuất xưởng | Các phiên FAT và dòng đo tương ứng |
| `MbaReport` | `fill(tpl, ctx)` | Template đã mở, state/res/schema/assets | DOCX đã điền và thống kê ô thiếu |
| `MbaReport` | `oltcAppendix(...)` | State, cấu hình sóng | Bảng và đồ thị phụ lục OLTC |
| `MbaReport` | `bctAppendix(...)` | State/schema | Nội dung phụ lục BCT |
| `Report` | `readDefaults(tpl, schema)` | Template, schema | Giá trị mặc định đọc từ mẫu |
| `Report` | `readValues(tpl, schema, { all })` | Template, schema | Giá trị ô nhập đọc theo ánh xạ xuất (bỏ ô tự tính); `all` đọc cả ghi chú/kết luận |
| `Report` | `prepare(tpl, schema)` | Template, schema | Chèn hàng template còn thiếu (`ensureRow`) trước khi đọc/ghi |
| `DocxTemplate` | `load(data)` | Blob/ArrayBuffer/base64 phù hợp | Đối tượng template có bảng/đoạn |
| `DocxTemplate` | `writeField`, `appendSection` | Trường hoặc section | Ghi ô/đoạn hoặc nối phụ lục |
| `DocxTemplate` | `bodyTableCount(...)` | Tài liệu DOCX | Số bảng phần thân |
| `Factory` | `fromArrayBuffer(buf, name)` | Buffer, tên file | Bộ đọc xuất xưởng đã parse |
| `Factory` | `fromBase64(b64, name)` | Base64, tên file | Bộ đọc xuất xưởng đã parse |
| `Factory` | `norm`, `num`, `cfgKey` | Giá trị đầu vào | Chuẩn hóa chuỗi, số, khóa cấu hình |
| `HitachiBushing` | `fromArrayBuffer(buf,name,opts)` | XLSX, tên, tùy chọn | Nạp/gộp test report sứ |
| `HitachiBushing` | `to20`, `compare`, `report` | Số đo, nhiệt độ, S/N | Quy đổi, so sánh, tóm tắt |
| `BushingK` | `resolve`, `lookup`, `convert` | Chế độ, sứ, nhiệt độ, tgδ | Hệ số và giá trị quy đổi |
| `BushingK` | `fromArrayBuffer`, `fromSheet` | XLSX hoặc sheet | Đọc bảng hệ số |
| `Criteria` | `limits()` | Không | Ngưỡng QĐ gốc sau override áp dụng |
| `Criteria` | `list`, `setOverrides`, `changedText` | Override/danh sách | Danh sách cấu hình và mô tả thay đổi |
| `Records` | `setRepo(repo)` | Repository | Gắn adapter dữ liệu |
| `Records` | `saveField(state,res,schema,...)` | State, kết quả, schema | Lưu phiên và dòng đo qua adapter |
| `Records` | `importFactory(...)` | Test report và cấu hình | Nhập phiên FAT qua adapter |
| `DB` | `connect`, `cfgGet`, `checkConfig` | URL, anon key/cấu hình | Kết nối và thông tin trạng thái |
| `DB` | `signIn`, `signInWithGoogle`, `signOut` | Thông tin đăng nhập | Thao tác phiên xác thực |
| `DB` | `saveField`, `listSessions`, `loadSession` | Phiên/định danh | Lưu, liệt kê, tải biên bản |
| `DB` | `trend`, `trendForSerials` | Thiết bị/số chế tạo | Dữ liệu xu hướng |
| `DB` | `listLibrary`, `saveLibraryDoc` | Bộ lọc/tài liệu | Danh mục thư viện và thao tác admin |
| `Appendix` | `list`, `fraSummary`, `fraHeader` | State/file SFRA | Danh sách, tóm tắt, đầu mục phụ lục |
| `Dfr` | `table`, `appendix`, `chosen` | File DIRANA, lựa chọn | Bảng, dữ liệu và nội dung phụ lục |
| `Library` | `parseCatalog`, `forSection`, `mergeImport` | Danh mục/section | Chuẩn hóa và lọc tài liệu |
| `TrendInline` | `series`, `warn`, `pct` | Các điểm/giá trị | Chuỗi so sánh, cảnh báo, phần trăm |
| `MbaImportReport` | `detectLayout(nTables)`, `normDate`, `read(tpl, fileName)` | Số bảng phần biên bản; DocxTemplate | Mã layout; `{ state, layout, count, warnings }` |

`DB` là API tích hợp, không phải nơi quyết định Đạt/Không đạt.
`Records` giữ lớp domain gọi một repository đã được tiêm vào.
`Criteria.limits()` là nguồn ngưỡng áp dụng cho evaluate.
Không sử dụng trực tiếp `QD.LIMITS` làm ngưỡng runtime.

## 7. Template DOCX và ánh xạ schema

Mỗi trường DOCX có thể chỉ ra vị trí bảng/hàng/cột.
`doc: { t, r, c }` định vị một ô trong bảng.
Chỉ số bảng trong mã bắt đầu từ 0 ở API DOCX.
`doc: { before, re }` tìm đoạn văn khớp `re` nằm giữa bảng `before - 1` và bảng `before`.
Khe trống dạng `(?<v>\s*)` chỉ khớp khi chưa điền; `Report.readValues` nới lỏng khe này khi đọc BBTN đã điền.
Nhóm regex thường có `(?<v>...)` để xác định vùng thay thế.
`slot` (ở cột lưới) là regex của ô có nhãn cố định quanh giá trị (vd "Nấc đến: … (Tap position to)"): chỉ đọc/ghi phần nhóm `v`.
`ensureRow` trong đường ghi đảm bảo có hàng cần thiết trước khi điền.
`gridSpan` biểu diễn ô gộp cột trong bảng Word.
Một bảng có thể được tách trang và biểu diễn bởi nhiều chỉ số bảng.

Khi thêm trường, xác nhận cả vị trí đọc và ghi.
Đối chiếu template trắng của đúng layout ở ngoài repo.
Không đưa template nội bộ lên Git để minh họa mapping.
Test có thể dựng DOCX tối giản với số liệu giả.
Template có số bảng lệch có thể vẫn mở nhưng ghi sai vị trí.
Ứng dụng cảnh báo số bảng không khớp chuẩn trong các luồng xuất.

## 8. Ngưỡng và tiêu chí QĐ 1901 trong mã

`QD.LIMITS` lưu giá trị gốc được khai báo trong `js/domain/qd1901.js`.
`QD.LIMIT_INFO` mô tả nhãn, đơn vị, mục và căn cứ cho các khóa được cấu hình.
Các bảng tra như K1, K2, Bảng 5 không phải đều là khóa trong `LIMITS`.
Bảng sau chép các khóa `LIMITS` hiện tại và thông tin nguồn trong mã.

| Khóa | Giá trị mặc định | Đơn vị | Căn cứ/mục |
|---|---:|---|---|
| `DCR_DEV` | 2 | % | Điều 9 mục 7 |
| `RATIO_DEV` | 0,5 | % | Điều 9 mục 6; Điều 33 |
| `WINDING_C_DEV` | 5 | % | Điều 9 mục 5 |
| `WINDING_TGD_OK` | 1 | % | Điều 9 mục 5; tiêu chí hiện trường trong mã |
| `WINDING_TGD_RISE` | 30 | % | Điều 30 |
| `IR_DROP` | 30 | % | Điều 9 mục 4 |
| `BUSHING_C1_DEV` | 5 | % | Điều 38 mục 3c |
| `BUSHING_TGD_RISE_FAIL` | 100 | % | Điều 38 mục 3a |
| `BUSHING_TGD_RISE_WARN` | 70 | % | Điều 38 mục 3a |
| `CORE_NEW` | 500 | MΩ | Điều 9 Bảng 1, ghi chú a |
| `CORE_OLD` | 100 | MΩ | Điều 9 Bảng 1, ghi chú a |
| `NOLOAD_1PH_NEW` | 10 | % | Điều 34 |
| `NOLOAD_OPER` | 15 | % | Điều 34 |
| `BCT_IR_MIN` | 200 | MΩ | Điều 39, khi NSX không quy định |
| `BUSHING_AC_PCT` | 85 | % | Điều 38 mục 2 |
| `KHT_HEALTHY` | 1,3 | tỷ số | Điều 29 |

Các khóa sau có mô tả trong `LIMIT_INFO`; các khóa này đều cũng nằm trong `LIMITS`.

| Khóa mô tả | Đơn vị | Nguồn trong mã |
|---|---|---|
| `NOLOAD_1PH_NEW` | % | Điều 34 |
| `NOLOAD_OPER` | % | Điều 34 |
| `IR_DROP` | % | Điều 9 mục 4 |
| `KHT_HEALTHY` | tỷ số | Điều 29 |
| `CORE_NEW` | MΩ | Điều 9 Bảng 1 ghi chú a |
| `CORE_OLD` | MΩ | Điều 9 Bảng 1 ghi chú a |
| `BUSHING_C1_DEV` | % | Điều 38 mục 3c |
| `BUSHING_TGD_RISE_WARN` | % | Điều 38 mục 3a |
| `BUSHING_TGD_RISE_FAIL` | % | Điều 38 mục 3a |
| `BUSHING_AC_PCT` | % | Điều 38 mục 2 |
| `WINDING_TGD_OK` | % | Điều 9 mục 5 |
| `WINDING_TGD_RISE` | % | Điều 30 |
| `WINDING_C_DEV` | % | Điều 9 mục 5 |
| `DCR_DEV` | % | Điều 9 mục 7 |
| `RATIO_DEV` | % | Điều 9 mục 6; Điều 33 |
| `BCT_IR_MIN` | MΩ | Điều 39 |

Một số căn cứ ở đây là tham chiếu/diễn giải được ghi trong mã.
Không xem bảng này là bản sao văn bản QĐ 1901.
Không thêm ngưỡng nếu văn bản không quy định.
Các giới hạn phụ thuộc nhà sản xuất phải lấy từ tài liệu thiết bị.
Admin có thể cài override theo đơn vị; ứng dụng ghi rõ khác ngưỡng gốc.

### Bảng quy đổi và phân loại đi kèm

- K1 là bảng hệ số điện trở cách điện theo Bảng 4.
- K1 dùng để quy R cách điện về 20 °C.
- Bảng 5 chứa đường R cách điện tối thiểu theo nhiệt độ cho MBA từ 110 kV.
- K2 là bảng hệ số tgδ theo Bảng 7.
- K2 ở chênh 16 °C bằng 2,4 theo xác nhận trong dự án.
- Khi chênh lớn hơn 16 °C, mã loại cột 16 khỏi phép ghép tích.
- tgδ cuộn dây ở nhiệt độ cao hơn 20 °C được chia K2.
- tgδ cuộn dây ở nhiệt độ thấp hơn 20 °C được nhân K2.
- R một chiều được quy đổi theo công thức nhiệt độ có hằng số 235.
- tgδ sứ dùng chế độ hệ số K đã chọn trong cấu hình.
- Công thức ứng dụng đã chốt cho sứ là `tgδ20 = tgδ(t) × K`.
- PI được phân loại trong hàm `classifyPI` ở QD.
- Độ ẩm cách điện cứng được phân loại trong `classifyMoisture`.
- Các mục không có ngưỡng có thể mang trạng thái Tham khảo.
- Xem `Criteria` để biết ngưỡng nào thực sự áp dụng sau override.

## 9. Thêm loại thiết bị mới

1. Đọc `AGENTS.md` và ghi việc trong `docs/PHAN_CONG.md`.
2. Xác định lớp nào cần thay đổi và giới hạn vùng file.
3. Tạo mô-đun domain tại `js/domain/types/<code>/`.
4. Tạo schema riêng, evaluator và chuyển đổi dòng nếu thiết bị cần.
5. Tạo báo cáo và bộ đọc xuất xưởng nếu phạm vi có yêu cầu.
6. Tạo giao diện riêng tại `js/ui/types/<code>/`.
7. Đăng ký bằng `EquipmentTypes.register({...})`.
8. Cung cấp `code`, `label`, `classCode` và `defaultCfg`.
9. Cung cấp `normalizeCfg` để mở hồ sơ cũ có trường thiếu.
10. Cung cấp `buildSchema`, `evaluate`, `autoConclusion` theo hợp đồng.
11. Cung cấp `factory`, `toRows`, `report`, `references`, `workflow` nếu dùng.
12. Nạp mọi file JS mới trong `index.html` đúng lớp.
13. Nếu thêm file domain, khai báo trong `test/harness.js`.
14. Viết test với dữ liệu tổng hợp, không dùng số chế tạo thật.
15. Kiểm tra `test/layers.test.js` và test snapshots.
16. Không cập nhật snapshot trừ khi thay đổi kết quả được giao rõ.
17. Cập nhật README nếu người dùng có thêm chức năng.

Không thay đổi mặc định MBA hoặc cách mở hồ sơ cũ khi đăng ký loại mới.
Không để domain gọi DB hay DOM.
Không để UI gọi Supabase trực tiếp.

## 10. Thêm bộ đọc máy đo

1. Xác định định dạng file và trường dữ liệu đầu vào.
2. Thêm parser trong `js/data/instruments/`.
3. Parser trả cấu trúc dữ liệu đo, không tự kết luận đạt.
4. Domain chuyển dữ liệu parser thành khóa schema nếu cần hàm thuần.
5. UI mở hộp thoại chọn pha, nấc, cuộn và cách xử lý nhiệt độ.
6. Phát sự kiện nhập theo đường dùng chung để state và lịch sử đồng bộ.
7. Ghi rõ nguồn dữ liệu và mọi trường không đọc được.
8. Thêm fixture giả trong test; không thêm file đo thật.
9. Đăng ký script theo lớp trong `index.html`.
10. Nếu thêm logic nghiệp vụ, thêm file vào `DOMAIN` trong harness.
11. Kiểm tra cảnh báo, nhập lặp và hoàn tác theo hạng mục.
12. Nếu bộ đọc ghi nhiều mục, kiểm tra mỗi mục có thể hoàn tác độc lập.

Các parser hiện có gồm CPC 100, DIRANA, MRCT và Haefely 2293.
Mỗi định dạng có test riêng hoặc test liên quan được ghi trong `test/`.

## 11. Thêm hạng mục, ô và trường template

1. Xác định khóa state ổn định và kiểu dữ liệu của ô.
2. Thêm field hoặc grid vào schema thiết bị.
3. Gắn `doc.t/r/c` cho vị trí ô bảng, hoặc `doc.before/re` cho đoạn.
4. Xác định đơn vị, nhiệt độ tham chiếu và nguồn số liệu xuất xưởng.
5. Thêm phép tính trong domain nếu là quy tắc nghiệp vụ.
6. Dùng `TestItems` cho so sánh dùng chung nếu phù hợp.
7. Đưa đánh giá qua bộ tiêu chí, không gọi thẳng `QD.LIMITS`.
8. Thêm ánh xạ trong `to-rows.js` nếu lưu CSDL.
9. Thêm ánh xạ trong `report.js` nếu xuất DOCX.
10. Dùng `before`, `slot` hoặc `ensureRow` theo cấu trúc template.
11. Kiểm tra layout theo pha, 110 và 3P nếu mục có ở nhiều mẫu.
12. Nếu đổi cột hoặc thứ tự rows, kiểm tra snapshot `to-rows.json`.
13. Nếu đổi đánh giá, kiểm tra snapshot `evaluate.json`.
14. Chỉ cập nhật snapshot khi giao việc cho phép đổi kết quả.
15. Ghi từng thay đổi snapshot và lý do trong phần bàn giao.

Thay đổi vị trí template có thể làm DOCX sai mà test nghiệp vụ vẫn xanh.
Nên kiểm tra DOCX dựng từ template thử nghiệm hoặc E2E khi có tài liệu phù hợp.

## 12. Bộ đọc và tài nguyên ngoại vi

| Định dạng | Mô-đun | Vai trò |
|---|---|---|
| XML CPC 100 | `js/data/instruments/cpc100.js` | Đọc đặc tính từ hóa và điểm khuỷu |
| CSV/BIN Haefely 2293 | `js/data/instruments/wa2293.js` | Đọc R, tỷ số, thao tác OLTC và dạng sóng |
| `.pdbxml`/PDF MRCT | `js/data/instruments/mrct.js` | Đọc kết quả TI và đặc tính từ hóa |
| CSV DIRANA | `js/data/instruments/dirana.js` | Đọc DFR/FDS phụ lục |
| XLSX xuất xưởng | `js/domain/types/mba/factory.js` | Nạp tham chiếu theo số chế tạo |
| XLSX sứ Hitachi | `js/domain/bushing-hitachi.js` | Đọc bảng tra và test report theo S/N |
| DOCX cũ | `js/domain/types/mba/import-report.js` | Nhận dạng và đọc BBTN cũ |
| OCR nameplate | `js/domain/types/mba/nameplate.js` | Phân tích kết quả chữ OCR |

Các tên file, phiên bản máy và bố cục cụ thể có thể khác theo nhà sản xuất.
Mã chỉ hỗ trợ các dạng đã có parser và test.

## 13. Cơ sở dữ liệu và quyền

`js/data/db.js` là adapter Supabase.
App dùng anon key, không dùng `service_role`.
RLS là lớp bảo vệ dữ liệu, không thay thế việc cấp quyền đúng.
Vai trò trong mã gồm `none`, `viewer`, `editor`, `admin`.
Người xem đọc dữ liệu theo policy.
Editor có quyền nhập liệu theo policy.
Admin quản trị danh mục và cấu hình theo policy.

Các luồng chính bao gồm phiên thí nghiệm, measurement, findings, thiết bị,
trạm, ngăn, tài liệu, thư viện và bảng tiêu chí.
`Records` gọi repository; DB thực hiện thao tác backend.
Trang giao diện DB không gọi Supabase query trực tiếp.
Xu hướng lưu giá trị đo và giá trị so sánh đã quy đổi khi có.
`v_trend` và `v_trend_delta` là các view lịch sử trong migrations.
Bucket tài liệu riêng tư được kiểm soát bằng policy.

Mọi thay đổi schema cần migration mới có timestamp.
Migration cần RLS và không sửa migration đã gộp.
Chủ dự án tự chạy migration trên Supabase.
PR phải nêu tên file migration cần áp dụng.

## 14. Kiểm thử, snapshot và lệnh

`npm test` gọi `node --test test/*.test.js`.
`npm run test:inline` gọi `node --test --test-isolation=none test/*.test.js`.
Lệnh inline dùng trong môi trường sandbox không cho tiến trình con.
`npm run test:update` cập nhật snapshot có chủ ý.
`npm run test:e2e` gọi `python tools/e2e_export_3p.py`.
E2E cần Playwright cho Python và `js/embedded.js` có template 3P.
Script E2E tự bỏ qua khi không có template 3P nhúng.

`test/snapshots/evaluate.json` khóa kết quả đánh giá MBA.
`test/snapshots/to-rows.json` khóa dòng CSDL và khóa chuỗi xu hướng.
Snapshot đỏ có thể báo thay đổi kết quả nghiệp vụ hoặc cấu trúc lưu.
Không xóa hoặc cập nhật snapshot để làm test xanh một cách máy móc.
Test phải dùng số liệu giả.
CI chạy test bằng Node 22.
Workflow test chạy trên pull request.
Workflow Pages chạy test trước khi deploy.
Chỉ push vào `main` mới triển khai Pages; các nhánh hiệu chỉnh (vd `codex/shadcn-ui-refactor`) thử trên localhost (`npm run dev` / `npm run build`).

## 15. Bảo mật và triển khai

Repo công khai; không commit dữ liệu hiện trường thật.
Không commit `js/config.js` hoặc `js/embedded.js`.
Không commit DOCX, XLSX, XLSM, PDF, ảnh nameplate hay file đo thật.
Không commit tiêu chuẩn có bản quyền.
Không ghi số chế tạo hoặc tên trạm thật trong test.
`tools/build_embedded.py` tạo `js/embedded.js` từ tài nguyên ngoài repo.
Template và dữ liệu xuất xưởng nội bộ được đọc từ thư mục cạnh repo.
GitHub Actions `test.yml` kiểm tra pull request.
GitHub Actions `pages.yml` kiểm tra rồi tạo `js/config.js` từ Actions Variables.
Workflow deploy chạy `npm ci` + `npm run build` và đưa thư mục `dist` (vỏ React/Vite + `css`, `js`, `icons`, `docs`) vào artifact Pages.
Chỉ anon/publishable key được đưa vào cấu hình client.

## 16. Lịch sử tính năng và quyết định đã ghi nhận

Bảng dưới rút các commit tính năng và quyết định liên quan từ `git log`.
Ngày là ngày commit theo timezone Git hiển thị.
Lý do chỉ ghi khi nội dung commit hoặc tài liệu dự án nêu được.

| Ngày | Commit | Nội dung | Lý do ghi nhận |
|---|---|---|---|
| 2026-10-23 | `fbd8c87` | Web app nhập BBTN MBA và CSDL Supabase | Khởi tạo dự án |
| 2026-10-23 | `ab7e1b8` | Không đưa `js/config.js` lên Git | Bảo vệ cấu hình; có file mẫu |
| 2026-10-23 | `21466f0` | Đăng nhập Google/email và phiên | Lưu hồ sơ có phân quyền |
| 2026-10-23 | `fb16540` | Triển khai GitHub Pages bằng Actions | Tự động triển khai |
| 2026-10-23 | `ddf4613` | Báo khi Google chưa bật trên Supabase | Tránh điều hướng sang lỗi JSON |
| 2026-10-23 | `3f9f122` | Báo nguyên nhân Google đăng nhập không hoàn tất | Hỗ trợ chẩn đoán |
| 2026-10-23 | `2187bf8` | Giới hạn chờ bước kiểm tra Google | Tránh chờ vô hạn |
| 2026-10-23 | `23094f9` | Đăng nhập Google dùng implicit flow | Bỏ bước PKCE lỗi trên site tĩnh |
| 2026-10-23 | `ffa82bd` | Ưu tiên config trang và kiểm tra key | Báo lỗi Invalid API key rõ hơn |
| 2026-10-23 | `91279e5` | Giao diện theo ngành điện | Màu pha, sơ đồ một sợi, font Việt |
| 2026-10-23 | `4144d7f` | Quy đổi sứ RIP Hitachi | Theo hướng dẫn hãng và S/N |
| 2026-10-23 | `1bf12d7` | Quy đổi cách điện và tgδ cuộn dây | Áp dụng K1/K2 và mốc 20 °C |
| 2026-10-23 | `cd7d92d` | Ghi giới hạn quy đổi và nhiệt độ | Nêu điều kiện ngoài bảng |
| 2026-10-23 | `3017d9e` | Ghi nhận K2 tại 16 °C bằng 2,4 | Đã đối chiếu bản giấy QĐ 1901 |
| 2026-10-23 | `20cb81b` | K2 trên 16 °C ghép hệ số 1–15 | Không dùng cột 16 khi ghép |
| 2026-10-23 | `ef3d640` | Nhập XML CPC 100 và điểm đặc tính | Bổ sung kiểm tra TI chân sứ |
| 2026-10-23 | `8c42308` | Chọn số cuộn và nạp CPC 100 theo pha | Phục vụ nhiều lõi TI |
| 2026-10-23 | `c4c7a97` | Bảng K sứ cấu hình được | QĐ 1901 hoặc bảng hãng |
| 2026-10-23 | `c5be339` | tgδ sứ dùng phép nhân K | Quyết định người dùng xác nhận |
| 2026-10-23 | `fc0eafc` | OCR ảnh nameplate | Giảm nhập lại thông số |
| 2026-10-23 | `cb380bf` | Kéo thả/dán ảnh nameplate | Bổ sung cách nạp ảnh |
| 2026-10-23 | `0fc64bb` | Bộ tiêu chí cấu hình được | Cho phép ngưỡng theo đơn vị |
| 2026-10-24 | `569a7c9` | Test tự động tính toán và đánh giá MBA | Khóa kết quả tính |
| 2026-10-24 | `ec7a170` | Tách ba lớp và đăng ký loại thiết bị | Mở rộng kiến trúc |
| 2026-10-27 | `a98cc25` | Nhập Haefely 2293 và phụ lục OLTC | Tận dụng dữ liệu máy đo |
| 2026-10-27 | `0abdae6` | Xóa/hoàn tác theo hạng mục | Khôi phục thao tác nhập |
| 2026-10-29 | `a9c8e31` | Nối báo cáo SFRA thành phụ lục | Gắn kết quả phân tích vào BBTN |
| 2026-10-30 | `2902a37` | Chọn phép đo cao áp A-N hoặc A-Am | Khớp cách đấu thực tế |
| 2026-11-14 | `a3f3791` | Nhập số bằng Web Speech | Đọc tiếng Việt vào ô số |
| 2026-11-14 | `0b76e3b` | Mẫu chung 3 pha | Một BBTN cho bộ ba máy |
| 2026-11-14 | `406c303` | Nhiều file xuất xưởng và test report sứ | Hỗ trợ AT1, AT2 và S/N |
| 2026-11-14 | `540d050` | Phụ lục DFR từ DIRANA | Đưa đáp ứng tần số vào BBTN |
| 2026-11-14 | `7e19e12` | Xu hướng ngay tại ô nhập | Hiển thị lịch sử để tham khảo |
| 2026-11-14 | `f702fc7` | Thư viện tài liệu | Tài liệu tham khảo theo hạng mục |
| 2026-11-14 | `ed756c4` | Nhập BBTN cũ và mẫu 110–220 kV | Nhập lịch sử và thêm layout |

Lý do commit không nêu rõ được ghi là không có trong lịch sử.
Không suy diễn quyết định nghiệp vụ từ tên commit đơn lẻ.

## 17. Việc mở và giới hạn

Trạng thái cập nhật nằm ở `docs/PHAN_CONG.md`.
X4 chờ quyết định về gói Playwright theo bảng việc.
X5 cần file mẫu máy mới.
C1 đã gộp nhưng cần BBTN thật để thử thêm; không lưu file thật trong repo.
C2 còn chờ thông tin kháng và test report MBA 3 pha.
C3 còn chờ template TI/TU.
C4 chưa nhận.
C7/C8 và các việc đã gộp có thể được mở rộng khi có đầu vào.

## 18. Tham chiếu mã nguồn

- [README](../README.md)
- [Quy tắc agent](../AGENTS.md)
- [Bảng phân công](PHAN_CONG.md)
- [Điểm vào HTML](../index.html)
- [Test ranh giới lớp](../test/layers.test.js)
- [Harness test](../test/harness.js)
- [QĐ 1901 trong mã](../js/domain/qd1901.js)
- [Criteria](../js/domain/criteria.js)
- [Schema MBA](../js/domain/types/mba/schema.js)
- [Evaluate MBA](../js/domain/types/mba/evaluate.js)
- [Workflow Pages](../.github/workflows/pages.yml)
- [Workflow kiểm tra](../.github/workflows/test.yml)
