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
    return part.items.map(item => `<button class="m3d-link" data-m3dgo="${esc(item.id)}">${esc(item.no)}. ${esc(item.title)}</button>`).join('');
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
    return `<section class="card m3d">
      <h1>Mô hình 3D MBA</h1>
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

  function makeScene(THREE, parts, res) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cssColor('--bg', '#e4e6e1'));
    const models = [];
    const partById = new Map(parts.map(part => [part.id, part]));
    const statusColors = setStatusColors(THREE);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7b8790, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(4, 8, 6);
    scene.add(light);

    function addMesh(id, geometry, color, opacity = 1) {
      const material = new THREE.MeshStandardMaterial({
        color, roughness: .55, transparent: opacity < 1, opacity,
        emissive: statusColors[statusOf(partById.get(id) || { items: [] }, res)],
        emissiveIntensity: .25,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.part = id;
      mesh.userData.baseColor = new THREE.Color(color);
      models.push(mesh);
      scene.add(mesh);
      return mesh;
    }

    function addBox(id, x, y, z, sx, sy, sz, color, opacity = 1) {
      const mesh = addMesh(id, new THREE.BoxGeometry(sx, sy, sz), color, opacity);
      mesh.position.set(x, y, z);
      return mesh;
    }

    function addCylinder(id, x, y, z, radius, height, color) {
      const mesh = addMesh(id, new THREE.CylinderGeometry(radius, radius, height, 24), color);
      mesh.position.set(x, y, z);
      return mesh;
    }

    // Vỏ thùng trong suốt bọc lõi từ và cuộn dây: đánh dấu để khi bấm xuyên qua vỏ thì ưu tiên bộ phận bên trong
    addBox('tank', 0, 1.55, 0, 3.4, 2.7, 2.2, '#91aab5', .56).userData.shell = true;
    addBox('core', 0, 1.55, 0, 1.6, 2, .45, '#bd8b43');
    [-.48, 0, .48].forEach((x, i) => addCylinder('windings', x, 1.45, .45, .26, 1.65, ['#a84f43', '#d0a63c', '#526c9b'][i]));
    addBushings(addCylinder, partById);
    addBox('oltc', 2.15, 1.55, 0, .85, 2.3, 1.15, '#647d86');
    addBox('oltc', 2.2, .35, .75, .8, .8, .5, '#9aaeb2');
    const conservator = addCylinder('conservator', 0, 3.5, 0, .45, 2.8, '#8098a0');
    conservator.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) addBox('radiator', -2.25 + i * .18, 1.5, 0, .1, 2.3, .8, '#607a83');
    addBox('control', -2.3, .75, 1.1, .8, 1.2, .6, '#788f96');
    addBox('tank', 0, .5, 1.13, .9, .45, .08, '#e7dfc4');
    applyPartColors(models, partById, statusColors, res);
    return { scene, models, partById, statusColors };
  }

  function addBushings(addCylinder, partById) {
    [['bush-hv', -1.05, 3.25, -.6], ['bush-mv', 0, 3.25, -.6], ['bush-n', 1.05, 3.25, -.6], ['bush-lv', 0, 3.05, .8]]
      .forEach(([id, x, y, z]) => {
        if (!partById.has(id)) return;
        addCylinder(id, x, y, z, .16, .9, '#d7e4cf');
        if (partById.has('bct')) addCylinder('bct', x, y - .65, z, .22, .22, '#586f78');
      });
  }

  function applyPartColors(models, partById, colors, res) {
    models.forEach(mesh => {
      const part = partById.get(mesh.userData.part);
      const status = part ? statusOf(part, res) : 'missing';
      mesh.material.emissive.copy(colors[status]);
    });
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
        const sectionId = button.dataset.m3dgo;
        closePartMenu(root);
        App.go(sectionId);
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

  function initControls(THREE, renderer, camera, scene, canvasBox, note, root, parts, frame) {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointers = new Map();
    let start = null, moved = false, yaw = .65, pitch = .42, distance = 9;
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
      const height = Math.max(280, Math.min(430, width * .68));
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
      const hits = raycaster.intersectObjects(scene.children.filter(child => child.isMesh));
      const hit = hits.find(h => !h.object.userData.shell) || hits[0];
      return hit ? hit.object : null;
    }

    function handleHover(event) {
      if (pointers.size || moved) return;
      const mesh = pick(event);
      if (hovered && hovered !== mesh) hovered.material.emissiveIntensity = .25;
      hovered = mesh || null;
      if (hovered) {
        hovered.material.emissiveIntensity = .7;
        const name = names.get(hovered.userData.part) || hovered.userData.part;
        const part = parts.find(item => item.id === hovered.userData.part);
        const targets = part ? part.items.map(item => `${item.no}. ${item.title}`).join(' · ') : '';
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
        distance = Math.max(5, Math.min(15, start.distance - delta * .025));
      } else {
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) > 5) moved = true;
        yaw = start.yaw + dx * .008;
        pitch = Math.max(-.2, Math.min(1.2, start.pitch + dy * .008));
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
      distance = Math.max(5, Math.min(15, distance + event.deltaY * .008));
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
        if (object.material) object.material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    }

    function reset() { yaw = .65; pitch = .42; distance = 9; frame(yaw, pitch, distance); }
    renderer.domElement.tabIndex = 0;
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
      const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.domElement.style.touchAction = 'none';
      canvasBox.appendChild(renderer.domElement);
      const { scene } = makeScene(THREE, parts, App.res);
      const frame = (yaw, pitch, distance) => {
        camera.position.set(distance * Math.sin(yaw) * Math.cos(pitch), distance * Math.sin(pitch), distance * Math.cos(yaw) * Math.cos(pitch));
        camera.lookAt(0, 1.5, 0);
        renderer.render(scene, camera);
      };
      initControls(THREE, renderer, camera, scene, canvasBox, note, root, parts, frame);
      note.textContent = 'Kéo để xoay, cuộn hoặc chụm để thu phóng; bấm bộ phận để mở hạng mục.';
    } catch (error) {
      note.textContent = 'Không tải được mô hình 3D. Kiểm tra kết nối CDN hoặc WebGL; danh sách bộ phận vẫn dùng được.';
    }
  }

  window.MbaModel3DUI = { render, init };
})();
