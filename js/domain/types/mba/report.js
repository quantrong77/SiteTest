// MBA: ghi biên bản vào template BBTN (.docx). tpl là DocxTemplate đã nạp; trả về số ô đã ghi và các vị trí không định vị được.
(function () {
  'use strict';
  const { eachField, eachGrid } = Common;

  // assets: tài nguyên giao diện dựng sẵn — ảnh đồ thị chụp sóng OLTC theo pha { oltcCharts: { A: [{ png, w, h, dir, caption }] } },
  // báo cáo SFRA đã mở { fraDoc: DocxTemplate }
  function phaseState(state, sourceSchema, targetSchema, phase) {
    const projected = JSON.parse(JSON.stringify(state));
    const sourceV = state.v || {}, targetV = Object.assign({}, sourceV);
    const serial = String((state.cfg.ps || {})[phase] || '').trim();
    projected.cfg.template = phase;
    projected.cfg.topology = 'bank1p';
    projected.cfg.reportScope = 'combined';
    targetV['meta.serial'] = serial;

    const fieldSources = {
      'ir.t': `ir.${phase}.t`,
      'ir.k1': `ir.${phase}.k1`,
      'wtgd.t': `wtgd.${phase}.t`,
      'wtgd.k2': `wtgd.${phase}.k2`,
      'dcr.hv.t': `dcr.${phase}.t`,
    };
    const fieldKeys = schema => {
      const keys = new Set();
      eachField(schema, f => keys.add(f.k));
      (schema.sections || []).forEach(s => (s.extraDoc || []).forEach(f => keys.add(f.k)));
      return keys;
    };
    const sourceFieldKeys = fieldKeys(sourceSchema), targetFieldKeys = fieldKeys(targetSchema);
    targetFieldKeys.forEach(key => delete targetV[key]);
    eachField(targetSchema, f => {
      const sourceKey = fieldSources[f.k] || f.k;
      if (sourceFieldKeys.has(sourceKey) && sourceV[sourceKey] !== undefined) targetV[f.k] = sourceV[sourceKey];
    });
    (targetSchema.sections || []).forEach(s => (s.extraDoc || []).forEach(f => {
      const sourceKey = fieldSources[f.k] || f.k;
      if (sourceFieldKeys.has(sourceKey) && sourceV[sourceKey] !== undefined) targetV[f.k] = sourceV[sourceKey];
    }));
    const moistureKey = `moist.r.${phase}`;
    if (targetFieldKeys.has('moist.val') && sourceV[moistureKey] !== undefined) targetV['moist.val'] = sourceV[moistureKey];
    targetV['meta.serial'] = serial;

    const sourceGrids = new Map();
    eachGrid(sourceSchema, g => sourceGrids.set(g.id, g));
    const gridSources = {
      'nl.rated': `nl.${phase}.rated`,
      'ir.meas': `ir.${phase}.meas`,
      'ir.c20': `ir.${phase}.c20`,
      'wtgd.meas': `wtgd.${phase}.meas`,
    };
    const lowerPhase = phase.toLowerCase();
    eachGrid(targetSchema, targetGrid => {
      const sourceId = gridSources[targetGrid.id] || targetGrid.id;
      const sourceGrid = sourceGrids.get(sourceId);
      targetGrid.rows.forEach(row => targetGrid.cols.forEach(col => delete targetV[`${targetGrid.id}.${row.k}.${col.k}`]));
      if (!sourceGrid) return;
      targetGrid.rows.forEach(row => {
        targetGrid.cols.forEach(col => {
          const targetKey = `${targetGrid.id}.${row.k}.${col.k}`;
          if (col.calc || col.nodoc) return;
          let sourceForCell = sourceGrid;
          let sourceColKey = col.k;
          if (targetGrid.id === 'b.mv.meas' && col.k === 'N') {
            sourceForCell = sourceGrids.get('b.n.meas');
            sourceColKey = phase;
          } else if (targetGrid.id === 'b.mv.c20' && col.k === 'N') {
            sourceForCell = sourceGrids.get('b.n.c20');
            sourceColKey = phase;
          }
          if (!sourceForCell) return;
          const sourceRow = sourceForCell.rows.find(r => r.k === row.k);
          if (!sourceRow) return;
          const sourceCol = sourceForCell.cols.find(c => c.k === sourceColKey);
          if (!sourceCol || sourceCol.calc || sourceCol.nodoc) return;
          if (sourceCol.phase && sourceCol.k !== phase && sourceCol.k !== lowerPhase) return;
          const sourceKey = `${sourceForCell.id}.${sourceRow.k}.${sourceCol.k}`;
          if (sourceV[sourceKey] !== undefined) targetV[targetKey] = sourceV[sourceKey];
        });
      });
    });

    const att = projected.att || (projected.att = {});
    if (att.oltc) att.oltc = att.oltc[phase] ? { [phase]: att.oltc[phase] } : {};
    if (att.fra && att.fra.serial && String(att.fra.serial).trim() !== serial) delete att.fra;
    if (att.shortCircuit && Array.isArray(att.shortCircuit.rows)) {
      att.shortCircuit.rows = att.shortCircuit.rows.filter(row => {
        const rowPhase = String(row.phase || '').toUpperCase(), rowSerial = String(row.serial || '').trim();
        return (!rowPhase || rowPhase === phase) && (!rowSerial || rowSerial === serial);
      });
      if (!att.shortCircuit.rows.length) delete att.shortCircuit;
    }
    if (att.dfr && Array.isArray(att.dfr.items)) {
      att.dfr.items = att.dfr.items.filter(item => {
        const itemPhase = String(item.phase || '').toUpperCase(), itemSerial = String(item.serial || '').trim();
        return (!itemPhase || itemPhase === phase) && (!itemSerial || itemSerial === serial);
      });
    }
    if (att.oil && Array.isArray(att.oil.items)) {
      att.oil.items = att.oil.items.filter(item => {
        if (item.phase && String(item.phase).toUpperCase() !== phase) return false;
        if (item.serial && String(item.serial).trim() !== serial) return false;
        return true;
      });
    }
    projected.v = targetV;
    return projected;
  }

  function fill(tpl, { state, res, schema, assets }) {
    state = Report.performed(state, schema, Schema.ATT_SECTIONS); // hạng mục không thực hiện: không ghi số liệu vào BBTN
    const miss = [];
    const out = Report.decimal(state.cfg.decSep);
    const write = (f, value) => {
      if (value === undefined || value === null || String(value).trim() === '') return;
      if (!tpl.writeField(f.doc, out(value))) miss.push(f.label || f.k);
    };
    const v = state.v;
    const is3P = schema.layout === Schema.LAYOUT_3P;
    Report.prepare(tpl, schema); // chèn hàng template thiếu (vd nhiệt độ từng sứ ở mẫu 3 pha) trước khi ghi
    if (schema.docSwaps) swapHeadings(tpl, schema.docSwaps); // OLTC ở cuộn trung áp: đổi nhãn đề mục trước khi ghi nhiệt độ
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
    schema.sections.forEach(s => {
      const S = res.sec[s.id];
      const tick = state.sum.tick[s.id] ?? !!S.status;
      const ev = state.sum.ev[s.id];
      // mẫu 3 pha: mục 3 (cách điện cuộn dây) và mục 4 (lõi từ, gông từ) cùng lấy theo hạng mục cách điện của app
      [].concat(SUM.rows[s.id] ?? []).forEach(row => {
        tpl.setCellText(tpl.cell([0], row, SUM.tick), tick ? '✓' : '');
        tpl.setCellText(tpl.cell([0], row, SUM.ev), ev === '—' ? '' : (ev || (tick ? S.text : '')));
      });
    });
    // mẫu 3 pha: mục 12 SFRA đánh dấu khi đã nạp báo cáo SFRA làm phụ lục
    if (SUM.fra !== undefined) {
      if (state.att && state.att.fra) tpl.setCellText(tpl.cell([0], SUM.fra, SUM.tick), '✓');
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
    // template thiếu đoạn "THIẾT BỊ THÍ NGHIỆM" → vẫn xuất kết quả ngắn mạch thành phụ lục (không mất số liệu)
    const sc = shortCircuitToBody(tpl, state, schema, res, A, out, SUM);
    if (sc === 'fallback') miss.push('Thí nghiệm ngắn mạch: không thấy đoạn "THIẾT BỊ THÍ NGHIỆM" trong template — đã xuất thành phụ lục');
    if (tpl.appendSection) Appendix.list(state, { shortCircuit: sc === 'fallback', fra: !!A.fraDoc, oil: Object.fromEntries(Object.keys(A.oilDocs || {}).map(id => [id, true])), bct: bctAppx }).forEach(a => {
      if (a.kind === 'oltc') tpl.appendSection(oltcAppendix(state, state.att.oltc, A, out, a.label));
      if (a.kind === 'fra') { tpl.appendSection(Appendix.fraHeader(a.label, state.att.fra)); tpl.importBody(A.fraDoc); }
      if (a.kind === 'oil') { const item = state.att.oil.items.find(x => x.id === a.id); tpl.appendSection(Appendix.oilHeader(a.label, item)); tpl.importBody(A.oilDocs[a.id]); }
      if (a.kind === 'dfr') tpl.appendSection(Dfr.appendix(state, A, out, a.label));
      if (a.kind === 'shortCircuit') tpl.appendSection(Appendix.shortCircuitAppendix(state, A.shortCircuitRows || [], A.factoryName, out, a.label));
      if (a.kind === 'bct') tpl.appendSection(bctAppendix(state, schema, res, out, a.label));
      if (a.kind === 'standards') tpl.appendSection(Appendix.standardsAppendix(a.label));
    });
    return { cells, miss };
  }

  // Mẫu 110–220 kV, OLTC ở cuộn trung áp: bảng nấc của template dùng cho cuộn trung áp / tỷ số MV:LV, bảng một hàng cho
  // cuộn cao áp / HV:LV → đổi chỗ nhãn đề mục đứng trước hai bảng (tên cuộn dây, cấp điện áp; "Cuộn HV:LV" ↔ "Cuộn MV:LV").
  // Đoạn không tìm thấy (template đã sửa tay) thì bỏ qua, không đoán.
  const SWAP_RE = {
    // nhãn gồm cả dấu chấm cuối câu (nếu có) để setSlot không chèn khoảng trắng trước dấu chấm
    winding: [/(?<v>Cuộn dây\s+(?:cao|trung)\s+(?:thế|áp)\s*,\s*\(\s*[HM]\.?\s*V\.?\s+Winding\s*\)\s*\.?)/i, /Cuộn dây\s*(?<v>\d+(?:[.,]\d+)?\s*kV)/i],
    ratio: [/Cuộn\s+(?<v>[HM]V\s*:\s*LV\s*\.?)/i],
  };
  function swapHeadings(tpl, swaps) {
    if (!tpl.paraBefore || !tpl.getSlot || !tpl.setSlot) return;
    swaps.forEach(sw => (SWAP_RE[sw.kind] || []).forEach(re => {
      const pa = tpl.paraBefore(sw.a, re), pb = tpl.paraBefore(sw.b, re);
      if (!pa || !pb || pa === pb) return;
      const va = tpl.getSlot(pa, re), vb = tpl.getSlot(pb, re);
      if (va === null || vb === null) return;
      tpl.setSlot(pa, re, vb);
      tpl.setSlot(pb, re, va);
    }));
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

  // Thí nghiệm ngắn mạch: mục cuối biên bản (template Word không có) — thêm hàng "N. Thí nghiệm ngắn mạch…" vào bảng hạng
  // mục trang 1 (sau hạng mục cuối, gắn dấu hàng do app thêm) và, khi có số liệu, đề mục + bảng kết quả ngay trước
  // "THIẾT BỊ THÍ NGHIỆM". Làm sau khi đã ghi mọi ô của bảng 0 (chèn hàng làm dời chỉ số các hàng sau).
  const TESTING_INSTRUMENTS = /THI[ẾE]T\s+B[ỊI]\s+TH[ÍI]\s+NGHI[ỆE]M|Testing\s+instruments/i;
  function shortCircuitToBody(tpl, state, schema, res, A, out, SUM) {
    const sec = schema.sections.find(s => s.id === 'shortCircuit');
    const S = sec && res.sec[sec.id];
    if (!sec || !S || S.skipped || Report.isSkipped(state, sec.id)) return false;
    const label = `${sec.no}. ${sec.title} (Short-circuit impedance and load loss)`;
    const last = Math.max(...Object.values(SUM.rows || {}).flatMap(x => [].concat(x)));
    const tr = tpl.insertRowAfter && Number.isFinite(last) ? tpl.insertRowAfter(0, last, label, { mark: true }) : null;
    if (tr && tr.nodeType && tpl.cellAt) {
      // hàng mới không thuộc template (bộ đọc hàng bỏ qua) → ghi thẳng vào ô của hàng vừa chèn
      const tick = (state.sum && state.sum.tick && state.sum.tick[sec.id]) ?? !!S.status;
      const ev = state.sum && state.sum.ev && state.sum.ev[sec.id];
      tpl.setCellText(tpl.cellAt(tr, SUM.tick), tick ? '✓' : '');
      tpl.setCellText(tpl.cellAt(tr, SUM.ev), ev === '—' ? '' : (ev || (tick ? S.text : '')));
    }
    if (!Appendix.shortCircuitHasData(state.att && state.att.shortCircuit)) return true;
    const p = tpl.bodyPara && tpl.insertBlocksBefore ? tpl.bodyPara(TESTING_INSTRUMENTS) : null;
    if (!p) return 'fallback';
    tpl.insertBlocksBefore(p, [{ type: 'p', text: `${label}:`, bold: true, size: 12, keepNext: true }]
      .concat(Appendix.shortCircuitBlocks(A.shortCircuitRows || [], out, n => `${sec.no}.${n}`)));
    return 'body';
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
  window.MbaReport = { fill, shortCircuitToBody, swapHeadings, phaseState, oltcAppendix, bctAppendix, bctBlocks, bctToBody, hasBct, minTables: 72, stdTables: 73 };
})();
