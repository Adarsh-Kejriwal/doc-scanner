let cvReady = false;
let stream = null;
let detectInterval = null;

function onOpenCvReady() {
  cvReady = true;
  setStatus('cam', 'blue', 'OpenCV ready — start camera to begin');
}

/* ─── Tab switching ─────────────────────────────────── */
function switchTab(name) {
  const names = ['camera', 'file', 'about'];
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', names[i] === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
}

/* ─── Camera ────────────────────────────────────────── */
async function startCamera() {
  const hint = document.getElementById('camHint');
  if (hint) hint.style.display = 'none';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = document.getElementById('video');
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      syncOverlay();
      waitForCv(startLiveDetect);
    };
    setStatus('cam', 'green', 'Camera active — point at a document');
    document.getElementById('startBtn').disabled = true;
    document.getElementById('snapBtn').disabled = false;
    document.getElementById('stopBtn').disabled = false;
  } catch (e) {
    setStatus('cam', 'red', 'Camera access denied or unavailable');
  }
}

function syncOverlay() {
  const v = document.getElementById('video');
  const o = document.getElementById('overlay');
  o.width = v.videoWidth || 640;
  o.height = v.videoHeight || 480;
  o.style.width = v.clientWidth + 'px';
  o.style.height = v.clientHeight + 'px';
}

function waitForCv(fn) {
  if (cvReady) { fn(); return; }
  const t = setInterval(() => { if (cvReady) { clearInterval(t); fn(); } }, 200);
}

function startLiveDetect() {
  detectInterval = setInterval(() => {
    const video = document.getElementById('video');
    if (!video.videoWidth) return;
    const tmp = document.createElement('canvas');
    tmp.width = video.videoWidth;
    tmp.height = video.videoHeight;
    tmp.getContext('2d').drawImage(video, 0, 0);
    const pts = detectDocumentCorners(tmp);
    drawOverlay(pts, document.getElementById('overlay'), video.videoWidth, video.videoHeight);
  }, 130);
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (detectInterval) { clearInterval(detectInterval); detectInterval = null; }
  const video = document.getElementById('video');
  video.srcObject = null;
  const ctx = document.getElementById('overlay').getContext('2d');
  ctx.clearRect(0, 0, 9999, 9999);
  document.getElementById('startBtn').disabled = false;
  document.getElementById('snapBtn').disabled = true;
  document.getElementById('stopBtn').disabled = true;
  const hint = document.getElementById('camHint');
  if (hint) hint.style.display = '';
  setStatus('cam', '', 'Camera stopped');
}

function snapAndScan() {
  const video = document.getElementById('video');
  const snap = document.getElementById('snapCanvas');
  snap.width = video.videoWidth;
  snap.height = video.videoHeight;
  const ctx = snap.getContext('2d');
  ctx.drawImage(video, 0, 0);

  const pts = detectDocumentCorners(snap);
  if (pts && pts.length === 4) {
    drawDocumentOutline(ctx, pts);
    const warped = perspectiveWarp(snap, pts);
    if (warped) {
      const tw = Math.round(snap.width / 3.5);
      const th = Math.round(warped.height * (tw / warped.width));
      const pad = 10;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.drawImage(warped, snap.width - tw - pad, pad, tw, th);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(snap.width - tw - pad, pad, tw, th);
    }
    showMetrics('camMetrics', pts, snap.width, snap.height);
    setStatus('cam', 'green', 'Document detected and outlined');
  } else {
    showNoDetect('camMetrics');
    setStatus('cam', 'red', 'No clear document — try better lighting or contrast');
  }
  document.getElementById('camResult').classList.remove('hidden');
}

/* ─── File upload ───────────────────────────────────── */
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => processImage(img);
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function processImage(img) {
  const fc = document.getElementById('fileCanvas');
  fc.width = img.width;
  fc.height = img.height;
  const ctx = fc.getContext('2d');
  ctx.drawImage(img, 0, 0);

  if (!cvReady) { setTimeout(() => processImage(img), 400); return; }

  const pts = detectDocumentCorners(fc);
  if (pts && pts.length === 4) {
    drawDocumentOutline(ctx, pts);
    const warped = perspectiveWarp(fc, pts);
    if (warped) {
      const tw = Math.round(fc.width / 3.5);
      const th = Math.round(warped.height * (tw / warped.width));
      const pad = 10;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.drawImage(warped, fc.width - tw - pad, pad, tw, th);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(fc.width - tw - pad, pad, tw, th);
    }
    showMetrics('fileMetrics', pts, fc.width, fc.height);
  } else {
    showNoDetect('fileMetrics');
  }
  document.getElementById('fileResult').classList.remove('hidden');
}

function downloadResult() {
  const canvas = document.getElementById('fileCanvas');
  const link = document.createElement('a');
  link.download = 'docscan-result.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function onDragOver(e) { e.preventDefault(); document.getElementById('dropZone').classList.add('drag'); }
function onDragLeave() { document.getElementById('dropZone').classList.remove('drag'); }
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) handleFile({ target: { files: [file] } });
}

/* ─── OpenCV core ───────────────────────────────────── */
function detectDocumentCorners(canvas) {
  if (!cvReady || typeof cv === 'undefined') return null;
  try {
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best = null, bestArea = 0;
    const minArea = canvas.width * canvas.height * 0.05;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area < minArea) { cnt.delete(); continue; }
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
      if (approx.rows === 4 && area > bestArea) {
        bestArea = area;
        best = [];
        for (let r = 0; r < 4; r++)
          best.push({ x: approx.data32S[r * 2], y: approx.data32S[r * 2 + 1] });
      }
      approx.delete(); cnt.delete();
    }
    src.delete(); gray.delete(); blurred.delete(); edges.delete();
    contours.delete(); hierarchy.delete();
    return best ? orderCorners(best) : null;
  } catch (e) { return null; }
}

function orderCorners(pts) {
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  const q = (p) => (p.y < cy ? 0 : 2) + (p.x < cx ? 0 : 1);
  const map = { 0: null, 1: null, 2: null, 3: null };
  pts.forEach(p => { map[q(p)] = p; });
  return [map[0], map[1], map[3], map[2]].filter(Boolean);
}

function perspectiveWarp(canvas, pts) {
  if (!cvReady || typeof cv === 'undefined' || pts.length !== 4) return null;
  try {
    const src = cv.imread(canvas);
    const w = Math.round(Math.max(dist(pts[0], pts[1]), dist(pts[2], pts[3])));
    const h = Math.round(Math.max(dist(pts[0], pts[3]), dist(pts[1], pts[2])));
    if (w < 10 || h < 10) { src.delete(); return null; }
    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2,
      [pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2,
      [0, 0, w, 0, w, h, 0, h]);
    const M = cv.getPerspectiveTransform(srcPts, dstPts);
    const dst = new cv.Mat();
    cv.warpPerspective(src, dst, M, new cv.Size(w, h));
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    cv.imshow(out, dst);
    src.delete(); dst.delete(); M.delete(); srcPts.delete(); dstPts.delete();
    return out;
  } catch (e) { return null; }
}

function drawOverlay(pts, canvas, w, h) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!pts || pts.length !== 4) return;
  const sx = canvas.width / w, sy = canvas.height / h;
  ctx.beginPath();
  ctx.moveTo(pts[0].x * sx, pts[0].y * sy);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x * sx, pts[i].y * sy);
  ctx.closePath();
  ctx.strokeStyle = '#1D9E75';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(29,158,117,0.12)';
  ctx.fill();
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x * sx, p.y * sy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#1D9E75';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawDocumentOutline(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.strokeStyle = '#1D9E75';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(29,158,117,0.1)';
  ctx.fill();
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#1D9E75';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
}

function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

function polygonArea(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

function showMetrics(id, pts, w, h) {
  const area = polygonArea(pts);
  const pct = Math.round(area / (w * h) * 100);
  const docW = Math.round(Math.max(dist(pts[0], pts[1]), dist(pts[2], pts[3])));
  const docH = Math.round(Math.max(dist(pts[0], pts[3]), dist(pts[1], pts[2])));
  document.getElementById(id).innerHTML = `
    <div class="metric"><div class="metric-label">Document</div><div class="metric-val" style="color:#1D9E75;font-size:16px">Detected ✓</div></div>
    <div class="metric"><div class="metric-label">Document size</div><div class="metric-val" style="font-size:16px">${docW} × ${docH}px</div></div>
    <div class="metric"><div class="metric-label">Frame coverage</div><div class="metric-val">${pct}%</div></div>
    <div class="metric"><div class="metric-label">Corners found</div><div class="metric-val">4 / 4</div></div>
  `;
}

function showNoDetect(id) {
  document.getElementById(id).innerHTML = `
    <div class="metric"><div class="metric-label">Document</div><div class="metric-val" style="color:#E24B4A;font-size:16px">Not found</div></div>
    <div class="metric" style="grid-column:span 3"><div class="metric-label">Tips</div><div class="metric-val" style="font-size:13px;color:#9898a8">Try better lighting, higher contrast background, or move closer</div></div>
  `;
}

function setStatus(type, dotClass, msg) {
  const dot = document.getElementById(type + 'Dot');
  const msgEl = document.getElementById(type + 'Msg');
  if (dot) dot.className = 'dot' + (dotClass ? ' ' + dotClass : '');
  if (msgEl) msgEl.textContent = msg;
}
