// Kho file đính kèm biên bản trong trình duyệt (IndexedDB): file lớn như báo cáo SFRA (.docx có ảnh) không để
// trong localStorage. Biên bản chỉ giữ mã file; file đi kèm khi lưu .json (base64) và khi lưu CSDL (Storage).
(function () {
  'use strict';
  const DBN = 'bbtn-mba-files', STORE = 'files';
  let opening = null;

  function db() {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        const rq = indexedDB.open(DBN, 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => reject(rq.error || new Error('Không mở được kho file của trình duyệt'));
      });
      opening.catch(() => { opening = null; });
    }
    return opening;
  }
  async function run(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode), st = tx.objectStore(STORE);
      const rq = fn(st);
      tx.oncomplete = () => resolve(rq && rq.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Ghi kho file bị hủy (đầy bộ nhớ?)'));
    });
  }

  // { name, type, bytes: ArrayBuffer }
  const put = (id, rec) => run('readwrite', st => st.put(rec, id));
  const get = id => run('readonly', st => st.get(id)).then(r => r || null);
  const del = id => run('readwrite', st => st.delete(id));

  window.FileStore = { put, get, del };
})();
