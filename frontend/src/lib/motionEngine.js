// Motion Design rendering engine. Draws a frame of the generated video on a
// 2D canvas given a project + time, and exports the full video via MediaRecorder.
import { hexToRgb, rgba, mixHex } from "./colors";

const HEAD_FONT = "Outfit, 'Segoe UI', sans-serif";
const BODY_FONT = "Inter, 'Segoe UI', sans-serif";

// -------------------- math helpers --------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -------------------- text layout --------------------
function fitFont(ctx, text, maxWidth, startPx, weight) {
  let size = startPx;
  do {
    ctx.font = `${weight} ${size}px ${HEAD_FONT}`;
    if (ctx.measureText(text).width <= maxWidth || size <= 18) break;
    size -= 2;
  } while (size > 18);
  return size;
}

function wrapWords(ctx, words, maxWidth, weight, size) {
  ctx.font = `${weight} ${size}px ${HEAD_FONT}`;
  const lines = [];
  let line = [];
  for (const w of words) {
    const test = [...line, w].join(" ");
    if (ctx.measureText(test).width > maxWidth && line.length) {
      lines.push(line);
      line = [w];
    } else {
      line.push(w);
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

// -------------------- backgrounds / decor --------------------
function drawBackground(ctx, scene, W, H, t) {
  const [c1, c2] = scene.style.bg;
  const ang = t * 0.15;
  const cx = W / 2 + Math.cos(ang) * W * 0.2;
  const cy = H / 2 + Math.sin(ang) * H * 0.2;
  const g = ctx.createRadialGradient(cx, cy, 0, W / 2, H / 2, Math.hypot(W, H) * 0.7);
  g.addColorStop(0, c2);
  g.addColorStop(0.55, mixHex(c1, c2, 0.4));
  g.addColorStop(1, "#060609");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawDecor(ctx, scene, W, H, t) {
  const accent = scene.style.accent;
  ctx.save();
  const shape = scene.style.shape;
  if (shape === "grid") {
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1, W * 0.001);
    const step = W / 14;
    const off = (t * 30) % step;
    for (let x = -step; x < W + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + off, 0);
      ctx.lineTo(x + off, H);
      ctx.stroke();
    }
    for (let y = -step; y < H + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y + off);
      ctx.lineTo(W, y + off);
      ctx.stroke();
    }
  } else if (shape === "geo") {
    const rnd = mulberry32(scene.index + 7);
    for (let i = 0; i < 7; i++) {
      const bx = rnd() * W;
      const by = rnd() * H;
      const s = (0.05 + rnd() * 0.12) * W;
      const rot = t * (0.3 + rnd()) + i;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rot);
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, W * 0.002);
      if (i % 2 === 0) ctx.strokeRect(-s / 2, -s / 2, s, s);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  } else if (shape === "wave") {
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(2, W * 0.0025);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const y = H * 0.5 + Math.sin(x * 0.006 + t * 2 + k * 1.4) * H * (0.06 + k * 0.03) + (k - 1) * H * 0.14;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (shape === "rings") {
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(2, W * 0.002);
    for (let i = 1; i <= 5; i++) {
      const r = ((t * 60 + i * 80) % (Math.hypot(W, H) / 2));
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (shape === "burst") {
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(2, W * 0.002);
    const rays = 20;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + t * 0.4;
      ctx.beginPath();
      ctx.moveTo(W / 2, H / 2);
      ctx.lineTo(W / 2 + Math.cos(a) * W, H / 2 + Math.sin(a) * W);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawParticles(ctx, scene, W, H, t) {
  if (!scene.style.particles) return;
  const n = Math.round(W / 24);
  const rnd = mulberry32(scene.index * 101 + 3);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const baseX = rnd() * W;
    const speed = 0.2 + rnd() * 0.8;
    const size = (0.6 + rnd() * 2.2) * (W / 900);
    const phase = rnd() * Math.PI * 2;
    const y = H - ((t * speed * 60 + rnd() * H) % (H + 100));
    const x = baseX + Math.sin(t * speed + phase) * 30;
    const alpha = 0.25 + rnd() * 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i % 3 === 0 ? scene.style.accent : "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.65);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// -------------------- logo --------------------
function drawLogo(ctx, logoImg, W, H, scale, alpha, cx, cy, maxW) {
  if (!logoImg) return;
  const ratio = logoImg.width / logoImg.height || 1;
  let w = maxW;
  let h = w / ratio;
  w *= scale;
  h *= scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(logoImg, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

// -------------------- scene renderers --------------------
function drawHeadline(ctx, scene, W, H, p) {
  const text = (scene.headline || "").toUpperCase();
  if (!text) return;
  const maxWidth = W * 0.82;
  const startPx = Math.min(W, H) * 0.14;
  const words = text.split(/\s+/);
  let size = fitFont(ctx, text, maxWidth, startPx, 800);
  let lines = wrapWords(ctx, words, maxWidth, 800, size);
  if (lines.length > 3) {
    size *= 0.8;
    lines = wrapWords(ctx, words, maxWidth, 800, size);
  }
  const lineH = size * 1.08;
  const totalH = lines.length * lineH;
  const startY = H / 2 - totalH / 2 + lineH * 0.78;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let wordIndex = 0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    ctx.font = `800 ${size}px ${HEAD_FONT}`;
    const widths = line.map((w) => ctx.measureText(w + " ").width);
    const lineWidth = widths.reduce((a, b) => a + b, 0) - ctx.measureText(" ").width;
    let x = W / 2 - lineWidth / 2;
    const y = startY + li * lineH;
    for (let wi = 0; wi < line.length; wi++) {
      const appear = clamp((p - wordIndex * 0.06) / 0.28, 0, 1);
      const e = easeOutExpo(appear);
      const dy = (1 - e) * size * 0.55;
      const a = appear;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(0, dy);
      // glow
      ctx.shadowColor = rgba(scene.style.accent, 0.6);
      ctx.shadowBlur = size * 0.25 * e;
      ctx.fillStyle = scene.style.textColor;
      const w = line[wi];
      ctx.fillText(w, x + ctx.measureText(w).width / 2, y);
      ctx.restore();
      x += widths[wi];
      wordIndex++;
    }
  }
  return { bottomY: startY + (lines.length - 1) * lineH };
}

function drawSubtext(ctx, scene, W, H, p, yBase) {
  const text = scene.subtext || "";
  if (!text) return;
  const appear = clamp((p - 0.35) / 0.3, 0, 1);
  const size = Math.min(W, H) * 0.038;
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.font = `500 ${size}px ${BODY_FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.fillText(text, W / 2, (yBase || H / 2) + size * 2.1 + (1 - easeOutExpo(appear)) * 20);
  ctx.restore();
}

function drawKeywordChips(ctx, scene, W, H, p) {
  const kws = scene.keywords || [];
  if (!kws.length) return;
  const size = Math.min(W, H) * 0.03;
  ctx.font = `600 ${size}px ${BODY_FONT}`;
  const padX = size * 0.9;
  const gap = size * 0.6;
  const chipH = size * 2;
  const widths = kws.map((k) => ctx.measureText(k.toUpperCase()).width + padX * 2);
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (kws.length - 1);
  let x = W / 2 - totalW / 2;
  const y = H * 0.74;
  kws.forEach((k, i) => {
    const appear = clamp((p - 0.4 - i * 0.08) / 0.3, 0, 1);
    const e = easeOutBack(clamp(appear, 0, 1));
    ctx.save();
    ctx.globalAlpha = clamp(appear, 0, 1);
    const w = widths[i];
    ctx.translate(x + w / 2, y);
    ctx.scale(e, e);
    ctx.fillStyle = rgba(scene.style.accent, 0.18);
    ctx.strokeStyle = scene.style.accent;
    ctx.lineWidth = Math.max(1.5, W * 0.0016);
    roundRect(ctx, -w / 2, -chipH / 2, w, chipH, chipH / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${size}px ${BODY_FONT}`;
    ctx.fillText(k.toUpperCase(), 0, size * 0.05);
    ctx.restore();
    x += widths[i] + gap;
  });
}

function drawCtaButton(ctx, scene, W, H, p) {
  const label = (scene.keywords && scene.keywords[0]) ? scene.keywords[0].toUpperCase() : "EN SAVOIR PLUS";
  const size = Math.min(W, H) * 0.04;
  ctx.font = `700 ${size}px ${BODY_FONT}`;
  const padX = size * 1.6;
  const w = ctx.measureText(label).width + padX * 2;
  const h = size * 2.6;
  const pulse = 1 + Math.sin(p * Math.PI * 6) * 0.03;
  const appear = clamp((p - 0.4) / 0.3, 0, 1);
  const y = H * 0.76;
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.translate(W / 2, y);
  ctx.scale(pulse * easeOutBack(appear), pulse * easeOutBack(appear));
  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, scene.style.accent);
  grad.addColorStop(1, scene.style.accent2 || scene.style.accent);
  ctx.fillStyle = grad;
  ctx.shadowColor = rgba(scene.style.accent, 0.7);
  ctx.shadowBlur = size * 0.8;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0A0A12";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, size * 0.05);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// -------------------- main frame renderer --------------------
export function renderFrame(ctx, project, t, assets = {}) {
  const { width: W, height: H, scenes } = project;
  const logoImg = assets.logoImg || null;
  ctx.clearRect(0, 0, W, H);

  let scene = scenes[scenes.length - 1];
  for (const s of scenes) {
    if (t >= s.start && t < s.end) {
      scene = s;
      break;
    }
  }
  const local = t - scene.start;
  const dur = Math.max(0.1, scene.end - scene.start);
  const p = clamp(local / dur, 0, 1);

  drawBackground(ctx, scene, W, H, t);
  drawDecor(ctx, scene, W, H, t);
  drawParticles(ctx, scene, W, H, t);

  const anim = scene.style.animation;
  if (anim === "kenburns" && logoImg) {
    const scale = lerp(1.0, 1.25, easeInOut(p));
    drawLogo(ctx, logoImg, W, H, scale, 0.95, W / 2, H * 0.4, W * 0.4);
    const r = drawHeadline(ctx, scene, W, H, p) || {};
    drawSubtext(ctx, scene, W, H, p, r.bottomY);
  } else if (anim === "cta") {
    if (logoImg) drawLogo(ctx, logoImg, W, H, 1, clamp(p / 0.3, 0, 1), W / 2, H * 0.3, W * 0.28);
    drawHeadline(ctx, scene, W, H, p);
    drawCtaButton(ctx, scene, W, H, p);
    drawBrand(ctx, project, W, H, p);
  } else if (anim === "cards" || anim === "counters") {
    const r = drawHeadline(ctx, scene, W, H, p) || {};
    drawSubtext(ctx, scene, W, H, p, r.bottomY);
    drawKeywordChips(ctx, scene, W, H, p);
  } else {
    const r = drawHeadline(ctx, scene, W, H, p) || {};
    drawSubtext(ctx, scene, W, H, p, r.bottomY);
  }

  // persistent logo watermark (except on dedicated logo scenes)
  if (logoImg && anim !== "kenburns" && anim !== "cta" && scene.index > 0) {
    drawLogo(ctx, logoImg, W, H, 1, 0.5, W - W * 0.09, H * 0.08, W * 0.12);
  }

  drawVignette(ctx, W, H);

  // scene cut fades (from / to black)
  const fadeIn = clamp(local / 0.35, 0, 1);
  const remaining = scene.end - t;
  const fadeOut = clamp(remaining / 0.3, 0, 1);
  const black = 1 - Math.min(fadeIn, scene.index === 0 ? 1 : fadeIn) * (scene.index === scenes.length - 1 ? 1 : fadeOut);
  if (black > 0.001) {
    ctx.save();
    ctx.globalAlpha = black;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // global intro / outro
  const introFade = clamp(t / 0.5, 0, 1);
  const outroFade = clamp((project.duration - t) / 0.6, 0, 1);
  const globalBlack = 1 - Math.min(introFade, outroFade);
  if (globalBlack > 0.001) {
    ctx.save();
    ctx.globalAlpha = globalBlack;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawBrand(ctx, project, W, H, p) {
  const name = (project.brandName || "").trim();
  if (!name) return;
  const appear = clamp((p - 0.15) / 0.3, 0, 1);
  const size = Math.min(W, H) * 0.045;
  ctx.save();
  ctx.globalAlpha = appear;
  ctx.font = `800 ${size}px ${HEAD_FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(name.toUpperCase(), W / 2, H * 0.9);
  ctx.restore();
}

// -------------------- export via MediaRecorder --------------------
export function pickMime() {
  const candidates = [
    "video/mp4;codecs=avc1.4d002a,mp4a.40.2",
    "video/mp4;codecs=avc1.64003e",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return { mime: "video/webm", ext: "webm" };
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) {
        return { mime: m, ext: m.includes("mp4") ? "mp4" : "webm" };
      }
    } catch (e) {
      /* ignore */
    }
  }
  return { mime: "video/webm", ext: "webm" };
}

export async function ensureFonts() {
  if (document.fonts && document.fonts.load) {
    try {
      await Promise.all([
        document.fonts.load("800 80px Outfit"),
        document.fonts.load("600 40px Inter"),
      ]);
      await document.fonts.ready;
    } catch (e) {
      /* ignore */
    }
  }
}

export async function exportVideo(project, opts = {}) {
  const { logoImg = null, audioUrl = null, fps = 30, bitrate = 10_000_000, onProgress } = opts;
  await ensureFonts();

  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const ctx = canvas.getContext("2d");

  const stream = canvas.captureStream(fps);

  let audioCtx = null;
  let audioEl = null;
  if (audioUrl) {
    try {
      audioEl = new Audio(audioUrl);
      audioEl.crossOrigin = "anonymous";
      audioEl.loop = true;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      src.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      await audioCtx.resume();
    } catch (e) {
      audioEl = null;
    }
  }

  const { mime, ext } = pickMime();
  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: bitrate,
  });
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  rec.start(200);
  if (audioEl) {
    try {
      audioEl.currentTime = 0;
      await audioEl.play();
    } catch (e) {
      /* ignore autoplay issues */
    }
  }

  const startTs = performance.now();
  await new Promise((resolve) => {
    const frame = (now) => {
      const t = (now - startTs) / 1000;
      if (t >= project.duration) {
        renderFrame(ctx, project, project.duration - 0.001, { logoImg });
        if (onProgress) onProgress(1);
        resolve();
        return;
      }
      renderFrame(ctx, project, t, { logoImg });
      if (onProgress) onProgress(clamp(t / project.duration, 0, 1));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  await new Promise((r) => setTimeout(r, 150));
  rec.stop();
  if (audioEl) audioEl.pause();
  const blob = await stopped;
  if (audioCtx) {
    try {
      await audioCtx.close();
    } catch (e) {
      /* ignore */
    }
  }
  return { blob, ext, mime };
}
