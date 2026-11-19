'use strict';

/* ─── CONSTANTS & RESOLUTION CALIBRATION ─── */
const DPI = 300;
const MM_TO_PX = DPI / 25.4;
const inPx = i => Math.round(i * DPI);
const mmPx = mm => Math.round(mm * MM_TO_PX);

const PAPERS = {
  short:{w:inPx(8.5), h:inPx(11), wIn:8.5,       hIn:11,       lbl:'Short Bond 8.5×11in'},
  long: {w:inPx(8.5), h:inPx(13), wIn:8.5,       hIn:13,       lbl:'Long Bond 8.5×13in'},
  a4:   {w:mmPx(210), h:mmPx(297),wIn:210/25.4,  hIn:297/25.4, lbl:'A4 210×297mm'},
  '4r': {w:inPx(4),   h:inPx(6),  wIn:4,         hIn:6,        lbl:'4R 4×6in'},
  '5r': {w:inPx(5),   h:inPx(7),  wIn:5,         hIn:7,        lbl:'5R 5×7in'},
};

const SIZES = {
  '2x2':    {w:inPx(2),    h:inPx(2),   lbl:'2×2 in',          wMm:50.8, hMm:50.8},
  '1x1':    {w:inPx(1),    h:inPx(1),   lbl:'1×1 in',          wMm:25.4, hMm:25.4},
  'passport':{w:mmPx(35), h:mmPx(45),  lbl:'Passport 35×45mm',wMm:35,   hMm:45},
  'visa':   {w:inPx(2),    h:inPx(2),   lbl:'US Visa 2×2 in', wMm:50.8, hMm:50.8},
  'wallet': {w:inPx(1.75), h:inPx(2.5), lbl:'Wallet 1.75×2.5',wMm:44.45,hMm:63.5},
};

/* ─── REACTIVE STATE ─── */
const S = {
  mode: 'fp',
  fp: {
    images: [],
    active: 0,
    paper: 'short',
    orient: 'portrait',
    copies: 1,
    fit: 'contain',
    margin: 0,
    imgW: 100,
    imgH: 100,
    lockAspect: true,
    guides: true,
    border: false,
    brightness: 100,
    contrast: 100,
    slotMap: [0, 0, 0, 0],
  },
  id: {
    img: null,
    paper: '4r',
    pkg: '2x2',
    guides: true,
    border: true,
    bgColor: '#ffffff',
    zoom: 1,
    panX: 0,
    panY: 0,
    brightness: 100,
    oval: false,
    customW: null,
    customH: null,
    lockAspect: true,
  },
  view: { zoom: 1 },
};

/* ─── DOM SELECTORS ─── */
const $ = id => document.getElementById(id);
const C = $('C');
const cx = C.getContext('2d');
const CA = $('CA');
const FC = $('FC');
const fx = FC.getContext('2d');

/* ─── TOAST NOTIFIER ─── */
function toast(msg, type = 'info', dur = 3200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'all .25s ease';
    setTimeout(() => el.remove(), 260);
  }, dur);
}

/* ─── LIVE DOT STATUS ─── */
let liveTimer = null;
function flashLive() {
  $('livePill').classList.remove('off');
  $('liveDot').classList.remove('off');
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    $('livePill').classList.add('off');
    $('liveDot').classList.add('off');
  }, 1400);
}

/* ─── ZOOM & FIT VIEWPORT ─── */
function applyZoom(z) {
  S.view.zoom = Math.max(0.04, Math.min(6, z));
  C.style.width = Math.round(C.width * S.view.zoom) + 'px';
  C.style.height = Math.round(C.height * S.view.zoom) + 'px';
  $('zNum').textContent = Math.round(S.view.zoom * 100) + '%';
}

function fitView() {
  if (!C.width) return;
  const r = CA.getBoundingClientRect();
  applyZoom(Math.min((r.width - 44) / C.width, (r.height - 44) / C.height, 1));
}

$('zIn').addEventListener('click', () => applyZoom(S.view.zoom * 1.2));
$('zOut').addEventListener('click', () => applyZoom(S.view.zoom * 0.8));
$('zFit').addEventListener('click', fitView);
$('z100').addEventListener('click', () => applyZoom(1));
CA.addEventListener('wheel', e => {
  e.preventDefault();
  applyZoom(S.view.zoom * (e.deltaY < 0 ? 1.12 : 0.88));
}, { passive: false });

/* ─── TAB NAVIGATION ─── */
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    $('p' + t.dataset.tab.toUpperCase()).classList.add('on');
    S.mode = t.dataset.tab;
    scheduleRender();
  });
});

/* ─── RESET APPLICATION ─── */
$('btnReset').addEventListener('click', () => {
  S.fp.images = [];
  S.fp.active = 0;
  S.fp.imgW = 100;
  S.fp.imgH = 100;
  S.fp.slotMap = [0, 0, 0, 0];
  S.id.img = null;
  S.id.panX = 0;
  S.id.panY = 0;
  S.id.zoom = 1;
  S.id.customW = null;
  S.id.customH = null;
  $('fpThumbs').innerHTML = '';
  $('frameSec').style.display = 'none';
  $('fpImgW').value = 100;
  $('fpImgH').value = 100;
  $('fpImgWSlider').value = 100;
  $('fpImgHSlider').value = 100;
  $('fpImgWV').textContent = '100%';
  $('fpImgHV').textContent = '100%';
  $('idImgW').value = '';
  $('idImgH').value = '';
  buildSlotGrid();
  C.style.display = 'none';
  $('emptyState').style.display = 'flex';
  $('btnPrint').disabled = $('btnDl').disabled = true;
  ['sSize', 'sPaper', 'sLayout', 'sImgSz'].forEach(id => $(id).textContent = '—');
  $('zNum').textContent = '—';
  toast('Application reset', 'info');
});

/* ─── PRINT HANDLER ─── */
$('btnPrint').addEventListener('click', () => {
  const pd = getPaperDims();
  let s = document.getElementById('pgStyle');
  if (!s) {
    s = document.createElement('style');
    s.id = 'pgStyle';
    document.head.appendChild(s);
  }
  s.textContent = `@media print{@page{size:${pd.wIn.toFixed(4)}in ${pd.hIn.toFixed(4)}in;margin:0}#C{width:${pd.wIn.toFixed(4)}in!important;height:${pd.hIn.toFixed(4)}in!important;position:fixed!important;top:0!important;left:0!important}}`;
  toast('Print Ready: Please ensure Scale = 100% in printer dialog', 'info', 6000);
  setTimeout(() => window.print(), 380);
});

/* ─── EXPORT PNG ─── */
$('btnDl').addEventListener('click', () => {
  C.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'PrintEasy_Layout_300DPI.png';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Layout downloaded as 300 DPI PNG', 'ok');
  }, 'image/png');
});

/* ─── PAPER DIMENSION HELPER ─── */
function getPaperDims() {
  if (S.mode === 'fp') {
    const p = PAPERS[S.fp.paper];
    if (S.fp.orient === 'landscape') {
      return { w: p.h, h: p.w, wIn: p.hIn, hIn: p.wIn, lbl: p.lbl + ' ↔' };
    }
    return { ...p };
  }
  return { ...PAPERS[S.id.paper] };
}

/* ─── RENDER SCHEDULER (RAF DEBOUNCE) ─── */
let renderRAF = null;
function scheduleRender() {
  if (renderRAF) cancelAnimationFrame(renderRAF);
  renderRAF = requestAnimationFrame(doRender);
}

function doRender() {
  if (S.mode === 'fp') {
    if (S.fp.images.length) renderFP();
  } else {
    if (S.id.img) renderID();
  }
  flashLive();
}

/* ═══════════════ FULL PAGE RENDERER ═══════════════ */
function renderFP() {
  const p = getPaperDims();
  const copies = S.fp.copies;
  const mgPx = mmPx(S.fp.margin);
  const cols = copies === 4 ? 2 : 1;
  const rows = copies === 1 ? 1 : 2;
  const slotW = Math.floor(p.w / cols);
  const slotH = Math.floor(p.h / rows);

  C.width = p.w;
  C.height = p.h;
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, p.w, p.h);

  cx.filter = `brightness(${S.fp.brightness}%) contrast(${S.fp.contrast}%)`;
  let si = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = Math.min(S.fp.slotMap[si] || 0, S.fp.images.length - 1);
      drawFPSlot(S.fp.images[idx].img, c * slotW, r * slotH, slotW, slotH, mgPx);
      si++;
    }
  }
  cx.filter = 'none';

  if (S.fp.border) {
    cx.strokeStyle = '#d4d4d8';
    cx.lineWidth = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cx.strokeRect(c * slotW + 1, r * slotH + 1, slotW - 2, slotH - 2);
      }
    }
  }

  if (S.fp.guides && copies > 1) {
    cx.save();
    cx.strokeStyle = '#a1a1aa';
    cx.lineWidth = 1;
    cx.setLineDash([10, 7]);
    for (let c2 = 1; c2 < cols; c2++) {
      cx.beginPath();
      cx.moveTo(c2 * slotW, 0);
      cx.lineTo(c2 * slotW, p.h);
      cx.stroke();
    }
    for (let r2 = 1; r2 < rows; r2++) {
      cx.beginPath();
      cx.moveTo(0, r2 * slotH);
      cx.lineTo(p.w, r2 * slotH);
      cx.stroke();
    }
    cx.restore();
  }

  const uw = (slotW - mgPx * 2) * (S.fp.imgW / 100);
  const uh = (slotH - mgPx * 2) * (S.fp.imgH / 100);
  showCanvas();
  $('prevInfo').innerHTML = `<strong>${copies}</strong> slot(s) on ${p.lbl}`;
  $('sSize').textContent = `${p.w}×${p.h}`;
  $('sPaper').textContent = p.lbl;
  $('sLayout').textContent = `${cols}×${rows}`;
  $('sImgSz').textContent = `${(uw / DPI * 25.4).toFixed(1)}×${(uh / DPI * 25.4).toFixed(1)} mm`;
}

function drawFPSlot(img, sx, sy, slotW, slotH, mgPx) {
  const avW = slotW - mgPx * 2;
  const avH = slotH - mgPx * 2;
  if (avW <= 0 || avH <= 0) return;
  const tW = avW * (S.fp.imgW / 100);
  const tH = avH * (S.fp.imgH / 100);
  const ix = sx + mgPx + (avW - tW) / 2;
  const iy = sy + mgPx + (avH - tH) / 2;

  if (S.fp.fit === 'stretch') {
    cx.drawImage(img, ix, iy, tW, tH);
    return;
  }

  const ia = img.naturalWidth / img.naturalHeight;
  const ta = tW / tH;

  if (S.fp.fit === 'contain') {
    let dw, dh;
    if (ia > ta) {
      dw = tW;
      dh = tW / ia;
    } else {
      dh = tH;
      dw = tH * ia;
    }
    cx.drawImage(img, ix + (tW - dw) / 2, iy + (tH - dh) / 2, dw, dh);
  } else {
    let sw = img.naturalWidth, sh = img.naturalHeight, sx2 = 0, sy2 = 0;
    if (ia > ta) {
      sw = Math.round(sh * ta);
      sx2 = Math.round((img.naturalWidth - sw) / 2);
    } else {
      sh = Math.round(sw / ta);
      sy2 = Math.round((img.naturalHeight - sh) / 2);
    }
    cx.save();
    cx.beginPath();
    cx.rect(ix, iy, tW, tH);
    cx.clip();
    cx.drawImage(img, sx2, sy2, sw, sh, ix, iy, tW, tH);
    cx.restore();
  }
}

/* ═══════════════ ID PHOTO RENDERER ═══════════════ */
function renderID() {
  const p = PAPERS[S.id.paper];
  C.width = p.w;
  C.height = p.h;
  cx.fillStyle = S.id.bgColor;
  cx.fillRect(0, 0, p.w, p.h);

  if (S.id.pkg === 'mix') {
    renderMix(p);
  } else {
    const def = SIZES[S.id.pkg];
    let sw = def.w, sh = def.h;
    if (S.id.customW) sw = mmPx(S.id.customW);
    if (S.id.customH) sh = mmPx(S.id.customH);
    renderGrid(p, { w: sw, h: sh, lbl: def.lbl });
  }

  showCanvas();
  $('sPaper').textContent = p.lbl;
  $('sSize').textContent = `${p.w}×${p.h}`;
}

function renderGrid(p, sz) {
  const cols = Math.floor(p.w / sz.w);
  const rows = Math.floor(p.h / sz.h);
  if (!cols || !rows) {
    toast('Photo size exceeds paper dimensions', 'err');
    return;
  }
  const offX = Math.floor((p.w - cols * sz.w) / 2);
  const offY = Math.floor((p.h - rows * sz.h) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawIDSlot(offX + c * sz.w, offY + r * sz.h, sz.w, sz.h);
    }
  }

  if (S.id.guides) drawIDGuides(offX, offY, cols, rows, sz.w, sz.h, p);

  const wm = (sz.w / DPI * 25.4).toFixed(1);
  const hm = (sz.h / DPI * 25.4).toFixed(1);
  $('prevInfo').innerHTML = `<strong>${cols * rows}×</strong> ${sz.lbl} · ${p.lbl}`;
  $('sLayout').textContent = `${cols}×${rows}`;
  $('sImgSz').textContent = `${wm}×${hm} mm`;
}

function renderMix(p) {
  const big = SIZES['2x2'], sm = SIZES['1x1'];
  const bigCols = 2, bigRows = 2, bigW = bigCols * big.w, bigH = bigRows * big.h;
  const smCols = Math.floor((p.w - bigW) / sm.w), smRows = Math.floor(p.h / sm.h);

  if (smCols < 1 || bigH > p.h) {
    toast('Paper size too small for mix layout, falling back to 2×2 grid', 'info');
    renderGrid(p, big);
    return;
  }

  const bigOffY = Math.floor((p.h - bigH) / 2);
  const smOffY = Math.floor((p.h - smRows * sm.h) / 2);

  for (let r = 0; r < bigRows; r++) {
    for (let c = 0; c < bigCols; c++) {
      drawIDSlot(c * big.w, bigOffY + r * big.h, big.w, big.h);
    }
  }

  for (let r = 0; r < smRows; r++) {
    for (let c = 0; c < smCols; c++) {
      drawIDSlot(bigW + c * sm.w, smOffY + r * sm.h, sm.w, sm.h);
    }
  }

  if (S.id.guides) {
    cx.save();
    cx.setLineDash([7, 5]);
    cx.strokeStyle = '#999';
    cx.lineWidth = 1;
    for (let c = 1; c < bigCols; c++) {
      cx.beginPath();
      cx.moveTo(c * big.w, 0);
      cx.lineTo(c * big.w, p.h);
      cx.stroke();
    }
    for (let r = 1; r < bigRows; r++) {
      cx.beginPath();
      cx.moveTo(0, bigOffY + r * big.h);
      cx.lineTo(bigW, bigOffY + r * big.h);
      cx.stroke();
    }
    cx.strokeStyle = '#555';
    cx.lineWidth = 2;
    cx.setLineDash([]);
    cx.beginPath();
    cx.moveTo(bigW, 0);
    cx.lineTo(bigW, p.h);
    cx.stroke();
    cx.strokeStyle = '#999';
    cx.lineWidth = 1;
    cx.setLineDash([7, 5]);
    for (let c = 1; c < smCols; c++) {
      const x = bigW + c * sm.w;
      cx.beginPath();
      cx.moveTo(x, 0);
      cx.lineTo(x, p.h);
      cx.stroke();
    }
    for (let r = 1; r < smRows; r++) {
      const y = smOffY + r * sm.h;
      cx.beginPath();
      cx.moveTo(bigW, y);
      cx.lineTo(p.w, y);
      cx.stroke();
    }
    cx.restore();
  }

  $('prevInfo').innerHTML = `Mix: <strong>${bigCols * bigRows}</strong>× 2×2 + <strong>${smCols * smRows}</strong>× 1×1`;
  $('sLayout').textContent = 'Mix';
  $('sImgSz').textContent = 'Mixed';
}

function drawIDSlot(x, y, w, h) {
  cx.save();
  cx.beginPath();
  cx.rect(x, y, w, h);
  cx.clip();
  cx.fillStyle = S.id.bgColor;
  cx.fillRect(x, y, w, h);

  const img = S.id.img;
  const bs = Math.min(w / img.naturalWidth, h / img.naturalHeight) * S.id.zoom;
  const iw = img.naturalWidth * bs, ih = img.naturalHeight * bs;
  const fo = $('frameOuter').getBoundingClientRect();
  const scX = fo.width ? w / fo.width : 1;
  const scY = fo.height ? h / fo.height : 1;

  cx.filter = `brightness(${S.id.brightness}%)`;
  cx.drawImage(img, x + (w - iw) / 2 + S.id.panX * scX, y + (h - ih) / 2 + S.id.panY * scY, iw, ih);
  cx.filter = 'none';
  cx.restore();

  if (S.id.border) {
    cx.strokeStyle = '#ffffff';
    cx.lineWidth = 4;
    cx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  }
}

function drawIDGuides(offX, offY, cols, rows, sw, sh, p) {
  cx.save();
  cx.setLineDash([9, 6]);
  cx.strokeStyle = '#888';
  cx.lineWidth = 1;
  for (let c = 1; c < cols; c++) {
    const x = offX + c * sw;
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x, p.h);
    cx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const y = offY + r * sh;
    cx.beginPath();
    cx.moveTo(0, y);
    cx.lineTo(p.w, y);
    cx.stroke();
  }
  cx.setLineDash([]);
  cx.strokeStyle = '#aaa';
  cx.lineWidth = 1;
  const tk = 22;
  [[offX, offY], [offX + cols * sw, offY], [offX, offY + rows * sh], [offX + cols * sw, offY + rows * sh]].forEach(([bx, by]) => {
    cx.beginPath();
    cx.moveTo(bx - tk, by);
    cx.lineTo(bx + tk, by);
    cx.stroke();
    cx.beginPath();
    cx.moveTo(bx, by - tk);
    cx.lineTo(bx, by + tk);
    cx.stroke();
  });
  cx.restore();
}

function showCanvas() {
  $('emptyState').style.display = 'none';
  C.style.display = 'block';
  $('btnPrint').disabled = false;
  $('btnDl').disabled = false;
  setTimeout(fitView, 30);
}

/* ═══════════════ FRAMING TOOL ═══════════════ */
let ftDrag = false, ftLX = 0, ftLY = 0;
const frameOuter = $('frameOuter');

function renderFrame() {
  if (!S.id.img) return;
  const r = frameOuter.getBoundingClientRect();
  const dw = Math.round(r.width) || 200, dh = Math.round(r.height) || 170;
  FC.width = dw;
  FC.height = dh;
  fx.fillStyle = S.id.bgColor;
  fx.fillRect(0, 0, dw, dh);
  const img = S.id.img;
  const bs = Math.min(dw / img.naturalWidth, dh / img.naturalHeight) * S.id.zoom;
  const iw = img.naturalWidth * bs, ih = img.naturalHeight * bs;

  fx.filter = `brightness(${S.id.brightness}%)`;
  fx.drawImage(img, (dw - iw) / 2 + S.id.panX, (dh - ih) / 2 + S.id.panY, iw, ih);
  fx.filter = 'none';
}

FC.addEventListener('mousedown', e => {
  ftDrag = true;
  ftLX = e.clientX;
  ftLY = e.clientY;
});

window.addEventListener('mousemove', e => {
  if (!ftDrag) return;
  S.id.panX += e.clientX - ftLX;
  S.id.panY += e.clientY - ftLY;
  ftLX = e.clientX;
  ftLY = e.clientY;
  renderFrame();
  scheduleRender();
});

window.addEventListener('mouseup', () => ftDrag = false);

FC.addEventListener('wheel', e => {
  e.preventDefault();
  S.id.zoom = Math.max(0.1, Math.min(10, S.id.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
  $('idZoom').value = Math.round(S.id.zoom * 100);
  $('idZoomV').textContent = Math.round(S.id.zoom * 100) + '%';
  renderFrame();
  scheduleRender();
}, { passive: false });

let ftTX = 0, ftTY = 0;
FC.addEventListener('touchstart', e => {
  ftTX = e.touches[0].clientX;
  ftTY = e.touches[0].clientY;
});

FC.addEventListener('touchmove', e => {
  e.preventDefault();
  S.id.panX += e.touches[0].clientX - ftTX;
  S.id.panY += e.touches[0].clientY - ftTY;
  ftTX = e.touches[0].clientX;
  ftTY = e.touches[0].clientY;
  renderFrame();
  scheduleRender();
}, { passive: false });

/* ═══════════════ UPLOAD MANAGEMENT ═══════════════ */
function setupDZ(zid, fid, onFiles) {
  const z = $(zid), inp = $(fid);
  z.addEventListener('dragover', e => {
    e.preventDefault();
    z.classList.add('over');
  });
  z.addEventListener('dragleave', () => z.classList.remove('over'));
  z.addEventListener('drop', e => {
    e.preventDefault();
    z.classList.remove('over');
    onFiles([...e.dataTransfer.files]);
  });
  inp.addEventListener('change', () => onFiles([...inp.files]));
}

function loadImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      res(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej();
    };
    img.src = url;
  });
}

setupDZ('fpDZ', 'fpFile', async files => {
  let n = 0;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    try {
      S.fp.images.push({ img: await loadImg(f), name: f.name });
      n++;
    } catch {
      toast('Failed to load: ' + f.name, 'err');
    }
  }
  if (n) {
    buildFpThumbs();
    scheduleRender();
    toast(`${n} image(s) loaded successfully`, 'ok');
  }
});

function buildFpThumbs() {
  const row = $('fpThumbs');
  row.innerHTML = '';
  S.fp.images.forEach((e, i) => {
    const w = document.createElement('div');
    w.className = 'thumb-wrap';
    const img = document.createElement('img');
    img.className = 'thumb' + (i === S.fp.active ? ' on' : '');
    img.src = e.img.src;
    img.addEventListener('click', () => {
      S.fp.active = i;
      buildFpThumbs();
      scheduleRender();
    });
    const x = document.createElement('button');
    x.className = 'thumb-x';
    x.textContent = '×';
    x.addEventListener('click', ev => {
      ev.stopPropagation();
      const removed = i;
      S.fp.images.splice(i, 1);
      if (S.fp.active >= S.fp.images.length) {
        S.fp.active = Math.max(0, S.fp.images.length - 1);
      }
      S.fp.slotMap = S.fp.slotMap.map(idx => {
        if (idx === removed) return Math.max(0, S.fp.images.length - 1);
        if (idx > removed) return idx - 1;
        return idx;
      });
      buildFpThumbs();
      if (S.fp.images.length) {
        scheduleRender();
      } else {
        C.style.display = 'none';
        $('emptyState').style.display = 'flex';
        $('btnPrint').disabled = $('btnDl').disabled = true;
      }
    });
    w.appendChild(img);
    w.appendChild(x);
    row.appendChild(w);
  });
  buildSlotGrid();
}

/* ─── SLOT ASSIGNMENT ENGINE ─── */
function buildSlotGrid() {
  const grid = $('slotGrid'), hint = $('slotHint'), copies = S.fp.copies, imgs = S.fp.images;
  for (let i = 0; i < 4; i++) {
    if (imgs.length && S.fp.slotMap[i] >= imgs.length) {
      S.fp.slotMap[i] = i % imgs.length;
    }
  }
  grid.innerHTML = '';
  grid.className = 'slot-grid ' + (copies === 1 ? 'g1' : 'g2');
  if (!imgs.length) {
    hint.style.display = 'block';
    return;
  }
  hint.style.display = 'none';
  const labels = copies === 1 ? ['Full Page'] : copies === 2 ? ['Slot 1 — Top', 'Slot 2 — Bottom'] : ['Slot 1 (TL)', 'Slot 2 (TR)', 'Slot 3 (BL)', 'Slot 4 (BR)'];

  for (let si = 0; si < copies; si++) {
    const imgIdx = Math.min(S.fp.slotMap[si] || 0, imgs.length - 1);
    const item = document.createElement('div');
    item.className = 'slot-item';
    const lbl = document.createElement('div');
    lbl.className = 'slot-label';
    lbl.textContent = labels[si];
    item.appendChild(lbl);

    const imgEl = document.createElement('img');
    imgEl.className = 'slot-img';
    imgEl.src = imgs[imgIdx].img.src;
    item.appendChild(imgEl);

    const chg = document.createElement('div');
    chg.className = 'slot-change';
    chg.textContent = 'Change ↻';
    item.appendChild(chg);

    item.addEventListener('click', () => {
      S.fp.slotMap[si] = (S.fp.slotMap[si] + 1) % imgs.length;
      buildSlotGrid();
      scheduleRender();
      toast(`Slot ${si + 1} set to: ${imgs[S.fp.slotMap[si]].name || 'Image ' + (S.fp.slotMap[si] + 1)}`, 'info', 1600);
    });
    grid.appendChild(item);
  }
}

setupDZ('idDZ', 'idFile', async files => {
  const f = files[0];
  if (!f) return;
  try {
    S.id.img = await loadImg(f);
    S.id.panX = 0;
    S.id.panY = 0;
    S.id.zoom = 1;
    $('frameSec').style.display = 'flex';
    renderFrame();
    scheduleRender();
    toast('Portrait photo loaded', 'ok');
  } catch {
    toast('Failed to load photo', 'err');
  }
});

/* ═══════════════ RESIZE CONTROLS ═══════════════ */
function setFpW(val) {
  val = Math.max(10, Math.min(100, val));
  if (S.fp.lockAspect) {
    S.fp.imgW = val;
    S.fp.imgH = val;
    $('fpImgH').value = val;
    $('fpImgHSlider').value = val;
    $('fpImgHV').textContent = val + '%';
  } else {
    S.fp.imgW = val;
  }
  $('fpImgW').value = val;
  $('fpImgWSlider').value = val;
  $('fpImgWV').textContent = val + '%';
  scheduleRender();
}

function setFpH(val) {
  val = Math.max(10, Math.min(100, val));
  if (S.fp.lockAspect) {
    S.fp.imgW = val;
    S.fp.imgH = val;
    $('fpImgW').value = val;
    $('fpImgWSlider').value = val;
    $('fpImgWV').textContent = val + '%';
  } else {
    S.fp.imgH = val;
  }
  $('fpImgH').value = val;
  $('fpImgHSlider').value = val;
  $('fpImgHV').textContent = val + '%';
  scheduleRender();
}

$('fpImgWSlider').addEventListener('input', e => setFpW(+e.target.value));
$('fpImgHSlider').addEventListener('input', e => setFpH(+e.target.value));
$('fpImgW').addEventListener('input', e => setFpW(+e.target.value));
$('fpImgH').addEventListener('input', e => setFpH(+e.target.value));
$('fpImgW').addEventListener('change', e => setFpW(+e.target.value));
$('fpImgH').addEventListener('change', e => setFpH(+e.target.value));

$('fpLockBtn').addEventListener('click', () => {
  S.fp.lockAspect = !S.fp.lockAspect;
  $('fpLockBtn').classList.toggle('on', S.fp.lockAspect);
  $('fpLockTxt').textContent = S.fp.lockAspect ? 'Locked' : 'Free';
  toast(S.fp.lockAspect ? 'Aspect ratio locked' : 'Width and height unlocked', 'info', 2000);
});

$('fpSizeReset').addEventListener('click', () => {
  setFpW(100);
  setFpH(100);
  toast('Image size reset to 100%', 'info', 1500);
});

/* ═══════════════ ID OVERRIDE CONTROLS ═══════════════ */
function setIdW(val) {
  val = parseFloat(val) || null;
  if (!val) {
    S.id.customW = null;
    $('idImgW').value = '';
    return;
  }
  val = Math.max(5, Math.min(300, val));
  S.id.customW = val;
  if (S.id.lockAspect && S.id.customH) {
    const def = SIZES[S.id.pkg];
    const r = def.hMm / def.wMm;
    S.id.customH = parseFloat((val * r).toFixed(1));
    $('idImgH').value = S.id.customH;
  }
  scheduleRender();
}

function setIdH(val) {
  val = parseFloat(val) || null;
  if (!val) {
    S.id.customH = null;
    $('idImgH').value = '';
    return;
  }
  val = Math.max(5, Math.min(300, val));
  S.id.customH = val;
  if (S.id.lockAspect && S.id.customW) {
    const def = SIZES[S.id.pkg];
    const r = def.wMm / def.hMm;
    S.id.customW = parseFloat((val * r).toFixed(1));
    $('idImgW').value = S.id.customW;
  }
  scheduleRender();
}

$('idImgW').addEventListener('change', e => setIdW(e.target.value));
$('idImgH').addEventListener('change', e => setIdH(e.target.value));
$('idImgW').addEventListener('input', e => {
  if (e.target.value === '') {
    S.id.customW = null;
    scheduleRender();
  }
});
$('idImgH').addEventListener('input', e => {
  if (e.target.value === '') {
    S.id.customH = null;
    scheduleRender();
  }
});

$('idLockBtn').addEventListener('click', () => {
  S.id.lockAspect = !S.id.lockAspect;
  $('idLockBtn').classList.toggle('on', S.id.lockAspect);
  $('idLockTxt').textContent = S.id.lockAspect ? 'Locked' : 'Free';
  toast(S.id.lockAspect ? 'ID Aspect ratio locked' : 'ID Width and height unlocked', 'info', 2000);
});

$('idSizeReset').addEventListener('click', () => {
  S.id.customW = null;
  S.id.customH = null;
  $('idImgW').value = '';
  $('idImgH').value = '';
  scheduleRender();
  toast('Reset to package standard', 'info', 1500);
});

/* ═══════════════ GENERAL EVENT LISTENERS ═══════════════ */
$('fpPaper').addEventListener('change', e => { S.fp.paper = e.target.value; scheduleRender(); });
$('fpFit').addEventListener('change', e => { S.fp.fit = e.target.value; scheduleRender(); });
$('fpGuides').addEventListener('change', e => { S.fp.guides = e.target.checked; scheduleRender(); });
$('fpBorder').addEventListener('change', e => { S.fp.border = e.target.checked; scheduleRender(); });

document.querySelectorAll('input[name=fpO]').forEach(r => r.addEventListener('change', e => {
  S.fp.orient = e.target.value;
  scheduleRender();
}));

document.querySelectorAll('input[name=fpC]').forEach(r => r.addEventListener('change', e => {
  S.fp.copies = +e.target.value;
  buildSlotGrid();
  scheduleRender();
}));

$('fpMargin').addEventListener('input', e => {
  S.fp.margin = +e.target.value;
  $('fpMarginV').textContent = e.target.value + ' mm';
  scheduleRender();
});

$('fpBr').addEventListener('input', e => {
  S.fp.brightness = +e.target.value;
  $('fpBrV').textContent = e.target.value;
  scheduleRender();
});

$('fpCo').addEventListener('input', e => {
  S.fp.contrast = +e.target.value;
  $('fpCoV').textContent = e.target.value;
  scheduleRender();
});

$('idPaper').addEventListener('change', e => { S.id.paper = e.target.value; scheduleRender(); });
$('idGuides').addEventListener('change', e => { S.id.guides = e.target.checked; scheduleRender(); });
$('idBorder').addEventListener('change', e => { S.id.border = e.target.checked; scheduleRender(); });

$('idOval').addEventListener('change', e => {
  S.id.oval = e.target.checked;
  $('frameOval').style.display = S.id.oval ? 'block' : 'none';
  renderFrame();
  scheduleRender();
});

$('idZoom').addEventListener('input', e => {
  S.id.zoom = +e.target.value / 100;
  $('idZoomV').textContent = e.target.value + '%';
  renderFrame();
  scheduleRender();
});

$('idBr').addEventListener('input', e => {
  S.id.brightness = +e.target.value;
  $('idBrV').textContent = e.target.value;
  renderFrame();
  scheduleRender();
});

document.querySelectorAll('.pkg').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.pkg').forEach(c => c.classList.remove('on'));
    card.classList.add('on');
    S.id.pkg = card.dataset.p;
    scheduleRender();
  });
});

document.querySelectorAll('.sw').forEach(s => {
  s.addEventListener('click', () => {
    document.querySelectorAll('.sw').forEach(x => x.classList.remove('on'));
    s.classList.add('on');
    S.id.bgColor = s.dataset.c;
    renderFrame();
    scheduleRender();
  });
});

/* ─── INITIALIZE ─── */
buildSlotGrid();