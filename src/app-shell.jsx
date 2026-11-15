import { Activity, Database, FileSpreadsheet, FileText, FolderOpen, HelpCircle, Menu, Plus, Save } from 'lucide-react';
import { Fragment, useLayoutEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

function SidebarNavigation() {
  const [navigation, setNavigation] = useState({ items: [], progressHTML: '' });

  useLayoutEffect(() => {
    const update = event => setNavigation(event.detail);
    window.addEventListener('legacy:navigation', update);
    return () => window.removeEventListener('legacy:navigation', update);
  }, []);

  return (
    <>
      {navigation.progressHTML && <div className="sidebar-progress" dangerouslySetInnerHTML={{ __html: navigation.progressHTML }} />}
      {navigation.items.map(item => (
        <Fragment key={item.id}>
          {item.group && <div className="nav-group">{item.group}</div>}
          <button className={`nav-item${item.current ? ' active' : ''}`} data-nav={item.id} type="button" aria-current={item.current ? 'page' : undefined}>
            <span className={`brk${item.status ? ` st-${item.status}` : ''}${item.flip ? ' flip' : ''}`} title={item.tip || undefined} aria-hidden="true" />
            <span className="nav-no">{item.no}</span>
            <span className="nav-t">
              {item.title}
              {item.failCount > 0 && <span className="cnt">{item.failCount} lỗi</span>}
              {item.workflow && <span className={`nav-st st-${item.workflow}`}>{item.workflowLabel}</span>}
            </span>
            {item.tip && <span className="sr-only">{item.tip}</span>}
          </button>
        </Fragment>
      ))}
    </>
  );
}

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="workspace-sidebar" id="nav" aria-label="Hạng mục">
        <div className="sidebar-brand">
          <BrandMark />
          <div>
            <div className="brand-title">Site Test Report</div>
            <div className="brand-sub">Hệ thống thí nghiệm hiện trường</div>
          </div>
        </div>
        <div className="sidebar-caption">Điều hướng biên bản</div>
        <nav className="sidenav" aria-label="Các phần biên bản">
          <div className="sld">
            <span className="bus" aria-hidden="true" />
            <div id="navItems"><SidebarNavigation /></div>
          </div>
        </nav>
        <div className="sidebar-foot">
          <strong>MÁY BIẾN ÁP</strong>
          Nhập liệu · Đối chiếu · Phát hành
        </div>
      </aside>

      <button className="sidebar-backdrop" id="navBackdrop" type="button" aria-label="Đóng điều hướng" hidden />

      <div className="workspace-column">
        <header className="shell-header">
          <div className="header-main">
            <Button id="navToggle" className="menu-toggle" variant="outline" size="icon" type="button" aria-label="Mở điều hướng" aria-expanded="false">
              <Menu />
            </Button>
            <div className="header-heading">
              <strong>Biên bản thí nghiệm</strong>
              <span>Thông tin thiết bị và phiên làm việc</span>
            </div>
            <div className="record" id="recordChip" aria-live="polite" />
            <Button className="hidden h-9 w-9 shrink-0 p-0 sm:inline-flex" variant="ghost" size="icon" data-act="help" aria-label="Hướng dẫn sử dụng" title="Hướng dẫn sử dụng (phím F1)">
              <HelpCircle />
            </Button>
            <div className="account" id="account" />
          </div>
          <div className="header-actions">
            <div className="actions" aria-label="Thao tác biên bản">
              <Button variant="outline" size="sm" data-act="new" title="Tạo biên bản mới từ template">
                <Plus /><span className="btn-label">Mới</span>
              </Button>
              <Button variant="outline" size="sm" data-act="open" title="Mở file dữ liệu .json đã lưu">
                <FolderOpen /><span className="btn-label">Mở…</span>
              </Button>
              <Button variant="outline" size="sm" data-act="save" title="Lưu dữ liệu ra file .json">
                <Save /><span className="btn-label">Lưu .json</span>
              </Button>
              <Button variant="outline" size="sm" data-act="dbSave" title="Lưu biên bản lên CSDL Supabase">
                <Database /><span className="btn-label">Lưu CSDL</span>
              </Button>
              <span className="toolbar-divider" aria-hidden="true" />
              <Button variant="secondary" size="sm" data-act="xlsx" title="Xuất bảng so sánh – đánh giá (.xlsx)">
                <FileSpreadsheet /><span className="btn-label">Xuất so sánh .xlsx</span>
              </Button>
              <Button size="sm" data-act="docx" title="Điền dữ liệu vào template và tải BBTN (.docx)">
                <FileText /><span className="btn-label">Xuất BBTN .docx</span>
              </Button>
            </div>
            <Badge variant="outline" className="hidden border-[#d5e4ee] text-[#43627a] sm:inline-flex">
              <Activity aria-hidden="true" /> MBA
            </Badge>
          </div>
          <div className="netbar" id="netbar" aria-hidden="true" />
        </header>

        <div className="page-wrap">
          <section className="page-intro" aria-label="Tổng quan ứng dụng">
            <div>
              <p className="eyebrow">Quản lý kết quả thí nghiệm</p>
              <h1>Máy biến áp</h1>
              <p>Ghi nhận số liệu, đối chiếu test report và hoàn thiện biên bản nghiệm thu.</p>
            </div>
            <Badge variant="secondary" className="hidden border border-[#d8e7ef] bg-[#edf5f9] text-[#37617e] md:inline-flex">
              HỒ SƠ KỸ THUẬT
            </Badge>
          </section>
          <main id="main" className="legacy-main" tabIndex="-1" />
        </div>
      </div>
    </div>
  );
}
