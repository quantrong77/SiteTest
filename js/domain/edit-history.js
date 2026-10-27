// Lịch sử chỉnh sửa số liệu theo hạng mục để hoàn tác (sửa ô, dán, nhập file máy đo, xóa hạng mục).
// Mỗi bước ghi giá trị CŨ của các ô bị đổi, tách theo hạng mục; hoàn tác lấy bước gần nhất của đúng hạng mục đó.
// Giữ trong phiên làm việc (không lưu kèm biên bản); tạo / mở biên bản khác thì xóa lịch sử.
(function () {
  'use strict';
  const MAX = 200;
  let steps = [];
  const blank = x => x === undefined || x === null || String(x) === '';
  const same = (a, b) => (blank(a) && blank(b)) || String(a) === String(b);

  // Ảnh trạng thái trước khi sửa; withAtt = false khi chắc chắn không đổi số liệu đính kèm (gõ ô)
  function snapshot(state, withAtt = true) {
    return { v: Object.assign({}, state.v), att: withAtt ? JSON.stringify(state.att || {}) : null };
  }

  // So trước/sau → mỗi hạng mục bị ảnh hưởng thêm một bước. secOf: khóa → hạng mục; attSec: khóa state.att → hạng mục
  function record(label, before, state, secOf, attSec = {}) {
    const by = {};
    const bucket = s => (by[s] = by[s] || { v: {}, att: {} });
    new Set(Object.keys(before.v).concat(Object.keys(state.v))).forEach(k => {
      if (same(before.v[k], state.v[k])) return;
      const s = secOf(k);
      if (s) bucket(s).v[k] = before.v[k];
    });
    if (before.att !== null) {
      const A = JSON.parse(before.att), B = state.att || {};
      new Set(Object.keys(A).concat(Object.keys(B))).forEach(k => {
        if (JSON.stringify(A[k]) === JSON.stringify(B[k]) || !attSec[k]) return;
        bucket(attSec[k]).att[k] = A[k] === undefined ? null : JSON.stringify(A[k]);
      });
    }
    const secs = Object.keys(by);
    secs.forEach(sec => steps.push({ sec, label, v: by[sec].v, att: by[sec].att, at: Date.now() }));
    if (steps.length > MAX) steps = steps.slice(-MAX);
    return secs;
  }

  // Hoàn tác bước gần nhất của hạng mục: trả lại giá trị cũ (ô trước đó trống thì xóa khóa)
  function undo(sec, state) {
    let i = steps.length - 1;
    while (i >= 0 && steps[i].sec !== sec) i--;
    if (i < 0) return null;
    const st = steps.splice(i, 1)[0];
    Object.entries(st.v).forEach(([k, old]) => { if (old === undefined) delete state.v[k]; else state.v[k] = old; });
    state.att = state.att || {};
    Object.entries(st.att).forEach(([k, old]) => { if (old === null) delete state.att[k]; else state.att[k] = JSON.parse(old); });
    return st;
  }

  // Khóa có số liệu của hạng mục (để xóa) và hạng mục còn số liệu không
  const keysOf = (sec, state, secOf) => Object.keys(state.v).filter(k => secOf(k) === sec && !blank(state.v[k]));
  const attOf = (sec, state, attSec = {}) => Object.keys(state.att || {}).filter(k => attSec[k] === sec);
  function clearSection(sec, state, secOf, attSec) {
    const keys = keysOf(sec, state, secOf), atts = attOf(sec, state, attSec);
    keys.forEach(k => { delete state.v[k]; });
    atts.forEach(k => { delete state.att[k]; });
    return keys.length + atts.length;
  }
  const hasData = (sec, state, secOf, attSec) => keysOf(sec, state, secOf).length > 0 || attOf(sec, state, attSec).length > 0;

  const count = sec => steps.filter(s => s.sec === sec).length;
  const last = sec => { for (let i = steps.length - 1; i >= 0; i--) if (steps[i].sec === sec) return steps[i]; return null; };
  const reset = () => { steps = []; };

  window.EditHistory = { snapshot, record, undo, clearSection, hasData, count, last, reset };
})();
