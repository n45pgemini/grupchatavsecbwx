/**
 * Utilitas modal sederhana untuk halaman legacy.
 * Pemakaian:
 *   const modal = createModal({ id: 'infoModal', title: 'Info' });
 *   modal.open('<p>Konten</p>');
 */
export function createModal({ id = 'appModal', title = '', closeOnBackdrop = true } = {}) {
  let isMounted = false;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = id;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="modal-backdrop" data-close="1"></div>
    <div class="modal-window" role="document">
      <header class="modal-header">
        <h2 class="modal-title"></h2>
        <button class="modal-close" type="button" aria-label="Tutup">×</button>
      </header>
      <section class="modal-body"></section>
      <footer class="modal-footer"></footer>
    </div>
  `;

  const titleEl = overlay.querySelector('.modal-title');
  const bodyEl = overlay.querySelector('.modal-body');
  const footerEl = overlay.querySelector('.modal-footer');
  const closeBtn = overlay.querySelector('.modal-close');

  titleEl.textContent = title;

  function mount() {
    if (isMounted) return;
    injectStyle();
    document.body.appendChild(overlay);
    isMounted = true;
  }

  function open({ body, footer, title: newTitle } = {}) {
    mount();
    if (newTitle != null) titleEl.textContent = newTitle;
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body instanceof Node) {
      bodyEl.innerHTML = '';
      bodyEl.appendChild(body);
    }
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else if (footer instanceof Node) {
      footerEl.innerHTML = '';
      footerEl.appendChild(footer);
    }
    overlay.classList.add('show');
    const focusable = overlay.querySelector('button, [href], input, select, textarea');
    (focusable || closeBtn).focus();
  }

  function close() {
    overlay.classList.remove('show');
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => {
    if (!closeOnBackdrop) return;
    if (ev.target instanceof HTMLElement && ev.target.dataset.close) {
      close();
    }
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && overlay.classList.contains('show')) {
      ev.preventDefault();
      close();
    }
  });

  return { element: overlay, open, close, bodyEl, footerEl, titleEl };
}

let styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .modal-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:1200;visibility:hidden;}
    .modal-overlay.show{visibility:visible;}
    .modal-backdrop{position:absolute;inset:0;background:rgba(15,23,42,0.7);backdrop-filter:blur(4px);}
    .modal-window{position:relative;min-width:280px;max-width:90%;max-height:85vh;overflow:auto;border-radius:16px;background:var(--modal-bg,#111827);color:var(--modal-text,#e8ecf4);box-shadow:0 20px 60px rgba(15,23,42,.35);padding:24px;display:flex;flex-direction:column;gap:16px;}
    .modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;}
    .modal-title{margin:0;font-size:1.1rem;font-weight:600;}
    .modal-close{border:none;background:transparent;color:inherit;font-size:1.5rem;cursor:pointer;line-height:1;}
    .modal-body{font-size:0.95rem;line-height:1.6;}
    .modal-footer{display:flex;justify-content:flex-end;gap:12px;}
  `;
  document.head.appendChild(style);
}
