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
    ['hv', 'mv', 'lv'].forEach(w => {
      if (!targetFieldKeys.has(`dcr.${w}.t`)) return;
      const t = Schema.dcrTemp(k => num(sourceV[k]), `dcr.${w}`, phase, true);
      if (Number.isFinite(t)) targetV[`dcr.${w}.t`] = String(t).replace('.', ',');
    });
    // Vị trí lắp đặt có chữ "pha X" (vd mặc định mẫu pha A) → pha của biên bản đang tách
    if (targetV['meta.site'] !== undefined) targetV['meta.site'] = Common.sitePhase(targetV['meta.site'], phase);
    if (sourceSchema.layout === Schema.LAYOUT_3P) {
      const txt = k => String(sourceV[k] ?? '').trim();
      // Nhiệt độ sứ: mẫu theo pha có một ô cho mỗi phía (cao áp / trung áp + trung tính / hạ áp); mẫu 3 pha có nhiệt độ riêng
      // từng sứ (hàng t) và ô chung theo phía, ô chung trống thì lấy nhiệt độ sứ cao áp (như đánh giá) →
      // nhiệt độ sứ của pha đang tách → ô chung của phía → ô sứ cao áp
      ['hv', 'mv', 'lv'].forEach(side => {
        const k = `b.${side}.t`;
        if (!targetFieldKeys.has(k)) return;
        const own = side === 'lv' ? [`b.lv.meas.t.${phase.toLowerCase()}`, `b.lv2.meas.t.${phase.toLowerCase()}`] : [`b.${side}.meas.t.${phase}`];
        const t = own.concat([k, 'b.hv.t']).map(txt).find(Boolean);
        if (t) targetV[k] = t;
      });
      // Kiểm tra bên ngoài: mẫu theo pha là một dòng chữ; mẫu 3 pha là bảng hạng mục có đánh giá → ô chữ trống thì tóm tắt
      // từ bảng (cùng một đánh giá → ghi đánh giá đó; khác nhau → "hạng mục: đánh giá; …")
      const vg = targetFieldKeys.has('visual.text') && !txt('visual.text') && Common.findGrid(sourceSchema, 'visual.items');
      if (vg) {
        const items = vg.rows.map(r => [r.label, txt(`visual.items.${r.k}.e`)]).filter(x => x[1]);
        const evs = [...new Set(items.map(x => x[1]))];
        if (evs.length === 1) targetV['visual.text'] = evs[0];
        else if (evs.length > 1) targetV['visual.text'] = items.map(([l, e]) => `${l}: ${e}`).join('; ');
      }
    }
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
          // mẫu theo pha: bảng sứ hạ áp là hai sứ của máy — cột a ← sứ 3.1, cột b ← sứ 3.2 của pha đó; cột c bỏ trống
          if (targetSchema.unitOwn && /^b\.lv\.(meas|c20)$/.test(targetGrid.id) && /^[abc]$/.test(col.k)) {
            if (col.k === 'c') return;
            sourceForCell = sourceGrids.get(col.k === 'a' ? targetGrid.id : targetGrid.id.replace('b.lv.', 'b.lv2.'));
            sourceColKey = lowerPhase;
          } else if (targetGrid.id === 'b.mv.meas' && col.k === 'N') {
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
    // OLTC: mẫu 3 pha ghi số vòng quay theo pha (6 lần tăng + 6 lần giảm nấc); mẫu theo pha chỉ có 2 dòng → BBTN pha ghi các
    // lần chuyển nấc có số liệu của pha này theo chiều người dùng chọn (cfg.oltcSplitDirs: both | up | down, chung cho 3 pha)
    delete att.oltcRounds; delete att.nlPu; delete att.bushingRows;
    if (sourceSchema.layout === Schema.LAYOUT_3P) {
      const s = k => String(sourceV[k] ?? '').trim();
      // đánh dấu BBTN tách từ mẫu 3 pha: đánh giá tính sứ trung tính theo cách quy đổi riêng (b.n.*) như mẫu 3 pha
      projected.cfg.splitFrom = '3P';
      // %Uđm của các lần đo không tải → cột đầu bảng không tải của mẫu theo pha (template ghi sẵn "Uđm")
      const nl = Common.findGrid(targetSchema, 'nl.rated');
      if (nl) {
        const pu = Object.fromEntries(nl.rows.map(r => [r.k, s(`nl.${phase}.rated.${r.k}.pu`)]).filter(x => x[1]));
        if (Object.keys(pu).length) att.nlPu = pu;
      }
      // Hàng sứ chỉ mẫu 3 pha có (mã hiệu, Uđm, Iđm, nhiệt độ đo từng sứ) → chèn sau hàng số chế tạo ở bảng sứ của mẫu theo pha.
      // Cột: sứ của pha đang tách; trung tính (cột N bảng trung áp) ← sứ N của máy đó; hạ áp a / b ← sứ 3.1 / 3.2 của máy đó
      const lp = phase.toLowerCase(), rowsOut = [];
      ['b.hv.meas', 'b.mv.meas', 'b.lv.meas'].forEach(id => {
        const tg = Common.findGrid(targetSchema, id), sg = Common.findGrid(sourceSchema, id);
        if (!tg || !tg.tables || !sg) return;
        const srcOf = c => {
          if (id === 'b.lv.meas' && targetSchema.unitOwn) return c.k === 'a' ? [id, lp] : c.k === 'b' ? ['b.lv2.meas', lp] : null;
          if (id === 'b.mv.meas' && c.k === 'N') return ['b.n.meas', phase];
          return c.k === phase || c.k === lp ? [id, c.k] : null;
        };
        const rows = sg.rows.filter(r => ['code', 'ur', 'ir', 't'].includes(r.k)).map(r => {
          const vals = {};
          tg.cols.filter(c => c.phase).forEach(c => { const src = srcOf(c); const x = src && s(`${src[0]}.${r.k}.${src[1]}`); if (x) vals[c.k] = x; });
          return { label: r.label, vals };
        }).filter(r => Object.keys(r.vals).length);
        if (rows.length) rowsOut.push({ grid: id, rows });
      });
      if (rowsOut.length) att.bushingRows = rowsOut;
    }
    const og = Common.findGrid(sourceSchema, 'oltc.r');
    if (og && Common.findGrid(targetSchema, 'oltc.rounds')) {
      const dirs = state.cfg.oltcSplitDirs || 'both', s = k => String(sourceV[k] ?? '').trim();
      att.oltcRounds = og.rows.filter(r => dirs === 'both' || r.k.startsWith(dirs === 'down' ? 'dn' : 'up'))
        .map(r => ({ label: r.label, tap: s(`oltc.r.${r.k}.tap`), k: s(`oltc.r.${r.k}.k${phase}`), cyc: s(`oltc.r.${r.k}.c${phase}`) }))
        .filter(x => x.k || x.cyc);
    }
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
    // DFR cách điện cuộn dây: phép đo của pha này và phép đo không ghi pha (số chế tạo trong file DIRANA không dùng để lọc)
    if (att.dfrw && Array.isArray(att.dfrw.items)) {
      att.dfrw.items = DfrW.forPhase(att.dfrw.items, phase);
      if (!att.dfrw.items.length) delete att.dfrw;
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

  const DCR_GRID = /^dcr\.(hv|mv|lv)$/;
  const DCR_REF_RE = /qu[iy] đổi về(?<v>\s*[-+]?\d*(?:[.,]\d+)?\s*)oC/i;
  const num = x => { const n = parseFloat(String(x ?? '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  // "28; 30; 31" — nhiệt độ đo từng pha của cuộn dây (theo thứ tự cột pha), khi chưa nhập nhiệt độ chung
  function dcrPhaseTemps(v, schema, g) {
    let grid = null;
    eachGrid(schema, x => { if (x.id === g) grid = x; });
    const ts = grid ? grid.cols.filter(c => c.phase).map(c => String(v[`${g}.t${c.k}`] ?? '').trim()).filter(Boolean) : [];
    return ts.join('; ');
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
    const dcrRefTxt = String(Schema.dcrRefOf(state.cfg)).replace('.', ',');
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
      // BBTN theo pha tách từ mẫu 3 pha: sứ trung tính có hệ số K riêng → ghi kèm dòng K phía trung áp
      if (m && res.notes[`${f.k}N`]) val = [String(val ?? '').trim(), res.notes[`${f.k}N`]].filter(Boolean).join('; ');
      if (/\.btype$/.test(f.k)) val = val || 'RIP';
      // nhiệt độ đo R một chiều: ô chung trống mà đã nhập nhiệt độ từng pha → ghi các nhiệt độ pha (bảng ghi R@75 °C)
      const dt = f.k.match(/^dcr\.(hv|mv|lv)\.t$/);
      if (dt && !String(val ?? '').trim()) val = dcrPhaseTemps(v, schema, `dcr.${dt[1]}`);
      // mẫu theo pha: dòng "đo ở nhiệt độ t = … oC" ghi thêm nhiệt độ quy đổi → "t = 28 oC, quy đổi về 75 oC"
      if (dt && !is3P && String(val ?? '').trim()) val = `${String(val).trim()} oC, quy đổi về ${dcrRefTxt}`;
      // mẫu 3 pha: "Pha X: t = …" là nhiệt độ đã dùng quy đổi cuộn cao áp của pha X (ô pha → ô chung của cuộn → máy)
      const ut = is3P && f.k.match(/^dcr\.([ABC])\.t$/);
      if (ut) { const t = Schema.dcrTemp(k => num(v[k]), 'dcr.hv', ut[1], true); if (Number.isFinite(t)) val = String(t).replace('.', ','); }
      write(f, val);
    });
    schema.sections.forEach(s => (s.extraDoc || []).forEach(x => write({ doc: x.doc, k: x.k }, (res.notes[x.k] || '').trim())));
    // mẫu 3 pha: đề mục "… Pha C: t = oC, qui đổi về 75 oC" → nhiệt độ quy đổi đã chọn
    if (is3P) {
      let fA = null;
      eachField(schema, f => { if (f.k === 'dcr.A.t') fA = f; });
      if (fA && fA.doc) write({ doc: { before: fA.doc.before, re: DCR_REF_RE }, k: 'cfg.dcrRefT' }, dcrRefTxt);
    }
    let cells = 0;
    // Mục 6: thêm hàng cho đối tượng đo bổ sung (bảng số liệu đo và bảng quy đổi 20 °C)
    const nExtra = (state.cfg.wtgdRows || []).length;
    if (nExtra && !is3P) eachGrid(schema, g => { if (/^wtgd\./.test(g.id)) tpl.appendRows(g.tables[0], nExtra); });
    // BBTN theo pha tách từ mẫu 3 pha: %Uđm các lần đo không tải; hàng sứ chỉ mẫu 3 pha có (chèn sau hàng số chế tạo,
    // hàng đánh dấu "app thêm" nên không làm lệch chỉ số hàng của template)
    if (!is3P && state.att && state.att.nlPu) {
      const g = Common.findGrid(schema, 'nl.rated');
      if (g && g.tables) g.rows.forEach(r => { const x = state.att.nlPu[r.k]; if (x && tpl.setCellText(tpl.cell(g.tables, r.doc, 0), out(x))) cells++; });
    }
    if (!is3P && state.att && state.att.bushingRows && tpl.insertRowAfter && tpl.rows) state.att.bushingRows.forEach(({ grid, rows }) => {
      const g = Common.findGrid(schema, grid), sr = g && g.tables && g.rows.find(r => r.k === 'serial');
      const tr = sr && tpl.rows(g.tables)[sr.doc];
      const ti = tr && g.tables.find(t => tpl.tables[t] === tr.parentNode);
      if (typeof ti !== 'number') { miss.push(`${grid}: không thấy hàng số chế tạo sứ để chèn ${rows.map(r => r.label).join(', ')}`); return; }
      let after = Array.from(tpl.tables[ti].childNodes).filter(n => n.localName === 'tr').indexOf(tr);
      rows.forEach(row => {
        const nt = tpl.insertRowAfter(ti, after++, row.label, { mark: true });
        if (!nt || !nt.nodeType) return;
        Object.entries(row.vals).forEach(([ck, x]) => {
          const c = g.cols.find(y => y.k === ck);
          if (c && c.doc !== undefined && tpl.setCellText(tpl.cellAt(nt, c.doc), out(x))) cells++;
        });
      });
    });
    // BBTN theo pha tách từ mẫu 3 pha: bảng số vòng quay OLTC thêm hàng cho đủ các lần chuyển nấc đã chọn của pha
    const rounds = !is3P && state.att && state.att.oltcRounds;
    if (rounds) {
      const g = Common.findGrid(schema, 'oltc.rounds');
      if (!rounds.length) miss.push(`OLTC: không có số vòng quay của pha ${state.cfg.template} ở chiều đã chọn (Mẫu & cấu hình → Phạm vi xuất BBTN)`);
      else if (g && g.tables) {
        const t = g.tables[0], r0 = g.rows[0].doc, at = k => (g.cols.find(c => c.k === k) || {}).doc;
        if (rounds.length > g.rows.length) tpl.appendRows(t, rounds.length - g.rows.length);
        rounds.forEach((x, i) => {
          tpl.setCellText(tpl.cell([t], r0 + i, 0), x.tap ? `${x.label} – nấc đến: ${x.tap}` : x.label);
          [['k', x.k], ['cyc', x.cyc]].forEach(([k, val]) => { if (val) { if (tpl.setCellText(tpl.cell([t], r0 + i, at(k)), out(val))) cells++; else miss.push(`oltc.rounds ${x.label}`); } });
        });
      }
    }
    eachGrid(schema, g => {
      if (!g.tables) return; // bảng chỉ có trong app
      if (rounds && g.id === 'oltc.rounds') return; // đã ghi ở trên (vd quy đổi 20 °C sứ, biến dòng chân sứ ở mẫu 3 pha → phụ lục)
      // Đối tượng đo đã sửa/thêm → ghi vào cột đầu; đề mục cột đã sửa → ghi vào hàng tiêu đề của template
      if (/^wtgd\./.test(g.id) && !is3P) g.rows.forEach(r => { if (r.label && r.label !== r.defLabel) tpl.setCellText(tpl.cell(g.tables, r.doc, 0), r.label); });
      // nhãn hàng sửa được khác (vd chỉ danh biến dòng chân sứ): ghi vào cột nhãn của bảng (lblCol, mặc định cột 0)
      if (g.editLabels && !/^wtgd\./.test(g.id)) g.rows.forEach(r => { if (r.label && r.defLabel !== undefined && r.label !== r.defLabel) tpl.setCellText(tpl.cell(g.tables, r.doc, g.lblCol || 0), r.label); });
      // đề mục cột: so với chữ trên template (tplLabel, vd cột "a" của mẫu theo pha ghi thành "3.1");
      // hàng tiêu đề lệch cột như hàng kiểu loại / hãng (cmap, bảng sứ trung áp) thì dùng cùng vị trí
      if (g.editHdr || g.hdrDoc) {
        const cm = (g.rows[0] && g.rows[0].cmap) || {};
        g.cols.forEach(c => {
          if (c.noEdit || c.defLabel === undefined) return;
          if (c.label !== (c.tplLabel ?? c.defLabel)) tpl.setCellText(tpl.cell([g.tables[0]], 0, cm[c.k] !== undefined ? cm[c.k] : c.doc), c.label);
        });
      }
      // đề mục cột đổi theo cấu hình (vd 7.1 đo A-Am thay cho A-N) → ghi chữ tương ứng vào hàng tiêu đề của template
      g.cols.forEach(c => { if (c.docLabel && c.doc !== undefined) tpl.setCellText(tpl.cell([g.tables[0]], 0, c.doc), c.docLabel); });
      // bảng đặc tính từ hóa có số liệu điểm khuỷu → chèn cột thứ 4 vào bảng của template
      const exWide = g.ex && g.rows.some(r => (v[`${g.id}.${r.k}.p4`] || '').toString().trim());
      if (exWide) tpl.ensureColumns(g.tables, 5);
      g.rows.forEach(r => g.cols.forEach(c => {
        if (r.nodoc || c.nodoc || c.doc === undefined || (g.skip && g.skip(r.k, c.k))) return;
        const key = `${g.id}.${r.k}.${c.k}`;
        let val = (g.readonly || c.calc) ? res.calc[key] : ((v[key] ?? '').toString().trim() || res.calc[key]);
        if (val === undefined || val === null || String(val).trim() === '') return;
        // R một chiều: BBTN ghi giá trị đã quy về 75 °C theo nhiệt độ đo của pha; thiếu nhiệt độ thì không ghi số chưa quy đổi
        if (DCR_GRID.test(g.id) && c.phase) {
          val = res.calc[`${g.id}.${r.k}.r75${c.k}`];
          if (val === undefined) { miss.push(`${key} (thiếu nhiệt độ đo để quy về ${dcrRefTxt} °C)`); return; }
        }
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
      if (a.kind === 'dfrw') tpl.appendSection(DfrW.appendix(state, A, out, a.label));
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
  window.MbaReport = { DCR_REF_RE, fill, shortCircuitToBody, swapHeadings, phaseState, oltcAppendix, bctAppendix, bctBlocks, bctToBody, hasBct, minTables: 72, stdTables: 73 };
})();
