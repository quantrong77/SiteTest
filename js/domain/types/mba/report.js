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
    eachField(schema, f => {
      if (!f.doc) return;
      let val = v[f.k];
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
    if (nExtra) eachGrid(schema, g => { if (/^wtgd\./.test(g.id)) tpl.appendRows(g.tables[0], nExtra); });
    eachGrid(schema, g => {
      // Đối tượng đo đã sửa/thêm → ghi vào cột đầu; đề mục cột đã sửa → ghi vào hàng tiêu đề của template
      if (/^wtgd\./.test(g.id)) g.rows.forEach(r => { if (r.label && r.label !== r.defLabel) tpl.setCellText(tpl.cell(g.tables, r.doc, 0), r.label); });
      if (g.editHdr) g.cols.forEach(c => { if (c.label !== c.defLabel) tpl.setCellText(tpl.cell([g.tables[0]], 0, c.doc), c.label); });
      // bảng đặc tính từ hóa có số liệu điểm khuỷu → chèn cột thứ 4 vào bảng của template
      const exWide = g.ex && g.rows.some(r => (v[`${g.id}.${r.k}.p4`] || '').toString().trim());
      if (exWide) tpl.ensureColumns(g.tables, 5);
      g.rows.forEach(r => g.cols.forEach(c => {
        if (r.nodoc || (g.skip && g.skip(r.k, c.k))) return;
        const key = `${g.id}.${r.k}.${c.k}`;
        const val = (g.readonly || c.calc) ? res.calc[key] : ((v[key] ?? '').toString().trim() || res.calc[key]);
        if (val === undefined || val === null || String(val).trim() === '') return;
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
    schema.sections.forEach(s => {
      const row = Schema.SUMMARY_ROWS[s.id];
      const S = res.sec[s.id];
      const tick = state.sum.tick[s.id] ?? !!S.status;
      const ev = state.sum.ev[s.id];
      tpl.setCellText(tpl.cell([0], row, 3), tick ? '✓' : '');
      tpl.setCellText(tpl.cell([0], row, 4), ev === '—' ? '' : (ev || (tick ? S.text : '')));
    });
    // Phụ lục nối cuối biên bản, mỗi phụ lục một section (đánh số trang riêng): chụp sóng OLTC (mỗi pha một phần),
    // báo cáo SFRA (nối nguyên văn file .docx đã nạp)
    const A = assets || {};
    if (tpl.appendSection) Appendix.list(state, { fra: !!A.fraDoc }).forEach(a => {
      if (a.kind === 'oltc') tpl.appendSection(oltcAppendix(state, state.att.oltc, A, out, a.label));
      if (a.kind === 'fra') { tpl.appendSection(Appendix.fraHeader(a.label, state.att.fra)); tpl.importBody(A.fraDoc); }
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

  // Template chuẩn MBA 500 kV có 73 bảng; ít hơn 72 thì vị trí điền có thể lệch
  window.MbaReport = { fill, oltcAppendix, minTables: 72, stdTables: 73 };
})();
