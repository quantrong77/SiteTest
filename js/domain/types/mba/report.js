// MBA: ghi biên bản vào template BBTN (.docx). tpl là DocxTemplate đã nạp; trả về số ô đã ghi và các vị trí không định vị được.
(function () {
  'use strict';
  const { eachField, eachGrid } = Common;

  // assets: tài nguyên giao diện dựng sẵn — ảnh đồ thị chụp sóng OLTC theo pha { oltcCharts: { A: [{ png, w, h, dir, caption }] } },
  // báo cáo SFRA đã mở { fraDoc: DocxTemplate }
  function fill(tpl, { state, res, schema, assets }) {
    const miss = [];
    const out = Report.decimal(state.cfg.decSep);
    const write = (f, value) => {
      if (value === undefined || value === null || String(value).trim() === '') return;
      if (!tpl.writeField(f.doc, out(value))) miss.push(f.label || f.k);
    };
    const v = state.v;
    const is3P = schema.layout === Schema.LAYOUT_3P;
    Report.prepare(tpl, schema); // chèn hàng template thiếu (vd nhiệt độ từng sứ ở mẫu 3 pha) trước khi ghi
    eachField(schema, f => {
      if (!f.doc) return;
      let val = v[f.k];
      // mẫu 3 pha: ô "Số chế tạo" ghi số chế tạo cả 3 máy (theo ánh xạ cột pha ở mục 0)
      if (is3P && f.k === 'meta.serial') {
        const ps = ['A', 'B', 'C'].map(ph => String((state.cfg.ps || {})[ph] || '').trim());
        if (ps.every(Boolean)) val = ps.join('; ');
      }
      if (f.k === 'meta.conclusion' && !val) val = Evaluate.autoConclusion(res, schema, state);
      const m = f.k.match(/^b\.(\w+)\.k$/);
      if (m && !/Nhập/i.test(v[`b.${m[1]}.kmode`] || '')) val = (res.notes[f.k] || '').trim();
      if (/\.btype$/.test(f.k)) val = val || 'RIP';
      write(f, val);
    });
    schema.sections.forEach(s => (s.extraDoc || []).forEach(x => write({ doc: x.doc, k: x.k }, (res.notes[x.k] || '').trim())));
    let cells = 0;
    // Mục 6: thêm hàng cho đối tượng đo bổ sung (bảng số liệu đo và bảng quy đổi 20 °C)
    const nExtra = (state.cfg.wtgdRows || []).length;
    if (nExtra && !is3P) eachGrid(schema, g => { if (/^wtgd\./.test(g.id)) tpl.appendRows(g.tables[0], nExtra); });
    eachGrid(schema, g => {
      if (!g.tables) return; // bảng chỉ có trong app (vd quy đổi 20 °C sứ, biến dòng chân sứ ở mẫu 3 pha → phụ lục)
      // Đối tượng đo đã sửa/thêm → ghi vào cột đầu; đề mục cột đã sửa → ghi vào hàng tiêu đề của template
      if (/^wtgd\./.test(g.id) && !is3P) g.rows.forEach(r => { if (r.label && r.label !== r.defLabel) tpl.setCellText(tpl.cell(g.tables, r.doc, 0), r.label); });
      if (g.editHdr) g.cols.forEach(c => { if (c.label !== c.defLabel) tpl.setCellText(tpl.cell([g.tables[0]], 0, c.doc), c.label); });
      // đề mục cột đổi theo cấu hình (vd 7.1 đo A-Am thay cho A-N) → ghi chữ tương ứng vào hàng tiêu đề của template
      g.cols.forEach(c => { if (c.docLabel && c.doc !== undefined) tpl.setCellText(tpl.cell([g.tables[0]], 0, c.doc), c.docLabel); });
      // bảng đặc tính từ hóa có số liệu điểm khuỷu → chèn cột thứ 4 vào bảng của template
      const exWide = g.ex && g.rows.some(r => (v[`${g.id}.${r.k}.p4`] || '').toString().trim());
      if (exWide) tpl.ensureColumns(g.tables, 5);
      g.rows.forEach(r => g.cols.forEach(c => {
        if (r.nodoc || c.nodoc || c.doc === undefined || (g.skip && g.skip(r.k, c.k))) return;
        const key = `${g.id}.${r.k}.${c.k}`;
        const val = (g.readonly || c.calc) ? res.calc[key] : ((v[key] ?? '').toString().trim() || res.calc[key]);
        if (val === undefined || val === null || String(val).trim() === '') return;
        // ô có nhãn cố định quanh giá trị (vd "Nấc đến: … (Tap position to)"): chỉ thay phần giá trị
        if (c.slot) { if (tpl.writeField({ t: g.tables[0], r: r.doc, c: c.doc, re: c.slot }, out(val))) cells++; else miss.push(key); return; }
        const tc = tpl.cell(g.tables, r.doc, r.cmap && r.cmap[c.k] !== undefined ? r.cmap[c.k] : c.doc);
        if (tpl.setCellText(tc, out(val))) cells++; else miss.push(key);
      }));
      // Đặc tính từ hóa: ghi đầu cuộn thực đo (vd 2S1-2S5) vào ô nhãn thay cho nhãn mẫu "2S1 - 2S4"
      if (/^bct\.\w+\.ex\./.test(g.id)) g.rows.filter(r => /i$/.test(r.k)).forEach(r => {
        const tap = v[`${g.id}.tap.${r.k.slice(0, -1)}`];
        if (tap) tpl.setCellText(tpl.cell(g.tables, r.doc, 0), tap);
      });
      // Bảng đã chèn cột khuỷu: thêm hàng tiêu đề (làm sau cùng vì làm lệch chỉ số hàng)
      if (exWide) tpl.insertHeaderRow(g.tables[0], ['Đầu cuộn', 'Mốc 25 %', 'Mốc 50 %', 'Mốc 75 %', 'Điểm khuỷu']);
    });
    // Bảng hạng mục ở trang 1: đã thí nghiệm (✓) và đánh giá
    const SUM = schema.summary || { rows: Schema.SUMMARY_ROWS, tick: 3, ev: 4 };
    const standardCol = SUM.ev + 1, standardHeaderRow = SUM.header ?? 10;
    const standardRows = [standardHeaderRow, ...Object.values(SUM.rows).flat(), ...(SUM.fra !== undefined ? [SUM.fra] : [])];
    tpl.ensureSummaryColumn(0, standardCol + 1, 1800, SUM.tick, standardRows);
    tpl.setCellText(tpl.cell([0], standardHeaderRow, standardCol), 'Tiêu chuẩn\n(QĐ 1901)');
    const standardFor = (id, row) => {
      if (id === 'noload') {
        const reason = String(v['meta.reason'] || '').toLowerCase();
        const operation = /định kỳ|bất thường|vận hành|sau\s*1\s*năm/.test(reason);
        const threePhase = schema.layout === Schema.LAYOUT_110 || schema.layout === Schema.LAYOUT_3P;
        if (!reason && !threePhase) return (QD.REPORT_STANDARDS || {}).noload;
        if (threePhase) {
          const p0 = operation ? 'P0 lệch ≤15% giá trị gốc' : 'P0 lệch ≤5% NSX';
          return `${p0}; I0 TB ≤30% NSX; P0/I0 A-C lệch ≤5%, pha B thường cao 25–50% do lõi (Điều 34).`;
        }
        if (operation) return 'P0 lệch ≤15% giá trị khởi đầu (Điều 34).';
        return 'P0 lệch ≤10% giá trị khởi đầu (MBA 1 pha ≥110 kV, sau lắp/sửa; Điều 34).';
      }
      if (id === 'ir' && schema.layout === Schema.LAYOUT_3P && [].concat(SUM.rows.ir || [])[1] === row) {
        return 'R cách điện lõi/gông >500 MΩ (MBA mới), >100 MΩ (đang vận hành) nếu NSX không quy định (Điều 9, Bảng 1).';
      }
      return (QD.REPORT_STANDARDS || {})[id] || 'QĐ 1901 không nêu ngưỡng số chung; đối chiếu NSX/hồ sơ gốc.';
    };
    schema.sections.forEach(s => {
      const S = res.sec[s.id];
      const tick = state.sum.tick[s.id] ?? !!S.status;
      const ev = state.sum.ev[s.id];
      // mẫu 3 pha: mục 3 (cách điện cuộn dây) và mục 4 (lõi từ, gông từ) cùng lấy theo hạng mục cách điện của app
      [].concat(SUM.rows[s.id] ?? []).forEach(row => {
        tpl.setCellText(tpl.cell([0], row, SUM.tick), tick ? '✓' : '');
        tpl.setCellText(tpl.cell([0], row, SUM.ev), ev === '—' ? '' : (ev || (tick ? S.text : '')));
        tpl.setCellText(tpl.cell([0], row, standardCol), standardFor(s.id, row));
      });
    });
    // mẫu 3 pha: mục 12 SFRA đánh dấu khi đã nạp báo cáo SFRA làm phụ lục
    if (SUM.fra !== undefined) {
      if (state.att && state.att.fra) tpl.setCellText(tpl.cell([0], SUM.fra, SUM.tick), '✓');
      tpl.setCellText(tpl.cell([0], SUM.fra, standardCol), standardFor('fra'));
    }
    // Phụ lục nối cuối biên bản, mỗi phụ lục một section (đánh số trang riêng): chụp sóng OLTC (mỗi pha một phần),
    // báo cáo SFRA (nối nguyên văn file .docx đã nạp)
    const A = assets || {};
    // mẫu 3 pha: số liệu biến dòng chân sứ đưa vào thân biên bản tại mục 13 (tùy chọn) hoặc thành phụ lục (mặc định).
    // Không tìm thấy đề mục 13 trong template thì vẫn xuất phụ lục để không mất số liệu.
    let bctAppx = is3P && hasBct(state);
    if (bctAppx && state.cfg.bctPlace === 'body') {
      if (bctToBody(tpl, state, schema, res, out)) bctAppx = false;
      else miss.push('Mục 13 – biến dòng chân sứ (không thấy đề mục trong template, đã xuất thành phụ lục)');
    }
    if (tpl.appendSection) Appendix.list(state, { fra: !!A.fraDoc, oil: Object.fromEntries(Object.keys(A.oilDocs || {}).map(id => [id, true])), bct: bctAppx }).forEach(a => {
      if (a.kind === 'oltc') tpl.appendSection(oltcAppendix(state, state.att.oltc, A, out, a.label));
      if (a.kind === 'fra') { tpl.appendSection(Appendix.fraHeader(a.label, state.att.fra)); tpl.importBody(A.fraDoc); }
      if (a.kind === 'oil') { const item = state.att.oil.items.find(x => x.id === a.id); tpl.appendSection(Appendix.oilHeader(a.label, item)); tpl.importBody(A.oilDocs[a.id]); }
      if (a.kind === 'dfr') tpl.appendSection(Dfr.appendix(state, A, out, a.label));
      if (a.kind === 'shortCircuit') tpl.appendSection(Appendix.shortCircuitAppendix(state, A.shortCircuitRows || [], A.factoryName, out, a.label));
      if (a.kind === 'bct') tpl.appendSection(bctAppendix(state, schema, res, out, a.label));
    });
    return { cells, miss };
  }

  // Cột bảng số liệu giống bảng máy đo (và mẫu phụ lục của đơn vị); độ rộng theo khổ chữ của template A4 (16 cm)
  const OLTC_COLS = [
    ['tr', 'Tap Transition / Connection', 1400], ['t', 'Temp. [°C]', 800], ['ub', 'Static Voltage Before Tap Change [V]', 1000], ['ib', 'Static Current Before Tap Change [A]', 1000],
    ['ua', 'Static Voltage After Tap Change [V]', 1000], ['ia', 'Static Current After Tap Change [A]', 1000], ['tFall', 'tFall [mS]', 920], ['tRise', 'tRise [mS]', 920], ['delta', 'Delta', 1000],
  ];
  function oltcAppendix(state, osc, assets, out, label = 'PHỤ LỤC') {
    const v = state.v, blocks = [];
    const charts = assets.oltcCharts || {};
    const numTxt = x => (Number.isFinite(x) ? out(String(x)) : '');
    const phases = Object.keys(osc).sort();
    phases.forEach((ph, pi) => {
      const r = osc[ph];
      blocks.push({ type: 'page' });
      if (!pi) blocks.push({ type: 'p', text: label, bold: true, size: 14, align: 'center' });
      // tổ 3 máy 1 pha: số chế tạo theo ánh xạ cột pha ở mục 0
      const sn = (state.cfg.ps && state.cfg.ps[ph]) || v['meta.serial'] || '';
      blocks.push({ type: 'p', text: `ĐỒ THỊ CHỤP SÓNG OLTC – MBA ${sn} – PHA ${ph}`.replace(/\s+–\s+–/, ' –'), bold: true, size: 13, align: 'center' });
      if (v['meta.project'] || v['meta.site']) blocks.push({ type: 'p', text: [v['meta.project'], v['meta.site']].filter(Boolean).join(' – '), align: 'center', size: 12 });
      blocks.push({ type: 'p', text: `Máy đo: ${r.device}. File: ${[r.file, r.bin].filter(Boolean).join(', ')}${r.exported ? ` (xuất ${r.exported})` : ''}.`, italic: true, size: 10, align: 'center', after: 160 });
      let n = 1;
      if (r.rows.length) {
        blocks.push({ type: 'p', text: `${n++}. Số liệu:`, bold: true, size: 12, keepNext: true });
        blocks.push({ type: 'table', size: 9, head: OLTC_COLS.map(c => c[1]), widths: OLTC_COLS.map(c => c[2]),
          rows: r.rows.map(x => OLTC_COLS.map(([k]) => (k === 'tr' ? x.tr : numTxt(x[k])))) });
      }
      const ch = charts[ph] || [];
      if (ch.length) {
        blocks.push({ type: 'p', text: `${n}. Đồ thị điện trở động R(t):`, bold: true, size: 12, keepNext: true });
        [['up', 'Quá trình tăng nấc'], ['down', 'Quá trình giảm nấc'], ['', 'Chuyển nấc khác']].forEach(([d, title], di) => {
          const items = ch.filter(c => c.dir === d);
          if (!items.length) return;
          blocks.push({ type: 'p', text: `${n}.${di + 1} ${title}`, bold: true, italic: true, size: 12, keepNext: true });
          blocks.push({ type: 'images', perRow: items[0].perRow || 2, widthCm: items[0].perRow === 1 ? 16 : 8, items });
        });
      }
    });
    blocks.push({ type: 'p', text: 'Người thí nghiệm', bold: true, size: 12, align: 'right', after: 1200 });
    return blocks;
  }

  // ---------------------------------------------------------------- phụ lục biến dòng chân sứ (mẫu 3 pha)
  const BCT_DATA = /^bct\.\w+\.(ir|ratio|dcr|ex)\./;
  const hasBct = state => Object.keys(state.v).some(k => BCT_DATA.test(k) && !/\.(src|tap)\./.test(k) && String(state.v[k] ?? '').trim());
  // Mỗi phía: bảng cách điện, tỷ số & sai số, điện trở một chiều, đặc tính từ hóa theo pha; chỉ in hàng có số liệu
  function bctAppendix(state, schema, res, out, label = 'PHỤ LỤC') {
    const v = state.v, blocks = [{ type: 'page' }];
    blocks.push({ type: 'p', text: label, bold: true, size: 14, align: 'center' });
    blocks.push({ type: 'p', text: 'KẾT QUẢ THÍ NGHIỆM BIẾN DÒNG CHÂN SỨ', bold: true, size: 13, align: 'center' });
    blocks.push({ type: 'p', text: '(Bushing type current transformer test results)', italic: true, size: 11, align: 'center' });
    if (v['meta.project'] || v['meta.site']) blocks.push({ type: 'p', text: [v['meta.project'], v['meta.site']].filter(Boolean).join(' – '), align: 'center', size: 12, after: 160 });
    blocks.push(...bctBlocks(state, schema, res, out, n => `${n}.`));
    blocks.push({ type: 'p', text: 'Người thí nghiệm', bold: true, size: 12, align: 'right', after: 1200 });
    return blocks;
  }

  // Đề mục 13 của mẫu 3 pha và đuôi "đính kèm Phụ lục biến dòng chân sứ" (bỏ khi số liệu nằm ngay dưới đề mục)
  const BCT_HEAD = /^\s*13\s*\.\s*Kiểm tra biến dòng chân sứ/i;
  const BCT_ATT = /(?<v>đính kèm\s+phụ lục\s+biến dòng chân sứ\.?\s*)$/i;
  function bctToBody(tpl, state, schema, res, out) {
    const p = tpl.bodyPara && tpl.bodyPara(BCT_HEAD);
    if (!p) return false;
    tpl.setSlot(p, BCT_ATT, '');
    tpl.insertBlocksAfter(p, bctBlocks(state, schema, res, out, n => `13.${n}`));
    return true;
  }

  // Nội dung BCT dùng chung cho phụ lục và mục 13: thông tin chung + bảng theo phía; num(n) đánh số nhóm (1. / 13.1)
  function bctBlocks(state, schema, res, out, num) {
    const v = state.v, blocks = [];
    const info = [['Kiểm tra bên ngoài', v['bct.visual']], ['Cực tính', v['bct.polarity']],
      ['Nhiệt độ đo cách điện', v['bct.t_ir'] ? `${out(v['bct.t_ir'])} °C` : ''], ['Nhiệt độ đo điện trở một chiều', v['bct.t_dcr'] ? `${out(v['bct.t_dcr'])} °C` : '']];
    info.filter(([, x]) => String(x ?? '').trim()).forEach(([k, x]) => blocks.push({ type: 'p', text: `${k}: ${x}`, size: 12 }));
    const cellVal = (g, r, c) => {
      const key = `${g.id}.${r.k}.${c.k}`;
      const x = (g.readonly || c.calc) ? res.calc[key] : ((v[key] ?? '').toString().trim() || res.calc[key]);
      return x === undefined || x === null ? '' : out(String(x));
    };
    const sec = schema.sections.find(s => s.id === 'bct');
    let n = 1;
    (sec ? sec.groups : []).forEach(gr => {
      const grids = gr.grids.map(g => {
        const rows = g.rows.map(r => {
          const vals = g.cols.map(c => cellVal(g, r, c));
          if (!vals.some(Boolean)) return null;
          // đặc tính từ hóa: nhãn hàng theo đầu cuộn thực đo (vd 2S1-2S3) nếu có
          const tap = g.ex && v[`${g.id}.tap.${r.k.slice(0, -1)}`];
          const lbl = tap ? r.label.replace(/^[^:]+/, tap) : r.label;
          return [lbl].concat(vals);
        }).filter(Boolean);
        return rows.length ? { g, rows } : null;
      }).filter(Boolean);
      if (!grids.length) return;
      blocks.push({ type: 'p', text: `${num(n++)} ${gr.title}`, bold: true, size: 12, keepNext: true, after: 80 });
      grids.forEach(({ g, rows }) => {
        const nc = g.cols.length;
        const w0 = 2600, w = Math.floor((9600 - w0) / nc);
        blocks.push({ type: 'p', text: g.title, italic: true, size: 11, keepNext: true });
        blocks.push({ type: 'table', size: 9, head: ['Cuộn / đầu ra'].concat(g.cols.map(c => c.label)), widths: [w0].concat(g.cols.map(() => w)), rows });
      });
    });
    return blocks;
  }

  // Template chuẩn MBA 500 kV có 73 bảng; ít hơn 72 thì vị trí điền có thể lệch (mẫu chung 3 pha: 28 bảng, schema.tables)
  window.MbaReport = { fill, oltcAppendix, bctAppendix, bctBlocks, bctToBody, hasBct, minTables: 72, stdTables: 73 };
})();
