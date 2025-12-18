

/* camera.js — AVSEC Robust (iOS/Android/Windows) FINAL
   - 2 mode: capturePhoto() & scanBarcode(opts)
   - Anti-numpuk: hardCleanup() + opening lock
   - Inline style + prefix unik (avcam-*) + z-index maksimum
   - Tidak stop di visibilitychange (hindari "blank" setelah reopen)
   - Foto: auto-rotate + JPEG compress
   - Barcode: BarcodeDetector (jika ada) atau fallback via onFrame(canvas)
*/

// ===================== Public API =====================
export function capturePhoto(){
  return new Promise(async (resolve, reject) => {
    try { await startCapture({ mode:'photo', resolve, reject }); } catch(e){ reject(e); }
  });
}

/**
 * @param {Object} options
 * @param {Array<string>} [options.formats]
 * @param {number} [options.boxRatio=0.66]
 * @param {number} [options.boxWidthRatio]
 * @param {number} [options.boxHeightRatio]
 * @param {number} [options.sample=900]
 * @param {number} [options.throttleMs=120]
 * @param {(canvas:HTMLCanvasElement)=> (string|object|null|Promise<string|object|null>)} [options.onFrame]
 * @param {boolean} [options.pdf417Fallback=false]
 */
export function scanBarcode(options={}){
  return new Promise(async (resolve, reject) => {
    try { await startCapture({ mode:'barcode', options, resolve, reject }); } catch(e){ reject(e); }
  });
}

export function makePhotoName(page=null, index=0, ext="jpg"){
  const base = page || location.pathname.split('/').pop().replace(/\.html$/, '') || 'photo';
  const d=new Date(), hh=String(d.getHours()).padStart(2,'0'), mm=String(d.getMinutes()).padStart(2,'0');
  return `${base}${index?index:''}_${hh}${mm}.${ext}`;
}

export function dataUrlToFile(dataUrl, fileName){
  const arr=dataUrl.split(','), mime=(arr[0].match(/:(.*?);/)||[])[1] || 'image/jpeg';
  const bstr=atob(arr[1]); const u8=new Uint8Array(bstr.length); for(let i=0;i<bstr.length;i++) u8[i]=bstr.charCodeAt(i);
  const ext = mime==='image/png'?'png':'jpg'; const name=fileName||makePhotoName(null,0,ext);
  return new File([u8], name, {type:mime});
}

// ===================== Constants / State =====================
const MAX_Z = 2147483647; // int32 max
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const JSQR_MODULE_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm';
const HAS_DOCUMENT = typeof document !== 'undefined';
const jsQrPassCanvas = HAS_DOCUMENT ? document.createElement('canvas') : null;
const jsQrPassCtx = jsQrPassCanvas ? jsQrPassCanvas.getContext('2d', { willReadFrequently: true }) : null;
const JSQR_TARGET_MIN = 720;
const JSQR_MAX_SCALE = 4;
const JSQR_ROTATE_GAP = 12; // px difference before forcing rotated attempt

// Foto orientation guard
const TILT_ON_DEG=15, TILT_OFF_DEG=10, PITCH_MAX_DEG=35, SMOOTH_ALPHA=0.25;
const MAX_SIDE=1200, JPG_QLTY=0.72;

let st = {
  opening:false, running:false, mode:null,
  stream:null, video:null, overlay:null, shutter:null, guide:null,
  _update:null, _oriHandler:null, rafId:null, lastDecodeTs:0,
  pageHideHandler:null, beforeUnloadHandler:null,
  tilt:null, pitch:null
};
let _gammaEMA=null, _betaEMA=null, _landscapeLatch=false;
let jsQrModule=null;

// ===================== Core =====================
async function startCapture({mode='photo', options={}, resolve, reject}){
  if (st.opening) { reject(new Error('Kamera sedang dibuka')); return; }
  st.opening = true;

  hardCleanup(); // bersihkan total

  try{
    ensureVideo();
    ensureOverlay({mode, options, resolve});

    document.documentElement.classList.add('avcam-active');
    document.documentElement.classList.remove('avcam-photo','avcam-barcode');
    document.documentElement.classList.add(mode==='photo'?'avcam-photo':'avcam-barcode');
    st.mode = mode;

    ensureDeviceOrientationPermission();

    const constraints = {
      video:{
        facingMode:{ideal:'environment'},
        width:{ideal:1280, max:1920},
        height:{ideal:720,  max:1080},
        frameRate:{ideal:30, max:60}
      },
      audio:false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    st.stream = stream;
    st.video.srcObject = stream;
    await playVideo(st.video); // iOS needs user-gesture; handled by caller UI

    st.running = true;

    // Jangan stop di visibilitychange; hanya stop saat meninggalkan halaman
    st.pageHideHandler = ()=> stopCapture();
    st.beforeUnloadHandler = ()=> stopCapture();
    window.addEventListener('pagehide', st.pageHideHandler, {passive:true});
    window.addEventListener('beforeunload', st.beforeUnloadHandler, {passive:true});

    if (mode==='photo'){
      attachPhotoOrientation();
      updateCaptureState();
    } else {
      await raf(); // beri 1 frame agar overlay ter-render
      startDecodeLoop(options, resolve);
    }
  }catch(err){
    stopCapture(); st.opening=false; reject(normalizeGumError(err)); return;
  }

  st.opening = false;
}

function hardCleanup(){
  try{ st.stream?.getTracks?.().forEach(t=>t.stop()); }catch(_){}
  st.stream=null;

  // buang semua elemen lama (nama lama & baru)
  document.querySelectorAll('#avcam-video, .avcam-overlay, #scan-video, .scan-overlay, #scan-overlay').forEach(el=>el.remove());
  st.video=st.overlay=st.shutter=st.guide=null;

  if (st.rafId){ cancelAnimationFrame(st.rafId); st.rafId=null; }

  if (st._update){
    window.removeEventListener('orientationchange', st._update);
    window.removeEventListener('resize', st._update);
    if (screen.orientation && screen.orientation.removeEventListener) screen.orientation.removeEventListener('change', st._update);
    st._update=null;
  }
  if (st._oriHandler){ window.removeEventListener('deviceorientation', st._oriHandler); st._oriHandler=null; }

  if (st.pageHideHandler){ window.removeEventListener('pagehide', st.pageHideHandler); st.pageHideHandler=null; }
  if (st.beforeUnloadHandler){ window.removeEventListener('beforeunload', st.beforeUnloadHandler); st.beforeUnloadHandler=null; }

  document.documentElement.classList.remove('avcam-active','avcam-photo','avcam-barcode');

  st.running=false; st.mode=null; st.opening=false;
  st.tilt=st.pitch=null; _gammaEMA=_betaEMA=null; _landscapeLatch=false;
}

function stopCapture(){ hardCleanup(); }

// ===================== Elements (inline style kuat) =====================
function ensureVideo(){
  const v=document.createElement('video');
  v.id='avcam-video';
  v.setAttribute('playsinline',''); v.muted=true; v.autoplay=true;
  v.style.cssText = `
    position:fixed; inset:0; width:100vw; height:100vh;
    object-fit:cover; background:#000;
    z-index:${MAX_Z-1}; display:block; touch-action:none; transform:translateZ(0);
  `;
  document.body.appendChild(v);
  st.video=v;
}

function ensureOverlay({mode, options, resolve}){
  const o=document.createElement('div');
  o.className='avcam-overlay';
  o.id = mode==='photo' ? 'avcam-photo-overlay' : 'avcam-barcode-overlay';
  o.style.cssText = `
    position:fixed; inset:0; z-index:${MAX_Z};
    pointer-events:none; display:block; /* force show */
  `;

  // Topbar + close
  const top=document.createElement('div');
  top.style.cssText=`
    position:absolute; left:0; right:0; top:0;
    height:max(56px,calc(44px + env(safe-area-inset-top,0)));
    display:flex; align-items:flex-start; justify-content:flex-end;
    padding:calc(env(safe-area-inset-top,0) + 6px) 10px 8px;
    background:linear-gradient(to bottom,rgba(0,0,0,.5),rgba(0,0,0,0));
    pointer-events:none;
  `;
  const close=document.createElement('button');
  close.setAttribute('aria-label','Tutup');
  close.textContent='✕';
  close.style.cssText=`
    width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,.55);
    color:#fff;border:1px solid rgba(255,255,255,.25);font-size:22px;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 12px rgba(0,0,0,.35); pointer-events:auto;
  `;
  close.addEventListener('click', ()=>{ stopCapture(); resolve(null); });
  top.appendChild(close);
  o.appendChild(top);

  if (mode==='photo'){
    const msg=document.createElement('div');
    msg.className='avcam-msg'; msg.textContent='putar horizontal';
    msg.style.cssText=`
      position:absolute; left:50%; transform:translateX(-50%);
      bottom:max(110px,calc(96px + env(safe-area-inset-bottom,0)));
      background:rgba(0,0,0,.55); color:#fff; font-weight:600;
      padding:10px 14px; border-radius:12px; letter-spacing:.2px;
      box-shadow:0 4px 12px rgba(0,0,0,.35); display:none; pointer-events:none;
    `;
    o.appendChild(msg);

    const shutter=document.createElement('button');
    shutter.setAttribute('aria-label','Ambil gambar');
    shutter.style.cssText=`
      position:absolute; left:50%; transform:translateX(-50%);
      bottom:max(24px,calc(18px + env(safe-area-inset-bottom,0)));
      width:74px;height:74px;border-radius:999px;background:#fff;
      border:4px solid rgba(255,255,255,.35);
      box-shadow:0 6px 22px rgba(0,0,0,.45), inset 0 0 0 4px #fff;
      pointer-events:auto; transition:transform .06s ease,opacity .15s ease,filter .15s ease;
    `;
    shutter.addEventListener('click', async ()=>{
      if(!isLandscape()){ alert('Perangkat masih portrait. Putar perangkat ke horizontal untuk memotret.'); return; }
      try{ const dataUrl=await captureFrame(); stopCapture(); resolve(dataUrl); }
      catch(e){ console.error(e); alert('Gagal mengambil gambar.'); }
    });
    o.appendChild(shutter);

    st.shutter=shutter;
    // simpan ref msg untuk update
    o._msgEl = msg;

    const update=()=>updateCaptureState();
    st._update=update;
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', update);
  } else {
    const hint=document.createElement('div');
    hint.textContent='Scan Barcode / QR code';
    hint.style.cssText=`
      position:absolute; left:50%; transform:translateX(-50%);
      top:calc(env(safe-area-inset-top,0) + 16px);
      background:rgba(0,0,0,.55); color:#fff; font-weight:600;
      padding:8px 12px; border-radius:10px; letter-spacing:.2px;
      box-shadow:0 4px 12px rgba(0,0,0,.35); pointer-events:none; font-size:13px;
    `;
    o.appendChild(hint);

    const guide=document.createElement('div');
    const ratioBase = clamp(options.boxRatio ?? 0.66, 0.3, 0.9);
    const vwCSS = window.innerWidth || 1;
    const vhCSS = window.innerHeight || 1;
    const hasCustomWidth = typeof options.boxWidthRatio === 'number';
    const hasCustomHeight = typeof options.boxHeightRatio === 'number';

    let ratioW;
    let ratioH;
    let widthExpr;
    let heightExpr;

    if (!hasCustomWidth && !hasCustomHeight){
      const boxPx = Math.min(vwCSS, vhCSS) * ratioBase;
      ratioW = clamp(boxPx / vwCSS, 0.3, 0.98);
      ratioH = clamp(boxPx / vhCSS, 0.3, 0.98);
      widthExpr = `calc(min(100vw,100vh) * ${ratioBase})`;
      heightExpr = widthExpr;
    } else {
      ratioW = clamp((hasCustomWidth ? options.boxWidthRatio : ratioBase), 0.3, 0.98);
      ratioH = clamp((hasCustomHeight ? options.boxHeightRatio : ratioBase), 0.3, 0.98);
      widthExpr = `calc(100vw * ${ratioW})`;
      heightExpr = `calc(100vh * ${ratioH})`;
    }

    guide.style.cssText=`
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:${widthExpr};
      height:${heightExpr};
      box-sizing:border-box; border:3px solid rgba(255,255,255,.9); border-radius:12px;
      box-shadow:0 0 0 9999px rgba(0,0,0,.45), 0 8px 24px rgba(0,0,0,.35);
      pointer-events:none; outline:2px dashed rgba(255,255,255,.35); outline-offset:-6px;
    `;
    guide.dataset.widthRatio = String(ratioW);
    guide.dataset.heightRatio = String(ratioH);
    o.appendChild(guide);
    st.guide=guide;
  }

  document.body.appendChild(o);
  // Force reflow (Chrome/Safari)
  void o.offsetHeight;
  st.overlay=o;
}

// ===================== Foto (orientasi & capture) =====================
function attachPhotoOrientation(){
  if (!window.DeviceOrientationEvent) return;
  const handler=(e)=>{
    if (typeof e.gamma==='number'){ _gammaEMA=ema(_gammaEMA,e.gamma,SMOOTH_ALPHA); st.tilt=_gammaEMA; }
    if (typeof e.beta==='number'){  _betaEMA =ema(_betaEMA, e.beta, SMOOTH_ALPHA); st.pitch=_betaEMA; }
    updateCaptureState();
  };
  st._oriHandler=handler;
  if (typeof DeviceOrientationEvent.requestPermission==='function'){
    DeviceOrientationEvent.requestPermission().then(p=>{
      if(p==='granted') window.addEventListener('deviceorientation', handler, {passive:true});
    }).catch(()=>{});
  } else {
    window.addEventListener('deviceorientation', handler, {passive:true});
  }
}

function isLandscape(){
  // Orientasi dasar dari layar (dipakai untuk iOS sebagai fallback)
  const basicLandscape =
    (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) ||
    (typeof window.orientation === 'number' && Math.abs(window.orientation) === 90) ||
    (window.innerWidth > window.innerHeight);

  // ===== KHUSUS iOS: lebih toleran, gabung sensor + orientasi layar =====
  if (IS_IOS) {
    if (st.tilt != null || st.pitch != null) {
      const g = Math.abs(st.tilt ?? 0);   // miring kiri-kanan
      const b = Math.abs(st.pitch ?? 0);  // mendongak / menunduk

      // Kalau terlalu tegak → matikan latch, tapi masih boleh ikut basicLandscape
      if (b > PITCH_MAX_DEG) {
        _landscapeLatch = false;
        return basicLandscape;
      }

      // Hysteresis sama seperti sebelumnya
      if (!_landscapeLatch && g >= TILT_ON_DEG) _landscapeLatch = true;
      if (_landscapeLatch && g < TILT_OFF_DEG) _landscapeLatch = false;

      // Di iOS, anggap OK kalau:
      // - latch ON ATAU
      // - layar sudah jelas landscape
      return _landscapeLatch || basicLandscape;
    }

    // Kalau sensor belum kasih data → pakai orientasi layar saja
    return basicLandscape;
  }

  // ===== NON-iOS (Android, desktop, dsb) — PERSIS KODE LAMA =====
  if (st.tilt != null || st.pitch != null){
    const g = Math.abs(st.tilt ?? 0), b = Math.abs(st.pitch ?? 0);
    if (b > PITCH_MAX_DEG){ _landscapeLatch = false; return false; }
    if (!_landscapeLatch && g >= TILT_ON_DEG) _landscapeLatch = true;
    if (_landscapeLatch && g < TILT_OFF_DEG) _landscapeLatch = false;
    return _landscapeLatch;
  }
  if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) return true;
  if (typeof window.orientation === 'number' && Math.abs(window.orientation) === 90) return true;
  return window.innerWidth > window.innerHeight;
}

function updateCaptureState(){
  if (!st.overlay) return;
  const btn=st.shutter, msg=st.overlay._msgEl;
  const onLS=isLandscape();
  if (btn){ btn.disabled=!onLS; btn.style.opacity=onLS?'1':'0.45'; }
  if (msg){ msg.style.display=onLS?'none':'flex'; }
}

async function captureFrame(){
  const vid=st.video; if(!vid) throw new Error('Video belum siap');
  let w=vid.videoWidth||1280, h=vid.videoHeight||720;
  const c=document.createElement('canvas');
  const ctx=c.getContext('2d',{willReadFrequently:true});

  if (h>w){ c.width=h; c.height=w; ctx.translate(h/2,w/2); ctx.rotate(-Math.PI/2); ctx.drawImage(vid,-w/2,-h/2,w,h); [w,h]=[h,w]; }
  else { c.width=w; c.height=h; ctx.drawImage(vid,0,0,w,h); }

  const max=Math.max(w,h);
  if (max>MAX_SIDE){
    const scale=MAX_SIDE/max, cw=Math.round(w*scale), ch=Math.round(h*scale);
    const c2=document.createElement('canvas'); c2.width=cw; c2.height=ch;
    c2.getContext('2d').drawImage(c,0,0,cw,ch);
    return c2.toDataURL('image/jpeg', JPG_QLTY);
  }
  return c.toDataURL('image/jpeg', JPG_QLTY);
}

// ===================== Barcode =====================
function startDecodeLoop(options, resolve){
  const vid=st.video, guideEl=st.guide;
  const throttleMs=Math.max(16, options.throttleMs??120);

  const sampleMax=Math.max(900, options.sample??900);

  const defaultFormats = [
    'qr_code','code_128','code_39','ean_13','ean_8','upc_e',
    'itf','codabar','data_matrix','pdf417','aztec'
  ];
  const formats = options.formats?.length ? options.formats : defaultFormats;
  const wantsQrFallback = options.forceQrFallback ?? (!options.formats || formats.includes('qr_code'));

  let detector=null;
  if ('BarcodeDetector' in window){
    try{
      detector = new window.BarcodeDetector({ formats });
    }catch(err){
      console.warn('[Scanner] BarcodeDetector gagal dibuat, fallback jsQR:', err);
      detector = null;
    }
  }

  const nativeMissMax = Math.max(8, options.nativeMissThreshold ?? 18);
  let nativeMissCount = 0;
  let preferJsQr = IS_IOS || !detector;
  let jsQrBroken = false;

  const workCanvas=document.createElement('canvas');
  const wctx=workCanvas.getContext('2d',{willReadFrequently:true});

  const loop = async ()=>{
    if (!st.running || st.mode!=='barcode') return;

    const now=performance.now();
    if (now - st.lastDecodeTs < throttleMs){
      st.rafId=requestAnimationFrame(loop);
      return;
    }
    st.lastDecodeTs = now;

    const vw=vid.videoWidth||0, vh=vid.videoHeight||0;
    if (!vw || !vh){
      st.rafId=requestAnimationFrame(loop);
      return;
    }

    const vwCSS=window.innerWidth, vhCSS=window.innerHeight;
    const ratioBase = clamp(options.boxRatio ?? 0.66, 0.3, 0.9);
    const guideWidthRatio = guideEl ? parseFloat(guideEl.dataset.widthRatio) : NaN;
    const guideHeightRatio = guideEl ? parseFloat(guideEl.dataset.heightRatio) : NaN;
    const ratioW = Number.isFinite(guideWidthRatio)
      ? clamp(guideWidthRatio, 0.05, 0.99)
      : clamp((typeof options.boxWidthRatio === 'number' ? options.boxWidthRatio : ratioBase), 0.3, 0.98);
    const ratioH = Number.isFinite(guideHeightRatio)
      ? clamp(guideHeightRatio, 0.05, 0.99)
      : clamp((typeof options.boxHeightRatio === 'number' ? options.boxHeightRatio : ratioBase), 0.3, 0.98);
    const boxW = vwCSS * ratioW;
    const boxH = vhCSS * ratioH;

    const scale=Math.max(vwCSS/vw, vhCSS/vh);
    const drawW=vw*scale, drawH=vh*scale;
    const offX=(vwCSS-drawW)/2;
    const offY=(vhCSS-drawH)/2;
    const gx=(vwCSS-boxW)/2;
    const gy=(vhCSS-boxH)/2;

    const guideSx=Math.max(0,(gx-offX)/scale);
    const guideSy=Math.max(0,(gy-offY)/scale);
    const guideSw=Math.min(vw-guideSx, boxW/scale);
    const guideSh=Math.min(vh-guideSy, boxH/scale);

    const attempts=[];
    const fullRect = { sx:0, sy:0, sw:vw, sh:vh };
    const hasGuide = Number.isFinite(guideSw) && Number.isFinite(guideSh) && guideSw>0 && guideSh>0;

    if (IS_IOS){
      if (hasGuide && (guideSw * guideSh) < (vw * vh * 0.95)){
        attempts.push({ sx:guideSx, sy:guideSy, sw:guideSw, sh:guideSh });
        attempts.push({ ...fullRect });
      } else {
        attempts.push({ ...fullRect });
      }
    } else {
      if (hasGuide){
        attempts.push({ sx:guideSx, sy:guideSy, sw:guideSw, sh:guideSh });
      } else {
        attempts.push({ ...fullRect });
      }
    }

    try{
      let decoded = null;

      for (const rect of attempts){
        const { sx, sy, sw, sh } = rect;
        if (!sw || !sh) continue;

        const maxSide = Math.max(1, Math.max(sw, sh));
        const sampleScale = Math.min(1, sampleMax / maxSide);
        const destW = Math.max(1, Math.round(sw * sampleScale));
        const destH = Math.max(1, Math.round(sh * sampleScale));

        workCanvas.width = destW;
        workCanvas.height = destH;
        wctx.drawImage(vid, sx, sy, sw, sh, 0, 0, destW, destH);

        let frameData = null;
        const ensureFrameData = () => {
          if (!frameData){
            frameData = wctx.getImageData(0, 0, destW, destH);
          }
          return frameData;
        };

        if (!decoded && detector){
          try{
            const bmp = await createImageBitmap(workCanvas);
            const codes = await detector.detect(bmp);
            bmp.close?.();
            if (codes && codes.length){
              const c=codes[0];
              nativeMissCount = 0;
              decoded = { text:c.rawValue, format:c.format, raw:c };
            } else {
              nativeMissCount = Math.min(nativeMissCount + 1, nativeMissMax);
              if (nativeMissCount >= nativeMissMax){
                preferJsQr = true;
              }
            }
          }catch(err){
            console.warn('[Scanner] error BarcodeDetector, gunakan jsQR:', err);
            detector=null;
            preferJsQr = true;
          }
        }

        const allowJsQr = wantsQrFallback && !jsQrBroken && (preferJsQr || !detector || nativeMissCount >= nativeMissMax);
        if (!decoded && allowJsQr){
          try{
            const { default: jsQR } = await ensureJsQr();
            const frame = ensureFrameData();
            const passes = buildJsQrPasses(frame, workCanvas);
            for (const imageData of passes){
              const qrRes = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
              if (qrRes?.data){
                decoded = { text:qrRes.data, format:'qr_code', raw:qrRes };
                break;
              }
            }
          }catch(err){
            console.error('[jsQR] error:', err);
            jsQrBroken = true;
          }
        }

        if (!decoded && typeof options.onFrame==='function'){
          const out = await options.onFrame(workCanvas);
          if (out){
            decoded = (typeof out==='string') ? { text: out } : out;
          }
        }

        if (decoded){
          stopCapture();
          console.log('[SCAN RESULT]', decoded.format, decoded.text);
          resolve(decoded);
          return;
        }
      }
    }catch(e){
      console.error('[SCAN LOOP ERROR]', e);
    }

    st.rafId=requestAnimationFrame(loop);
  };

  st.rafId=requestAnimationFrame(loop);
}

// ===================== Helpers =====================
function ema(prev,val,a){ return prev==null?val:(a*val+(1-a)*prev); }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function raf(){ return new Promise(r=>requestAnimationFrame(()=>r())); }
function ensureDeviceOrientationPermission(){
  if (typeof DeviceOrientationEvent!=='undefined' &&
      typeof DeviceOrientationEvent.requestPermission==='function'){
    DeviceOrientationEvent.requestPermission().catch(()=>{});
  }
}
async function playVideo(video){
  try{
    const p=video.play();
    if (p && typeof p.then==='function'){
      await Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('play timeout')), 4000))]);
    }
  }catch(_){
    await raf(); await video.play();
  }
}
function normalizeGumError(err){
  const n=(err && (err.name||err.code))||'';
  if (n==='NotAllowedError' || n==='PermissionDeniedError') return new Error('Akses kamera ditolak. Izinkan kamera di browser.');
  if (n==='NotFoundError' || n==='OverconstrainedError') return new Error('Kamera tidak ditemukan/tersedia.');
  if (n==='NotReadableError') return new Error('Kamera sedang dipakai aplikasi lain.');
  return err instanceof Error ? err : new Error(String(err||'Gagal membuka kamera'));
}

async function ensureJsQr(){
  if (jsQrModule) return jsQrModule;
  jsQrModule = await import(JSQR_MODULE_URL);
  if (typeof jsQrModule?.default !== 'function'){
    throw new Error('Modul jsQR tidak valid');
  }
  return jsQrModule;
}

function buildJsQrPasses(baseImageData, workCanvas){
  if (!baseImageData){
    return [];
  }
  const passes=[baseImageData];
  if (!jsQrPassCanvas || !jsQrPassCtx || !workCanvas){
    return passes;
  }

  const baseW = baseImageData.width;
  const baseH = baseImageData.height;
  const maxSide = Math.max(baseW, baseH);

  if (maxSide < JSQR_TARGET_MIN){
    const scale = clamp(Math.ceil(JSQR_TARGET_MIN / maxSide), 2, JSQR_MAX_SCALE);
    const targetW = Math.max(1, Math.round(baseW * scale));
    const targetH = Math.max(1, Math.round(baseH * scale));
    const scaled = drawJsQrPass(targetW, targetH, ctx => {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(workCanvas, 0, 0, targetW, targetH);
    });
    if (scaled) passes.push(scaled);
  }

  if (Math.abs(baseW - baseH) > JSQR_ROTATE_GAP){
    for (const angle of [90, -90]){
      const targetW = angle % 180 ? baseH : baseW;
      const targetH = angle % 180 ? baseW : baseH;
      const rotated = drawJsQrPass(targetW, targetH, ctx => {
        ctx.translate(targetW/2, targetH/2);
        ctx.rotate(angle * Math.PI / 180);
        ctx.drawImage(workCanvas, -baseW/2, -baseH/2);
      });
      if (rotated) passes.push(rotated);
    }
  }

  const contrast = makeHighContrastCopy(baseImageData);
  if (contrast) passes.push(contrast);

  return passes;
}

function drawJsQrPass(width, height, drawFn){
  if (!jsQrPassCanvas || !jsQrPassCtx) return null;
  jsQrPassCanvas.width = Math.max(1, Math.round(width));
  jsQrPassCanvas.height = Math.max(1, Math.round(height));
  jsQrPassCtx.save();
  jsQrPassCtx.clearRect(0, 0, jsQrPassCanvas.width, jsQrPassCanvas.height);
  try{
    drawFn(jsQrPassCtx);
    return jsQrPassCtx.getImageData(0, 0, jsQrPassCanvas.width, jsQrPassCanvas.height);
  }finally{
    jsQrPassCtx.restore();
  }
}

function makeHighContrastCopy(imageData){
  if (!imageData?.data || typeof ImageData === 'undefined') return null;
  const copy = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const data = copy.data;
  const len = data.length;
  if (!len) return copy;
  let sum = 0;
  for (let i=0;i<len;i+=4){
    sum += data[i]*0.299 + data[i+1]*0.587 + data[i+2]*0.114;
  }
  const avg = sum / (len/4);
  for (let i=0;i<len;i+=4){
    const lum = data[i]*0.299 + data[i+1]*0.587 + data[i+2]*0.114;
    const val = lum > avg ? 255 : 0;
    data[i]=data[i+1]=data[i+2]=val;
  }
  return copy;
}
