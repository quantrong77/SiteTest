// Dựng mô hình MBA bằng hình khối và nối bộ phận tới schema đang mở.
(function () {
  'use strict';

  let threePromise;
  const STATUS_ORDER = ['fail', 'warn', 'pass', 'missing'];
  const STATUS_LABEL = { fail: 'Không đạt', warn: 'Cần xem xét', pass: 'Đạt', missing: 'Chưa có số liệu' };
  const esc = value => App.esc(value);

  function statusOf(part, res) {
    const statuses = part.items.map(item => res && res.sec[item.id] && res.sec[item.id].status).filter(Boolean);
    return STATUS_ORDER.find(status => statuses.includes(status)) || 'missing';
  }

  function itemLinks(part) {
    return part.items.map(item => {
      const label = item.no ? `${esc(item.no)}. ${esc(item.title)}` : esc(item.title);
      // liên kết ra app ngoài (app DGA) mở tab mới, kèm số chế tạo của biên bản
      if (item.link === 'dga') return `<a class="m3d-link" href="${esc(Appendix.dgaLink(App.state.v['meta.serial']))}" target="_blank" rel="noopener">${label}</a>`;
      const anchor = item.anchor ? ` data-m3danchor="${esc(item.anchor)}"` : '';
      return `<button class="m3d-link" data-m3dgo="${esc(item.id)}"${anchor}>${label}</button>`;
    }).join('');
  }

  function partList(parts, res) {
    return parts.map(part => {
      const status = statusOf(part, res);
      return `<div class="m3d-part st-${status}" data-part-status="${status}">
        <button class="btn btn-secondary" data-m3dpart="${esc(part.id)}" aria-label="${esc(part.name)} — ${STATUS_LABEL[status]}">${esc(part.name)}</button>
        <div class="m3d-links">${itemLinks(part)}</div>
      </div>`;
    }).join('');
  }

  function legend() {
    return `<div class="m3d-legend" aria-label="Chú giải trạng thái">
      <span class="st-pass">Đạt</span><span class="st-warn">Cần xem xét</span>
      <span class="st-fail">Không đạt</span><span class="st-missing">Chưa có số liệu</span>
    </div>`;
  }

  function render(schema, res) {
    const parts = MbaModel3DMap.partsFor(schema);
    return `<section class="panel m3d">
      <div class="panel-head"><span class="secno">3D</span><h2>Mô hình 3D MBA</h2><span class="en">Transformer 3D map</span></div>
      <p class="muted">Chọn một bộ phận để xem và mở hạng mục thí nghiệm trong mẫu hiện tại.</p>
      ${legend()}
      <div class="m3d-layout">
        <div class="m3d-visual">
          <div class="m3d-toolbar"><button class="btn" data-m3dreset>Đặt lại góc nhìn</button></div>
          <div class="m3d-canvas" data-m3dcanvas aria-label="Mô hình máy biến áp 3D"></div>
          <p class="m3d-note" data-m3dnote role="status">Đang tải thư viện 3D…</p>
        </div>
        <div class="m3d-parts" aria-label="Danh sách bộ phận">${partList(parts, res)}</div>
      </div>
    </section>`;
  }

  function cssColor(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function setStatusColors(THREE) {
    return {
      fail: new THREE.Color(cssColor('--fail', '#b8261c')),
      warn: new THREE.Color(cssColor('--warn', '#8f5d00')),
      pass: new THREE.Color(cssColor('--pass', '#1a7f4b')),
      missing: new THREE.Color(cssColor('--missing', '#6a4c9c')),
    };
  }

  // Độ sáng phát xạ theo trạng thái: nền nhẹ để giữ màu vật liệu, sáng hơn khi rê chuột
  const GLOW = .2, GLOW_HOVER = .65;
  const TANK_TOP = 2.9;
  const COLOR = {
    tank: '#8fa3ad', steel: '#6d7c85', dark: '#3d4a52', core: '#59636b', copper: '#b4643a', paper: '#d6a35a',
    porcelain: '#8a4a2c', flange: '#a9b4ba', cap: '#d3d9dc', tap: '#c79a3a', turret: '#5f727c', plate: '#ece4c8',
  };

  function makeScene(THREE, parts, res) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cssColor('--bg', '#e4e6e1'));
    const models = [];
    const partById = new Map(parts.map(part => [part.id, part]));
    const statusColors = setStatusColors(THREE);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6f7a80, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(5, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
    sun.shadow.bias = -.0008;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfe8ff, .7);
    fill.position.set(-6, 4, -4);
    scene.add(fill);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.ShadowMaterial({ opacity: .18 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const kit = makeKit(THREE, scene, models, partById, statusColors, res);
    buildTank(kit);
    buildCore(kit);
    buildBushings(kit, partById);
    buildOltc(kit);
    buildConservator(kit);
    buildRadiators(kit);
    buildControl(kit);
    return { scene, models, partById, statusColors };
  }

  // Bộ dựng hình: mỗi khối gắn mã bộ phận (userData.part) để bấm chọn và tô màu trạng thái
  function makeKit(THREE, scene, models, partById, statusColors, res) {
    function mesh(id, geometry, color, opts = {}) {
      const part = partById.get(id);
      const material = new THREE.MeshStandardMaterial({
        color, roughness: opts.roughness ?? .55, metalness: opts.metalness ?? .15,
        transparent: opts.opacity < 1, opacity: opts.opacity ?? 1, depthWrite: !(opts.opacity < 1),
        emissive: statusColors[part ? statusOf(part, res) : 'missing'], emissiveIntensity: part ? GLOW : 0,
      });
      const m = new THREE.Mesh(geometry, material);
      m.userData.part = id;
      if (opts.shell) m.userData.shell = true;
      m.castShadow = !(opts.opacity < 1);
      m.receiveShadow = true;
      if (part) models.push(m);
      scene.add(m);
      return m;
    }
    const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
    return {
      THREE, scene, mesh,
      box: (id, x, y, z, sx, sy, sz, color, opts) => at(mesh(id, new THREE.BoxGeometry(sx, sy, sz), color, opts), x, y, z),
      cyl: (id, x, y, z, r, h, color, opts = {}) => at(mesh(id, new THREE.CylinderGeometry(opts.top ?? r, r, h, opts.seg || 32), color, opts), x, y, z),
      lathe: (id, x, y, z, points, color, opts) => at(mesh(id, new THREE.LatheGeometry(points.map(([px, py]) => new THREE.Vector2(px, py)), 40), color, opts), x, y, z),
      label: (text, x, y, z) => scene.add(at(textSprite(THREE, text), x, y, z)),
      edges: (target, color) => {
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(target.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .55 }));
        lines.position.copy(target.position);
        scene.add(lines);
      },
    };
  }

  function textSprite(THREE, text) {
    const canvas = document.createElement('canvas');
    canvas.width = 192; canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(23,34,45,.82)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(8, 10, 176, 60, 14) : ctx.rect(8, 10, 176, 60);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 96, 42);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.set(.6, .25, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  // Thùng máy trong suốt (thấy lõi từ, cuộn dây), nắp, gân tăng cứng, đế trượt và nhãn máy
  function buildTank(k) {
    const shell = k.box('tank', 0, 1.55, 0, 3.4, 2.7, 2.2, COLOR.tank, { opacity: .3, shell: true, roughness: .35 });
    k.edges(shell, '#41545e');
    k.box('tank', 0, TANK_TOP + .03, 0, 3.55, .07, 2.35, COLOR.steel, { opacity: .55, shell: true, metalness: .4 });
    [-1.15, -.4, .4, 1.15].forEach(x => [1.12, -1.12].forEach(z => k.box('tank', x, 1.55, z, .07, 2.6, .05, COLOR.steel, { shell: true, metalness: .4 })));
    [.75, -.75].forEach(z => k.box('tank', 0, .1, z, 3.7, .2, .28, COLOR.dark, { metalness: .5 }));
    k.box('tank', .75, .7, 1.15, .7, .42, .03, COLOR.plate, { roughness: .4 });
  }

  // Mạch từ 3 trụ 2 gông; mỗi trụ hai cuộn dây đồng tâm (trong: hạ áp, ngoài: cao/trung áp)
  function buildCore(k) {
    const limbs = [-.9, 0, .9];
    limbs.forEach(x => k.box('core', x, 1.55, 0, .26, 2.05, .26, COLOR.core, { metalness: .5, roughness: .4 }));
    [.48, 2.62].forEach(y => k.box('core', 0, y, 0, 2.1, .28, .3, COLOR.core, { metalness: .5, roughness: .4 }));
    const tube = (ri, ro, h) => [[ri, -h / 2], [ro, -h / 2], [ro, h / 2], [ri, h / 2], [ri, -h / 2]];
    limbs.forEach(x => {
      k.lathe('windings', x, 1.55, 0, tube(.17, .25, 1.55), COLOR.paper);
      k.lathe('windings', x, 1.55, 0, tube(.28, .4, 1.62), COLOR.copper, { metalness: .35, roughness: .45 });
    });
  }

  // Sứ có tán: biên dạng xoay gồm thân sứ và các tán xen kẽ lớn/nhỏ
  function shedProfile(r, h, sheds) {
    const pts = [[0, 0], [r, 0]];
    const pitch = h / (sheds + 1);
    for (let i = 0; i < sheds; i++) {
      const y = pitch * (i + .5), R = r * (i % 2 ? 1.55 : 1.85);
      pts.push([r, y], [R, y + pitch * .18], [R * .96, y + pitch * .3], [r, y + pitch * .62]);
    }
    pts.push([r * .9, h], [0, h]);
    return pts;
  }

  // Một sứ đầu vào: ống chứa BCT trên nắp thùng, mặt bích, đầu đo tgδ (test tap), thân sứ có tán, đầu cực
  function addBushing(k, id, x, z, size, withBct) {
    const { r, h, sheds } = size;
    let y = TANK_TOP + .07;
    if (withBct) { k.cyl('bct', x, y + .16, z, r * 2.1, .32, COLOR.turret, { metalness: .45, roughness: .4 }); y += .32; }
    k.cyl(id, x, y + .05, z, r * 1.7, .1, COLOR.flange, { metalness: .6, roughness: .35 });
    const tap = k.cyl(id, x + r * 1.9, y + .07, z, .035, .12, COLOR.tap, { metalness: .7, roughness: .3, seg: 16 });
    tap.rotation.z = Math.PI / 2;
    k.lathe(id, x, y + .1, z, shedProfile(r, h, sheds), COLOR.porcelain, { roughness: .22, metalness: .05 });
    const top = y + .1 + h;
    k.cyl(id, x, top + .06, z, r * 1.05, .12, COLOR.cap, { metalness: .7, roughness: .3 });
    k.cyl(id, x, top + .18, z, r * .3, .14, COLOR.cap, { metalness: .7, roughness: .3, seg: 16 });
    return top + .25;
  }

  const BUSHING_ROWS = [
    { id: 'bush-hv', label: 'HV', z: -.6, xs: [-1.05, 0, 1.05], size: { r: .11, h: 1.55, sheds: 12 } },
    { id: 'bush-mv', label: 'MV', z: .12, xs: [-1.05, -.4, .25], size: { r: .09, h: 1.0, sheds: 8 } },
    { id: 'bush-n', label: 'N', z: .12, xs: [1.05], size: { r: .08, h: .78, sheds: 6 } },
    { id: 'bush-lv', label: 'LV', z: .78, xs: [-.7, 0, .7], size: { r: .09, h: .55, sheds: 4 } },
  ];

  function buildBushings(k, partById) {
    const withBct = partById.has('bct');
    BUSHING_ROWS.forEach(row => {
      if (!partById.has(row.id)) return;
      let top = 0;
      row.xs.forEach(x => { top = addBushing(k, row.id, x, row.z, row.size, withBct); });
      k.label(row.label, row.xs[row.xs.length - 1] + (row.xs.length > 1 ? .38 : .3), top + .1, row.z);
    });
  }

  // Ngăn bộ điều áp bên hông thùng, tủ truyền động và trục truyền động
  function buildOltc(k) {
    k.cyl('oltc', 2.05, 1.65, 0, .42, 2.3, COLOR.steel, { metalness: .4, roughness: .45 });
    k.cyl('oltc', 2.05, 2.86, 0, .46, .1, COLOR.dark, { metalness: .5 });
    k.box('oltc', 2.05, 1.05, .78, .62, .78, .38, '#93a7ad', { roughness: .5 });
    k.box('oltc', 2.05, 1.05, .98, .5, .62, .02, '#7b8f96');
    k.cyl('oltc', 2.05, 1.95, .5, .03, 1.05, COLOR.dark, { seg: 12 });
    k.label('OLTC', 2.05, 3.2, 0);
  }

  // Bình dầu phụ trên giá đỡ, ống dẫn dầu xuống nắp thùng qua rơ le hơi
  function buildConservator(k) {
    const { THREE } = k;
    const body = k.mesh('conservator', new THREE.CapsuleGeometry(.38, 2.2, 8, 32), '#8199a2', { metalness: .35, roughness: .45 });
    body.rotation.z = Math.PI / 2;
    body.position.set(-.2, 4.35, -1.4);
    [-1.1, .7].forEach(x => {
      k.box('conservator', x, 3.6, -1.4, .08, 1.4, .08, COLOR.dark, { metalness: .5 });
      k.box('conservator', x, TANK_TOP + .08, -1.25, .12, .08, .4, COLOR.dark, { metalness: .5 });
    });
    k.cyl('conservator', -.2, 3.6, -1.15, .05, 1.35, COLOR.steel, { seg: 16, metalness: .5 });
    k.box('conservator', -.2, 3.45, -1.15, .22, .18, .18, '#3f5a66', { metalness: .4 });
    k.cyl('conservator', .95, 4.35, -1.4, .07, .3, '#c9d6db', { seg: 16 });
  }

  // Dàn cánh tản nhiệt kiểu tấm hai bên ống góp, quạt làm mát bên dưới
  function buildRadiators(k) {
    const x = -2.55;
    for (let i = 0; i < 9; i++) k.box('radiator', x, 1.55, -.8 + i * .2, .75, 1.85, .04, '#6b858e', { metalness: .45, roughness: .4 });
    [2.55, .6].forEach(y => {
      const header = k.cyl('radiator', x, y, 0, .07, 1.8, COLOR.steel, { seg: 16, metalness: .5 });
      header.rotation.x = Math.PI / 2;
      const pipe = k.cyl('radiator', -2.0, y, 0, .07, .6, COLOR.steel, { seg: 16, metalness: .5 });
      pipe.rotation.z = Math.PI / 2;
    });
    [-.45, .45].forEach(z => {
      k.cyl('radiator', x, .32, z, .3, .12, COLOR.dark, { metalness: .3 });
      k.cyl('radiator', x, .32, z, .06, .14, '#c5ced2', { seg: 12 });
    });
  }

  // Tủ điều khiển đặt trước thùng, có cửa và tay nắm
  function buildControl(k) {
    k.box('control', -1.15, .8, 1.55, .85, 1.3, .45, '#7f949b', { roughness: .5 });
    k.box('control', -1.15, .8, 1.785, .75, 1.18, .02, '#6c8087');
    k.box('control', -.88, .85, 1.81, .04, .18, .03, COLOR.cap, { metalness: .7 });
  }

  function openPart(partId, parts, root, x, y) {
    const part = parts.find(item => item.id === partId);
    if (!part) return;
    if (part.items.length === 1) {
      App.go(part.items[0].id);
      return;
    }
    showPartMenu(part, root, x, y);
  }

  function showPartMenu(part, root, x, y) {
    closePartMenu(root);
    const box = root.querySelector('[data-m3dcanvas]');
    const menu = document.createElement('div');
    menu.className = 'm3d-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Hạng mục của ${part.name}`);
    menu.innerHTML = `<strong>${esc(part.name)}</strong>${itemLinks(part)}`;
    menu.querySelectorAll('[data-m3dgo]').forEach(button => {
      button.setAttribute('role', 'menuitem');
      button.addEventListener('click', event => {
        event.stopPropagation();
        const sectionId = button.dataset.m3dgo, anchor = button.dataset.m3danchor;
        closePartMenu(root);
        App.go(sectionId);
        if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
      });
    });
    const bounds = box.getBoundingClientRect();
    box.appendChild(menu);
    // đặt menu sau khi biết kích thước thật để không bị khung mô hình cắt mép phải / dòng cuối
    menu.style.left = `${Math.max(8, Math.min(x - bounds.left, bounds.width - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y - bounds.top, bounds.height - menu.offsetHeight - 8))}px`;
    menu.querySelector('button').focus();
    menu._outside = event => { if (!menu.contains(event.target)) closePartMenu(root); };
    menu._escape = event => { if (event.key === 'Escape') { closePartMenu(root); root.querySelector('[data-m3dcanvas] canvas')?.focus(); } };
    document.addEventListener('pointerdown', menu._outside);
    document.addEventListener('keydown', menu._escape);
  }

  function closePartMenu(root) {
    const menu = root.querySelector('.m3d-menu');
    if (!menu) return;
    document.removeEventListener('pointerdown', menu._outside);
    document.removeEventListener('keydown', menu._escape);
    menu.remove();
  }

  const VIEW = { yaw: .7, pitch: .38, distance: 11.5, min: 6, max: 18 };

  // Làm sáng mọi khối của một bộ phận (rê chuột trên mô hình hoặc trên danh sách)
  function highlight(models, partId) {
    models.forEach(mesh => { mesh.material.emissiveIntensity = mesh.userData.part === partId ? GLOW_HOVER : GLOW; });
  }

  function initControls(THREE, renderer, camera, scene, models, canvasBox, note, root, parts, frame) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointers = new Map();
    let start = null, moved = false, yaw = VIEW.yaw, pitch = VIEW.pitch, distance = VIEW.distance;
    let hovered = null;
    const names = new Map(parts.map(part => [part.id, part.name]));
    const resizeObserver = new ResizeObserver(() => resize());
    const mutationObserver = new MutationObserver(() => {
      if (!canvasBox.isConnected) cleanup();
    });
    resizeObserver.observe(canvasBox);
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

    function resize() {
      if (!canvasBox.isConnected) return;
      const width = canvasBox.clientWidth;
      const height = Math.max(300, Math.min(480, width * .72));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      frame(yaw, pitch, distance);
    }

    function setPointer(event) {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    }

    // Bộ phận dưới con trỏ: bỏ qua vỏ thùng trong suốt nếu tia còn trúng bộ phận khác phía sau (lõi từ, cuộn dây)
    function pick(event) {
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(models);
      const hit = hits.find(h => !h.object.userData.shell) || hits[0];
      return hit ? hit.object : null;
    }

    function handleHover(event) {
      if (pointers.size || moved) return;
      const mesh = pick(event);
      hovered = mesh || null;
      highlight(models, hovered && hovered.userData.part);
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
      root.querySelectorAll('.m3d-part').forEach(el => el.classList.toggle('is-hover', !!hovered && el.querySelector('[data-m3dpart]').dataset.m3dpart === hovered.userData.part));
      if (hovered) {
        const name = names.get(hovered.userData.part) || hovered.userData.part;
        const part = parts.find(item => item.id === hovered.userData.part);
        const targets = part ? part.items.map(item => (item.no ? `${item.no}. ${item.title}` : item.title)).join(' · ') : '';
        renderer.domElement.title = `${name} — ${targets}`;
        note.textContent = `${name}${targets ? `: ${targets}` : ''}`;
      } else {
        renderer.domElement.title = '';
        note.textContent = 'Kéo để xoay, cuộn hoặc chụm để thu phóng; bấm bộ phận để mở hạng mục.';
      }
      frame(yaw, pitch, distance);
    }

    function handleDown(event) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      renderer.domElement.setPointerCapture(event.pointerId);
      if (pointers.size === 1) {
        start = { x: event.clientX, y: event.clientY, yaw, pitch };
        moved = false;
      } else {
        start = { pinch: pointerDistance() , distance };
        moved = true;
      }
    }

    function pointerDistance() {
      const points = [...pointers.values()];
      if (points.length < 2) return 0;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }

    function handleMove(event) {
      if (!pointers.has(event.pointerId)) return handleHover(event);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!start) return;
      if (pointers.size >= 2) {
        const delta = pointerDistance() - start.pinch;
        if (Math.abs(delta) > 5) moved = true;
        distance = Math.max(VIEW.min, Math.min(VIEW.max, start.distance - delta * .03));
      } else {
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) > 5) moved = true;
        yaw = start.yaw + dx * .008;
        pitch = Math.max(.02, Math.min(1.3, start.pitch + dy * .008));
      }
      frame(yaw, pitch, distance);
    }

    function handleUp(event) {
      pointers.delete(event.pointerId);
      if (pointers.size === 1) {
        const remaining = [...pointers.values()][0];
        start = { x: remaining.x, y: remaining.y, yaw, pitch };
        moved = true;
      } else start = null;
    }

    function handleClick(event) {
      if (moved) { moved = false; return; }
      const mesh = pick(event);
      if (mesh) openPart(mesh.userData.part, parts, root, event.clientX, event.clientY);
    }

    function zoom(event) {
      distance = Math.max(VIEW.min, Math.min(VIEW.max, distance + event.deltaY * .01));
      frame(yaw, pitch, distance);
    }

    function cleanup() {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', handleMove);
      renderer.domElement.removeEventListener('pointerdown', handleDown);
      renderer.domElement.removeEventListener('pointerup', handleUp);
      renderer.domElement.removeEventListener('pointercancel', handleUp);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.domElement.removeEventListener('wheel', zoom);
      root.querySelector('[data-m3dreset]')?.removeEventListener('click', reset);
      closePartMenu(root);
      scene.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) { if (object.material.map) object.material.map.dispose(); object.material.dispose(); }
      });
      renderer.dispose();
      renderer.domElement.remove();
    }

    function reset() { yaw = VIEW.yaw; pitch = VIEW.pitch; distance = VIEW.distance; frame(yaw, pitch, distance); }
    // rê chuột trên danh sách bộ phận thì sáng bộ phận tương ứng trên mô hình
    root.querySelectorAll('[data-m3dpart]').forEach(button => {
      button.addEventListener('mouseenter', () => { highlight(models, button.dataset.m3dpart); frame(yaw, pitch, distance); });
      button.addEventListener('mouseleave', () => { highlight(models, null); frame(yaw, pitch, distance); });
    });
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointermove', handleMove);
    renderer.domElement.addEventListener('pointerdown', handleDown);
    renderer.domElement.addEventListener('pointerup', handleUp);
    renderer.domElement.addEventListener('pointercancel', handleUp);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('wheel', zoom, { passive: true });
    root.querySelector('[data-m3dreset]').addEventListener('click', reset);
    resize();
  }

  async function init(root) {
    const canvasBox = root.querySelector('[data-m3dcanvas]');
    const note = root.querySelector('[data-m3dnote]');
    const parts = MbaModel3DMap.partsFor(App.schema);
    root.querySelectorAll('[data-m3dpart]').forEach(button => {
      button.title = button.getAttribute('aria-label');
      button.addEventListener('mouseenter', () => button.closest('.m3d-part').classList.add('is-hover'));
      button.addEventListener('mouseleave', () => button.closest('.m3d-part').classList.remove('is-hover'));
      button.addEventListener('click', () => {
        const bounds = button.getBoundingClientRect();
        openPart(button.dataset.m3dpart, parts, root, bounds.left, bounds.bottom);
      });
    });
    try {
      threePromise ||= import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
      const THREE = await threePromise;
      if (!canvasBox.isConnected) return;
      const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.style.touchAction = 'none';
      canvasBox.appendChild(renderer.domElement);
      const { scene, models } = makeScene(THREE, parts, App.res);
      const frame = (yaw, pitch, distance) => {
        camera.position.set(distance * Math.sin(yaw) * Math.cos(pitch), 2.1 + distance * Math.sin(pitch), distance * Math.cos(yaw) * Math.cos(pitch));
        camera.lookAt(0, 2.1, 0);
        renderer.render(scene, camera);
      };
      initControls(THREE, renderer, camera, scene, models, canvasBox, note, root, parts, frame);
      note.textContent = 'Kéo để xoay, cuộn hoặc chụm để thu phóng; bấm bộ phận để mở hạng mục.';
    } catch (error) {
      note.textContent = 'Không tải được mô hình 3D. Kiểm tra kết nối CDN hoặc WebGL; danh sách bộ phận vẫn dùng được.';
    }
  }

  window.MbaModel3DUI = { render, init };
})();
