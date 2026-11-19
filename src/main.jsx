import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AppShell } from './app-shell.jsx';
import './index.css';

const legacyScripts = [
  'js/vendor/jszip.min.js',
  'js/vendor/xlsx.full.min.js',
  'js/vendor/supabase.js',
  'js/config.js',
  'js/embedded.js',
  'js/domain/common.js',
  'js/domain/qd1901.js',
  'js/domain/criteria.js',
  'js/domain/test-items.js',
  'js/domain/trend-inline.js',
  'js/domain/trend-forecast.js',
  'js/domain/bushing-hitachi.js',
  'js/domain/bushing-k.js',
  'js/domain/equipment-types.js',
  'js/domain/report.js',
  'js/domain/records.js',
  'js/domain/factory-tree.js',
  'js/domain/equipment-specs.js',
  'js/domain/oltc-wave.js',
  'js/domain/edit-history.js',
  'js/domain/appendix.js',
  'js/domain/dfr.js',
  'js/domain/vn-number.js',
  'js/domain/field-entry.js',
  'js/domain/library.js',
  'js/domain/types/mba/factory.js',
  'js/domain/types/mba/schema.js',
  'js/domain/types/mba/model3d-map.js',
  'js/domain/types/mba/evaluate.js',
  'js/domain/types/mba/to-rows.js',
  'js/domain/types/mba/phase-fill.js',
  'js/domain/types/mba/report.js',
  'js/domain/types/mba/import-2293.js',
  'js/domain/types/mba/nameplate.js',
  'js/domain/types/mba/import-report.js',
  'js/domain/types/mba/import-report-pdf.js',
  'js/domain/types/mba/guide.js',
  'js/domain/types/mba/index.js',
  'js/data/docx.js',
  'js/data/file-store.js',
  'js/data/ocr.js',
  'js/data/pdf-text.js',
  'js/data/db.js',
  'js/data/bushing-k-repo.js',
  'js/data/criteria-repo.js',
  'js/data/instruments/cpc100.js',
  'js/data/instruments/wa2293.js',
  'js/data/instruments/mrct.js',
  'js/data/instruments/dirana.js',
  'js/ui/workflow.js',
  'js/ui/auth-ui.js',
  'js/ui/db-ui.js',
  'js/ui/factory-ui.js',
  'js/ui/setup-ui.js',
  'js/ui/catalog-ui.js',
  'js/ui/kconf-ui.js',
  'js/ui/criteria-ui.js',
  'js/ui/standards-ui.js',
  'js/ui/appendix-ui.js',
  'js/ui/import-report-ui.js',
  'js/ui/types/mba/cpc-dialog.js',
  'js/ui/types/mba/mrct-dialog.js',
  'js/ui/types/mba/oltc-chart.js',
  'js/ui/types/mba/dfr-chart.js',
  'js/ui/types/mba/wa2293-dialog.js',
  'js/ui/types/mba/nameplate-dialog.js',
  'js/ui/types/mba/ui.js',
  'js/ui/types/mba/model3d-ui.js',
  'js/ui/voice-input.js',
  'js/ui/field-ui.js',
  'js/ui/trend-inline-ui.js',
  'js/ui/help-ui.js',
  'js/ui/guide-ui.js',
  'js/ui/app.js',
];

const rootElement = document.getElementById('app-root');
if (!rootElement) throw new Error('Không tìm thấy vùng gắn ứng dụng #app-root');

flushSync(() => createRoot(rootElement).render(<AppShell />));

// Chiều cao thanh trên cùng (đổi khi xuống dòng ở màn hình hẹp) → --shell-header-h cho thanh bước / khung tham khảo dính
const shellHeader = document.querySelector('.shell-header');
if (shellHeader && 'ResizeObserver' in window) {
  new ResizeObserver(([entry]) => {
    document.documentElement.style.setProperty('--shell-header-h', `${Math.round(entry.target.getBoundingClientRect().height)}px`);
  }).observe(shellHeader);
}

const nav = document.getElementById('nav');
const toggle = document.getElementById('navToggle');
const backdrop = document.getElementById('navBackdrop');

function closeNav() {
  nav?.classList.remove('is-open');
  if (backdrop) backdrop.hidden = true;
  toggle?.setAttribute('aria-expanded', 'false');
}

toggle?.addEventListener('click', () => {
  const isOpen = nav?.classList.toggle('is-open') || false;
  if (backdrop) backdrop.hidden = !isOpen;
  toggle.setAttribute('aria-expanded', String(isOpen));
});
backdrop?.addEventListener('click', closeNav);
document.addEventListener('click', event => {
  if (event.target.closest?.('[data-nav]')) closeNav();
});
window.addEventListener('resize', () => {
  if (window.matchMedia('(min-width: 1024px)').matches) closeNav();
});

const scriptBase = import.meta.env.BASE_URL;
const optionalScripts = new Set(['js/config.js', 'js/embedded.js']);
await Promise.all(legacyScripts.map(path => new Promise(resolve => {
  const script = document.createElement('script');
  script.async = false;
  script.src = new URL(`${scriptBase}${path}`, document.baseURI).href;
  script.onload = resolve;
  script.onerror = () => {
    if (!optionalScripts.has(path)) console.warn(`Không nạp được script: ${path}`);
    resolve();
  };
  document.body.append(script);
})));
