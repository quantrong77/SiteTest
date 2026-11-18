import { ChevronDown, ChevronsLeft, ChevronsRight, Database, FileSpreadsheet, FileText, FolderOpen, HelpCircle, Menu, Plus, Save } from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// Trạng thái giao diện theo từng máy (không phải dữ liệu biên bản) — localStorage có thể bị chặn nên luôn bọc try/catch
const LS_SIDEBAR = 'bbtn-ui.sidebar';
const LS_GROUPS = 'bbtn-ui.navGroups';
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 360;
const SIDEBAR_DEFAULT = 272;

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // trình duyệt chặn lưu trữ: giao diện vẫn chạy, chỉ không nhớ trạng thái
  }
}

const clampWidth = width => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)));

function BrandMark() {
  return (
    <span className="brand-mark grid place-items-center" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <circle cx="9" cy="12" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="15" cy="12" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

// Menu điều hướng: mục nhóm theo item.groupId (app.js navItems). Nhóm collapsible đóng / mở được, tự mở khi chứa mục đang xem.
function SidebarNavigation({ collapsed }) {
  const [navigation, setNavigation] = useState({ items: [], progressHTML: '' });
  const [openGroups, setOpenGroups] = useState(() => readJson(LS_GROUPS, {}));

  useLayoutEffect(() => {
    const update = event => setNavigation(event.detail);
    window.addEventListener('legacy:navigation', update);
    return () => window.removeEventListener('legacy:navigation', update);
  }, []);

  const toggleGroup = id => setOpenGroups(prev => {
    const next = { ...prev, [id]: !prev[id] };
    writeJson(LS_GROUPS, next);
    return next;
  });

  const groups = [];
  navigation.items.forEach(item => {
    const last = groups[groups.length - 1];
    if (last && last.id === item.groupId) last.items.push(item);
    else groups.push({ id: item.groupId, label: item.group, collapsible: item.collapsible, items: [item] });
  });

  return (
    <>
      {navigation.progressHTML && !collapsed && <div className="sidebar-progress" dangerouslySetInnerHTML={{ __html: navigation.progressHTML }} />}
      {groups.map(group => {
        const hasCurrent = group.items.some(item => item.current);
        const open = !group.collapsible || collapsed || hasCurrent || !!openGroups[group.id];
        const listId = `nav-group-${group.id}`;
        return (
          <Fragment key={group.id}>
            {group.label && (group.collapsible && !collapsed ? (
              <button type="button" className="nav-group nav-group-toggle" aria-expanded={open} aria-controls={listId}
                disabled={hasCurrent} onClick={() => toggleGroup(group.id)}>
                <span>{group.label}</span>
                <ChevronDown className={`nav-group-chevron${open ? ' open' : ''}`} aria-hidden="true" />
              </button>
            ) : (
              <div className="nav-group">{group.label}</div>
            ))}
            <div id={listId} hidden={!open}>
              {group.items.map(item => (
                <button key={item.id} className={`nav-item${item.current ? ' active' : ''}${item.workflow === 'skip' ? ' skipped' : ''}`}
                  data-nav={item.id} type="button" aria-current={item.current ? 'page' : undefined}
                  title={collapsed ? `${item.no} · ${item.title}${item.tip ? ` — ${item.tip}` : ''}` : undefined}>
                  <span className={`brk${item.status ? ` st-${item.status}` : ''}${item.flip ? ' flip' : ''}`} title={collapsed ? undefined : item.tip || undefined} aria-hidden="true" />
                  <span className="nav-no">{item.no}</span>
                  <span className="nav-t">
                    {item.title}
                    {item.failCount > 0 && <span className="cnt">{item.failCount} lỗi</span>}
                    {item.workflow && <span className={`nav-st st-${item.workflow}`}>{item.workflowLabel}</span>}
                  </span>
                  {item.tip && <span className="sr-only">{item.tip}</span>}
                </button>
              ))}
            </div>
          </Fragment>
        );
      })}
    </>
  );
}

// Nút có menu thả xuống; mục menu mang data-act / data-nav của mã cũ (app.js onClick bắt theo ủy quyền sự kiện)
function MenuButton({ label, icon, variant = 'outline', items, title }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('[aria-haspopup]')?.focus();
      }
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const list = [...rootRef.current.querySelectorAll('[role="menuitem"]')];
    const i = list.indexOf(document.activeElement);
    list[(i + (event.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
  };

  return (
    <div className="menu-root" ref={rootRef}>
      <Button variant={variant} size="sm" type="button" aria-haspopup="menu" aria-expanded={open} title={title} onClick={() => setOpen(v => !v)}>
        {icon}<span className="btn-label">{label}</span><ChevronDown className="menu-caret" aria-hidden="true" />
      </Button>
      {open && (
        <div className="menu-pop" role="menu" onKeyDown={onMenuKey}>
          {items.map(item => (
            <button key={item.label} type="button" role="menuitem" className="menu-item" data-act={item.act} data-nav={item.nav}
              onClick={() => setTimeout(() => setOpen(false), 0)}>
              {item.icon}
              <span>
                <span className="menu-item-label">{item.label}</span>
                {item.hint && <span className="menu-item-hint">{item.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const [sidebar, setSidebar] = useState(() => {
    const s = readJson(LS_SIDEBAR, { collapsed: false, width: SIDEBAR_DEFAULT });
    return { collapsed: !!s.collapsed, width: clampWidth(Number(s.width) || SIDEBAR_DEFAULT) };
  });
  const drag = useRef(null);

  const update = useCallback(patch => setSidebar(prev => {
    const next = { ...prev, ...patch };
    writeJson(LS_SIDEBAR, next);
    return next;
  }), []);
  const toggleCollapsed = useCallback(() => setSidebar(prev => {
    const next = { ...prev, collapsed: !prev.collapsed };
    writeJson(LS_SIDEBAR, next);
    return next;
  }), []);

  // Ctrl+B (⌘B): thu gọn / mở sidebar trên máy tính
  useEffect(() => {
    const onKey = event => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'b') {
        if (!window.matchMedia('(min-width: 1024px)').matches) return;
        event.preventDefault();
        toggleCollapsed();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  const onResizeDown = event => {
    if (sidebar.collapsed) return;
    event.preventDefault();
    drag.current = { x: event.clientX, w: sidebar.width };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add('is-resizing');
  };
  const onResizeMove = event => {
    if (!drag.current) return;
    setSidebar(prev => ({ ...prev, width: clampWidth(drag.current.w + event.clientX - drag.current.x) }));
  };
  const onResizeUp = () => {
    if (!drag.current) return;
    drag.current = null;
    document.body.classList.remove('is-resizing');
    setSidebar(prev => { writeJson(LS_SIDEBAR, prev); return prev; });
  };
  const onResizeKey = event => {
    const step = event.shiftKey ? 40 : 16;
    if (event.key === 'ArrowLeft') { event.preventDefault(); update({ width: clampWidth(sidebar.width - step) }); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); update({ width: clampWidth(sidebar.width + step) }); }
    else if (event.key === 'Home') { event.preventDefault(); update({ width: SIDEBAR_DEFAULT }); }
  };

  const collapsed = sidebar.collapsed;
  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`} style={{ '--sidebar-w': `${sidebar.width}px` }}>
      <aside className="workspace-sidebar" id="nav" aria-label="Điều hướng biên bản">
        <div className="sidebar-brand">
          <BrandMark />
          <div className="sidebar-brand-text">
            <div className="brand-title">Site Test Report</div>
            <div className="brand-sub">Thí nghiệm hiện trường</div>
          </div>
          <button type="button" className="sidebar-collapse" onClick={toggleCollapsed} aria-pressed={collapsed}
            aria-label={collapsed ? 'Mở rộng thanh điều hướng (Ctrl+B)' : 'Thu gọn thanh điều hướng (Ctrl+B)'}
            title={collapsed ? 'Mở rộng (Ctrl+B)' : 'Thu gọn (Ctrl+B)'}>
            {collapsed ? <ChevronsRight aria-hidden="true" /> : <ChevronsLeft aria-hidden="true" />}
          </button>
        </div>
        <nav className="sidenav" aria-label="Các phần biên bản">
          <div className="sld">
            <span className="bus" aria-hidden="true" />
            <div id="navItems"><SidebarNavigation collapsed={collapsed} /></div>
          </div>
        </nav>
        {!collapsed && (
          <div className="sidebar-resizer" role="separator" aria-orientation="vertical" tabIndex={0}
            aria-label="Đổi độ rộng thanh điều hướng (mũi tên trái / phải)" aria-valuemin={SIDEBAR_MIN} aria-valuemax={SIDEBAR_MAX} aria-valuenow={sidebar.width}
            onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={onResizeUp} onPointerCancel={onResizeUp}
            onKeyDown={onResizeKey} onDoubleClick={() => update({ width: SIDEBAR_DEFAULT })} />
        )}
      </aside>

      <button className="sidebar-backdrop" id="navBackdrop" type="button" aria-label="Đóng điều hướng" hidden />

      <div className="workspace-column">
        <header className="shell-header">
          <div className="header-main">
            <Button id="navToggle" className="menu-toggle" variant="outline" size="icon" type="button" aria-label="Mở điều hướng" aria-expanded="false">
              <Menu />
            </Button>
            <div className="record" id="recordChip" aria-live="polite" aria-label="Biên bản đang lập" />
            <div className="account" id="account" />
            <Button className="h-9 w-9 shrink-0 p-0" variant="ghost" size="icon" data-act="help" aria-label="Hướng dẫn sử dụng" title="Hướng dẫn sử dụng (phím F1)">
              <HelpCircle />
            </Button>
          </div>
          <div className="header-actions">
            <div className="actions" aria-label="Thao tác biên bản">
              <Button variant="outline" size="sm" data-act="new" title="Tạo biên bản mới (chọn loại thiết bị)">
                <Plus /><span className="btn-label">Mới</span>
              </Button>
              <MenuButton label="Mở" icon={<FolderOpen />} title="Mở biên bản đã lưu" items={[
                { label: 'Biên bản trong CSDL', hint: 'Danh sách biên bản đã lưu', nav: 'db', icon: <Database aria-hidden="true" /> },
                { label: 'File .json trên máy', hint: 'File đã lưu bằng “Lưu file .json”', act: 'open', icon: <FolderOpen aria-hidden="true" /> },
              ]} />
              <MenuButton label="Lưu" icon={<Save />} title="Lưu biên bản" items={[
                { label: 'Lưu lên CSDL', hint: 'Số liệu, đánh giá → xu hướng các lần sau', act: 'dbSave', icon: <Database aria-hidden="true" /> },
                { label: 'Lưu file .json', hint: 'Bản sao trên máy, mở lại khi không có mạng', act: 'save', icon: <Save aria-hidden="true" /> },
              ]} />
            </div>
            <div className="actions actions-export" aria-label="Xuất biên bản">
              <Button size="sm" data-act="docx" title="Điền dữ liệu vào template và tải BBTN (.docx)">
                <FileText /><span className="btn-label">Xuất BBTN .docx</span>
              </Button>
              <MenuButton label="Xuất khác" icon={<FileSpreadsheet />} variant="secondary" title="Các bản xuất khác" items={[
                { label: 'Bảng so sánh – đánh giá .xlsx', hint: 'Toàn bộ dòng đánh giá, giới hạn, căn cứ', act: 'xlsx', icon: <FileSpreadsheet aria-hidden="true" /> },
              ]} />
            </div>
          </div>
          <div className="netbar" id="netbar" aria-hidden="true" />
        </header>

        <div className="page-wrap">
          <main id="main" className="legacy-main" tabIndex="-1" />
        </div>
      </div>
    </div>
  );
}
