import { capturePhoto, dataUrlToFile } from "./camera.js";

const MAX_Z = 2147483000;
let chooser = null;

function ensureChooser(){
  if (chooser) return chooser;

  const overlay = document.createElement("div");
  overlay.id = "photoSourceChooser";
  overlay.style.cssText = `
    position:fixed; inset:0; display:none; align-items:flex-end; justify-content:center;
    background:rgba(15,23,42,.55); backdrop-filter:saturate(130%) blur(4px);
    z-index:${MAX_Z}; transition:opacity .2s ease; opacity:0;
  `;

  const sheet = document.createElement("div");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.style.cssText = `
    width:min(420px,92%); background:#0f172a; color:#f8fafc;
    border-radius:18px 18px 14px 14px; padding:22px 20px 18px;
    margin-bottom:max(18px, env(safe-area-inset-bottom,18px));
    box-shadow:0 18px 48px rgba(15,23,42,.45);
    transform:translateY(16px); opacity:0; transition:transform .22s ease, opacity .22s ease;
    font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  `;

  const title = document.createElement("div");
  title.id = "photoSourceChooserTitle";
  title.textContent = "Pilih sumber foto";
  title.style.cssText = `
    font-size:16px; font-weight:600; text-align:center; margin-bottom:18px;
  `;
  sheet.setAttribute("aria-labelledby", title.id);

  const btnWrap = document.createElement("div");
  btnWrap.style.cssText = "display:flex; flex-direction:column; gap:12px;";

  const cameraBtn = document.createElement("button");
  cameraBtn.type = "button";
  cameraBtn.textContent = "Ambil Camera";
  cameraBtn.style.cssText = `
    appearance:none; border:0; border-radius:14px; padding:14px 16px;
    background:linear-gradient(135deg,#2563eb,#3b82f6); color:white;
    font-size:15px; font-weight:600; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:10px;
    box-shadow:0 10px 30px rgba(37,99,235,.45);
  `;

  const fileBtn = document.createElement("button");
  fileBtn.type = "button";
  fileBtn.textContent = "Ambil File";
  fileBtn.style.cssText = `
    appearance:none; border:0; border-radius:14px; padding:14px 16px;
    background:#1e293b; color:#e2e8f0; font-size:15px; font-weight:600;
    cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;
    box-shadow:inset 0 0 0 1px rgba(148,163,184,.25);
  `;

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Batal";
  cancelBtn.style.cssText = `
    appearance:none; border:0; border-radius:12px; padding:10px 12px;
    background:transparent; color:#94a3b8; font-size:14px; font-weight:600;
    cursor:pointer;
  `;

  btnWrap.appendChild(cameraBtn);
  btnWrap.appendChild(fileBtn);
  btnWrap.appendChild(cancelBtn);

  sheet.appendChild(title);
  sheet.appendChild(btnWrap);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  chooser = { overlay, sheet, title, cameraBtn, fileBtn, cancelBtn };
  return chooser;
}

function animateIn(el){
  requestAnimationFrame(() => {
    el.overlay.style.display = "flex";
    el.overlay.style.opacity = "0";
    el.sheet.style.opacity = "0";
    el.sheet.style.transform = "translateY(16px)";
    requestAnimationFrame(() => {
      el.overlay.style.opacity = "1";
      el.sheet.style.opacity = "1";
      el.sheet.style.transform = "translateY(0)";
    });
  });
}

function animateOut(el, cb){
  el.overlay.style.opacity = "0";
  el.sheet.style.opacity = "0";
  el.sheet.style.transform = "translateY(18px)";
  setTimeout(() => {
    el.overlay.style.display = "none";
    if (cb) cb();
  }, 220);
}

function showChooser(options={}){
  const el = ensureChooser();
  const { cameraLabel, fileLabel, cancelLabel, prefer } = options;
  if (cameraLabel) el.cameraBtn.textContent = cameraLabel;
  if (fileLabel) el.fileBtn.textContent = fileLabel;
  if (cancelLabel) el.cancelBtn.textContent = cancelLabel;

  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";

  animateIn(el);

  return new Promise((resolve) => {
    let finished = false;

    const finish = (value) => {
      if (finished) return;
      finished = true;
      el.overlay.removeEventListener("click", onBackdrop);
      el.cameraBtn.removeEventListener("click", onCamera);
      el.fileBtn.removeEventListener("click", onFile);
      el.cancelBtn.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.style.overflow = previousOverflow;
      animateOut(el, () => resolve(value));
    };

    const onBackdrop = (ev) => { if (ev.target === el.overlay) finish(null); };
    const onCamera = () => finish("camera");
    const onFile = () => finish("file");
    const onCancel = () => finish(null);
    const onKeyDown = (ev) => { if (ev.key === "Escape") finish(null); };

    el.overlay.addEventListener("click", onBackdrop);
    el.cameraBtn.addEventListener("click", onCamera);
    el.fileBtn.addEventListener("click", onFile);
    el.cancelBtn.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKeyDown);

    const focusTarget = prefer === "file" ? el.fileBtn : el.cameraBtn;
    setTimeout(() => focusTarget.focus(), 70);
  });
}

function readFileAsDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

function pickFromFileManager({ accept="image/*" } = {}){
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    input.style.width = "0";
    input.style.height = "0";
    input.setAttribute("tabindex", "-1");
    input.setAttribute("aria-hidden", "true");

    document.body.appendChild(input);

    let settled = false;
    let cancelTimer = null;

    const clearCancelTimer = () => {
      if (cancelTimer !== null) {
        clearTimeout(cancelTimer);
        cancelTimer = null;
      }
    };

    const cleanup = () => {
      clearCancelTimer();
      window.removeEventListener("focus", onFocus, true);
      input.removeEventListener("change", onChange);
      input.removeEventListener("cancel", onCancel);
      setTimeout(() => input.remove(), 0);
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value || null);
    };

    const onChange = async () => {
      clearCancelTimer();
      const file = input.files && input.files[0];
      if (!file) { finish(null); return; }
      try {
        const dataUrl = await readFileAsDataURL(file);
        finish({ file, dataUrl, fileName: file.name || "" });
      } catch (err) {
        console.error("Gagal membaca file:", err);
        finish(null);
      }
    };

    const onCancel = () => finish(null);
    const onFocus = () => {
      clearCancelTimer();
      if (input.files?.length) return;
      cancelTimer = setTimeout(() => {
        cancelTimer = null;
        finish(null);
      }, 350);
    };

    input.addEventListener("change", onChange, { once: true });
    input.addEventListener("cancel", onCancel, { once: true });
    window.addEventListener("focus", onFocus, { once: true, capture: true });

    input.value = "";
    setTimeout(() => {
      try { input.click(); }
      catch (err) { console.error("File picker gagal dibuka:", err); finish(null); }
    }, 16);
  });
}

export async function pickPhotoFromDevice(options={}){
  const { accept="image/*", cameraLabel, fileLabel, cancelLabel, prefer } = options || {};
  const choice = await showChooser({ cameraLabel, fileLabel, cancelLabel, prefer });
  if (choice === "camera") {
    try {
      const dataUrl = await capturePhoto();
      if (!dataUrl) return null;
      const file = dataUrlToFile(dataUrl);
      return { source: "camera", dataUrl, file, fileName: file.name || "" };
    } catch (err) {
      console.error("capturePhoto gagal:", err);
      return null;
    }
  }
  if (choice === "file") {
    const picked = await pickFromFileManager({ accept });
    if (!picked) return null;
    return { source: "file", dataUrl: picked.dataUrl, file: picked.file, fileName: picked.fileName };
  }
  return null;
}
