// Mẫu MBA 3 pha 110–220 kV (dựng từ mẫu theo pha, ánh xạ lại chỉ số bảng) và nhập BBTN cũ (.docx) thành biên bản.
// Không dùng file thật: kiểm tra cấu trúc ánh xạ, nhận dạng mẫu, đọc ngày, đọc khe giữa nhãn và đơn vị, nguồn lần thí nghiệm.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, CORE } = require('./harness');
const F = require('./mba-fixture');

const cfgOf = (ctx, template, cores) => Object.assign(ctx.EquipmentTypes.get('MBA').defaultCfg(), { template }, cores ? { bctCores: cores } : {});

test('mẫu 110-220: cùng hạng mục với mẫu theo pha, bảng ánh xạ lại trong 71 bảng, nấc 1…19', () => {
  const ctx = load(CORE), S = ctx.Schema;
  for (const hv of [4, 5, 6]) {
    const cores = { hv, mv: Math.min(hv, 5), lv: 4 };
    const a = S.build(cfgOf(ctx, 'A', cores)), b = S.build(cfgOf(ctx, '110', cores));
    assert.equal(b.layout, '110'); assert.equal(b.tables, 71);
    const grids = s => { const o = []; ctx.Common.eachGrid(s, g => o.push(g)); return o; };
    const ga = grids(a), gb = grids(b);
    assert.deepEqual(gb.map(g => g.id), ga.map(g => g.id), 'cùng lưới, cùng thứ tự');
    gb.forEach((g, i) => {
      assert.deepEqual(g.rows.map(r => r.k), ga[i].rows.map(r => r.k));
      if (!g.tables) return;
      assert.ok(g.tables.length > 0, `${g.id}: có bảng`);
      g.tables.forEach(t => assert.ok(t >= 0 && t <= 70, `${g.id}: bảng ${t} trong mẫu 71 bảng`));
      // bảng liền nhau tăng dần (bảng ngắt trang ghép theo thứ tự)
      g.tables.slice(1).forEach((t, k) => assert.equal(t, g.tables[k] + 1, `${g.id}: bảng ghép liền nhau`));
    });
  }
  const b = S.build(cfgOf(ctx, '110'));
  assert.deepEqual(Array.from(b.taps), Array.from({ length: 19 }, (_, i) => String(i + 1)));
  // sứ trung áp: hàng kiểu loại / hãng cùng lưới cột với các hàng khác (không cmap như mẫu theo pha)
  const mv = ctx.Common.findGrid(b, 'b.mv.meas');
  assert.ok(mv.rows.every(r => !r.cmap));
  assert.ok(ctx.Common.findGrid(S.build(cfgOf(ctx, 'A')), 'b.mv.meas').rows.some(r => r.cmap));
  // trường ghi vào đoạn văn trước bảng / trong ô cũng được ánh xạ lại
  const f = {}; ctx.Common.eachField(b, x => { f[x.k] = x; });
  // không trường nào trỏ vào bảng đã gộp (ánh xạ rỗng → chỉ số undefined)
  for (const hv of [4, 5, 6]) {
    const s = S.build(cfgOf(ctx, '110', { hv, mv: Math.min(hv, 5), lv: 4 }));
    ctx.Common.eachField(s, x => { if (x.doc && ('t' in x.doc || 'before' in x.doc)) assert.ok(Number.isInteger(x.doc.t ?? x.doc.before), `${x.k}: có bảng`); });
    s.sections.forEach(sec => (sec.extraDoc || []).forEach(x => assert.ok(Number.isInteger(x.doc.t ?? x.doc.before), `${x.k}: có bảng`)));
  }
  assert.equal(f['oltc.type'].doc.t, 24); assert.equal(f['moist.val'].doc.before, 25); assert.equal(f['bct.t_dcr'].doc.before, 64);
  // mẫu 110-220 không đổi template theo pha của máy chính
  assert.equal(ctx.EquipmentTypes.get('MBA').templateKeyFor({ cfg: cfgOf(ctx, '110'), v: {} }, null), null);
});

test('nhập BBTN cũ: nhận dạng mẫu theo số bảng phần biên bản, đọc ngày nhiều dạng', () => {
  const { MbaImportReport: I } = load(CORE);
  assert.deepEqual([28, 71, 73, 72, 40].map(I.detectLayout), ['3P', '110', '1P', '1P', null]);
  assert.equal(I.normDate('14/11/2026'), '14/11/2026');
  assert.equal(I.normDate('3.5.2025'), '03/05/2025');
  assert.equal(I.normDate('Khánh Hòa, ngày 7 tháng 12 năm 2024'), '07/12/2024');
  assert.equal(I.normDate('chưa ghi'), '');
});

// Tài liệu giả tối thiểu cho Report.readValues: đoạn văn theo bảng, ô theo (bảng, hàng, cột)
function fakeTpl(paras, cells) {
  const p = t => ({ t });
  return {
    tables: [], rows: () => [],
    readField(spec) {
      const list = spec.before !== undefined ? (paras[spec.before] || []) : [];
      const hit = list.find(x => spec.re.test(x));
      if (!hit) return null;
      const m = spec.re.exec(hit);
      return m && m.groups ? m.groups.v.trim() : null;
    },
    cell(tables, r, c) { const t = cells[`${tables[0]}.${r}.${c}`]; return t === undefined ? null : { textContent: t }; },
    insertRowAfter() {}, p,
  };
}

test('đọc khe giữa nhãn và đơn vị khi đã có giá trị; ô số kèm chú thích lấy số đầu', () => {
  const ctx = load(CORE);
  const schema = ctx.Schema.build(cfgOf(ctx, 'A'));
  const tpl = fakeTpl({
    4: ['Đo ở nhiệt độ (Insulation resistance at the temperature): 27,5 oC'],
    8: ['Trị số tgδ sứ quy đổi về 20oC; Loại sứ: RIP; Hệ số quy đổi K = 1,070 (fc = 0,935 tại T sứ = 24,3 °C)'],
    26: ['Đo hàm lượng ẩm trong cách điện cứng: Độ ẩm: 0,8 %'],
  }, { '17.1.1': '150,2', '7.4.2': '0,31' });
  const v = ctx.Report.readValues(tpl, schema, { all: true });
  assert.equal(v['ir.t'], '27,5');
  assert.equal(v['b.hv.btype'], 'RIP');
  assert.equal(v['b.hv.k'], '1,070');
  assert.equal(v['moist.val'], '0,8');
  assert.equal(v['dcr.hv.t1.A'], '150,2');
  assert.equal(v['b.hv.meas.tgd1.A'], '0,31');
  // mẫu trống: khe rỗng → không có giá trị (giá trị mặc định của template)
  const d = ctx.Report.readDefaults(fakeTpl({ 4: ['Đo ở nhiệt độ (Insulation resistance at the temperature): oC'] }, {}), schema);
  assert.equal(d['ir.t'], undefined);
});

test('BBTN nhập từ file: lần thí nghiệm nguồn "manual" kèm tên file; biên bản hiện trường giữ "field_app"', () => {
  const ctx = load(CORE);
  const { state, schema } = F.fullState(ctx.Schema, {});
  const res = ctx.Evaluate.evaluate(state, null, schema);
  const T = ctx.EquipmentTypes.get('MBA').toRows;
  assert.equal(T.fieldRows(state, res, schema).session.source, 'field_app');
  assert.ok(!('source_file' in T.fieldRows(state, res, schema).session));
  const s2 = Object.assign({}, state, { imported: { file: 'BBTN_cu.docx' } });
  const pack = T.fieldRows(s2, res, schema);
  assert.equal(pack.session.source, 'manual');
  assert.equal(pack.session.source_file, 'BBTN_cu.docx');
});
