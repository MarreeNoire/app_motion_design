// Motion Design rendering engine with theme library + optional image slideshow.
import { rgba, mixHex } from "./colors";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function famHead(theme) { return `'${theme.fontHead}', 'Outfit', sans-serif`; }
function famBody(theme) { return `'${theme.fontBody}', 'Inter', sans-serif`; }
function transformCase(theme, text) {
  if (theme.headCase === "upper") return (text || "").toUpperCase();
  if (theme.headCase === "title") return text || "";
  return text || "";
}
function sceneAccent(project, scene) {
  const p = project.theme.palette;
  return scene.index % 2 === 0 ? p.primary : p.secondary;
}

// -------------------- backgrounds --------------------
function drawThemeBackground(ctx, project, t, scene) {
  const W = project.width, H = project.height;
  const pal = project.theme.palette;
  const acc = sceneAccent(project, scene);
  const mode = project.theme.bgMode;
  if (mode === "solid") {
    ctx.fillStyle = pal.bgDark;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.25;
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, acc); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return;
  }
  if (mode === "linear") {
    const ang = t * 0.1;
    const g = ctx.createLinearGradient(0, 0, W * Math.cos(ang) + W, H);
    g.addColorStop(0, mixHex(pal.bgDark, acc, 0.5));
    g.addColorStop(0.6, mixHex(pal.bgDark, acc, 0.18));
    g.addColorStop(1, pal.bgDark);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    return;
  }
  if (mode === "spotlight") {
    ctx.fillStyle = pal.bgDark; ctx.fillRect(0, 0, W, H);
    const cx = W / 2 + Math.cos(t * 0.3) * W * 0.12;
    const cy = H * 0.42 + Math.sin(t * 0.25) * H * 0.1;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H) * 0.55);
    g.addColorStop(0, mixHex(pal.bgDark, acc, 0.55));
    g.addColorStop(0.5, mixHex(pal.bgDark, acc, 0.15));
    g.addColorStop(1, pal.bgDark);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    return;
  }
  // mesh / radial default: layered radial blobs
  ctx.fillStyle = pal.bgDark; ctx.fillRect(0, 0, W, H);
  const blobs = [
    { x: 0.25, y: 0.3, c: pal.primary, s: 0.55 },
    { x: 0.78, y: 0.65, c: pal.secondary, s: 0.5 },
    { x: 0.6, y: 0.2, c: pal.accent, s: 0.4 },
  ];
  ctx.save();
  blobs.forEach((b, i) => {
    const px = (b.x + Math.cos(t * 0.3 + i) * 0.05) * W;
    const py = (b.y + Math.sin(t * 0.25 + i) * 0.05) * H;
    const g = ctx.createRadialGradient(px, py, 0, px, py, Math.hypot(W, H) * b.s);
    g.addColorStop(0, rgba(b.c, 0.45));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  ctx.restore();
}

// -------------------- image slideshow --------------------
function coverDims(img, W, H, scale) {
  const ir = img.width / img.height;
  const cr = W / H;
  let w, h;
  if (ir > cr) { h = H * scale; w = h * ir; } else { w = W * scale; h = w / ir; }
  return { w, h };
}

function drawCover(ctx, img, W, H, scale, panX, panY, alpha) {
  const { w, h } = coverDims(img, W, H, scale);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - w) / 2 + panX, (H - h) / 2 + panY, w, h);
  ctx.restore();
}

function slideState(project, t) {
  const imgs = project.images;
  const n = imgs.length;
  const slots = Math.max(n, Math.ceil(project.duration / 3.2));
  const slotDur = project.duration / slots;
  let idx = Math.floor(t / slotDur);
  if (idx > slots - 1) idx = slots - 1;
  const localT = t - idx * slotDur;
  const trans = project.theme.transitions[idx % project.theme.transitions.length];
  return { imgs, n, slots, slotDur, idx, localT, trans };
}

function drawImageSlideshow(ctx, project, t) {
  const W = project.width, H = project.height;
  const st = slideState(project, t);
  const transDur = Math.min(0.7, st.slotDur * 0.4);
  const tin = clamp(st.localT / transDur, 0, 1);
  const cur = st.imgs[st.idx % st.n];
  const prev = st.imgs[(st.idx - 1 + st.n) % st.n];

  const rnd = mulberry32(st.idx + 11);
  const panX = (rnd() - 0.5) * W * 0.08 * (st.localT / st.slotDur);
  const panY = (rnd() - 0.5) * H * 0.08 * (st.localT / st.slotDur);
  const kb = 1.08 + (st.localT / st.slotDur) * 0.14; // ken burns zoom

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // previous image stays during transition
  if (st.idx > 0 && tin < 1) drawCover(ctx, prev, W, H, 1.2, 0, 0, 1);

  const e = easeInOut(tin);
  if (st.trans === "slideL") {
    const off = (1 - e) * W;
    drawCover2(ctx, cur, W, H, kb, panX + off, panY, 1);
  } else if (st.trans === "slideU") {
    const off = (1 - e) * H;
    drawCover2(ctx, cur, W, H, kb, panX, panY + off, 1);
  } else if (st.trans === "zoom") {
    drawCover2(ctx, cur, W, H, kb * lerp(1.25, 1, e), panX, panY, e);
  } else if (st.trans === "wipe") {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W * e, H); ctx.clip();
    drawCover2(ctx, cur, W, H, kb, panX, panY, 1);
    ctx.restore();
  } else if (st.trans === "glitch") {
    drawCover2(ctx, cur, W, H, kb, panX, panY, e);
    if (tin < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - tin) * 0.6;
      ctx.globalCompositeOperation = "screen";
      drawCover2(ctx, cur, W, H, kb, panX + W * 0.02, panY, 1);
      ctx.restore();
    }
  } else {
    drawCover2(ctx, cur, W, H, kb, panX, panY, e); // fade
  }
}

function drawCover2(ctx, img, W, H, scale, panX, panY, alpha) {
  const { w, h } = coverDims(img, W, H, scale);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - w) / 2 + panX, (H - h) / 2 + panY, w, h);
  ctx.restore();
}

function drawScrim(ctx, project, scene) {
  const W = project.width, H = project.height;
  const pal = project.theme.palette;
  ctx.save();
  // overall darken
  ctx.fillStyle = rgba(pal.bgDark, 0.42);
  ctx.fillRect(0, 0, W, H);
  // bottom + top gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba(pal.bgDark, 0.55));
  g.addColorStop(0.4, "rgba(0,0,0,0)");
  g.addColorStop(0.6, "rgba(0,0,0,0)");
  g.addColorStop(1, rgba(pal.bgDark, 0.8));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// -------------------- decor + particles --------------------
function drawDecor(ctx, project, t, scene) {
  const W = project.width, H = project.height;
  const acc = sceneAccent(project, scene);
  const shape = project.theme.decor;
  if (shape === "none") return;
  ctx.save();
  if (shape === "grid") {
    ctx.globalAlpha = 0.1; ctx.strokeStyle = acc; ctx.lineWidth = Math.max(1, W * 0.001);
    const step = W / 16; const off = (t * 26) % step;
    for (let x = -step; x < W + step; x += step) { ctx.beginPath(); ctx.moveTo(x + off, 0); ctx.lineTo(x + off, H); ctx.stroke(); }
    for (let y = -step; y < H + step; y += step) { ctx.beginPath(); ctx.moveTo(0, y + off); ctx.lineTo(W, y + off); ctx.stroke(); }
  } else if (shape === "geo") {
    const rnd = mulberry32(scene.index + 7);
    for (let i = 0; i < 7; i++) {
      const bx = rnd() * W, by = rnd() * H, s = (0.05 + rnd() * 0.12) * W, rot = t * (0.3 + rnd()) + i;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(rot); ctx.globalAlpha = 0.09; ctx.strokeStyle = acc; ctx.lineWidth = Math.max(2, W * 0.002);
      if (i % 2 === 0) ctx.strokeRect(-s / 2, -s / 2, s, s); else { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
  } else if (shape === "wave") {
    ctx.globalAlpha = 0.16; ctx.strokeStyle = acc; ctx.lineWidth = Math.max(2, W * 0.0025);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const y = H * 0.5 + Math.sin(x * 0.006 + t * 2 + k * 1.4) * H * (0.06 + k * 0.03) + (k - 1) * H * 0.14;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (shape === "rings") {
    ctx.globalAlpha = 0.12; ctx.strokeStyle = acc; ctx.lineWidth = Math.max(2, W * 0.002);
    for (let i = 1; i <= 5; i++) { const r = (t * 60 + i * 80) % (Math.hypot(W, H) / 2); ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke(); }
  } else if (shape === "burst") {
    ctx.globalAlpha = 0.14; ctx.strokeStyle = acc; ctx.lineWidth = Math.max(2, W * 0.002);
    const rays = 22; for (let i = 0; i < rays; i++) { const a = (i / rays) * Math.PI * 2 + t * 0.4; ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos(a) * W, H / 2 + Math.sin(a) * W); ctx.stroke(); }
  } else if (shape === "blobs") {
    const rnd = mulberry32(scene.index + 3);
    for (let i = 0; i < 4; i++) {
      const px = (0.2 + rnd() * 0.6) * W + Math.cos(t * 0.4 + i) * W * 0.04;
      const py = (0.2 + rnd() * 0.6) * H + Math.sin(t * 0.4 + i) * H * 0.04;
      const r = (0.12 + rnd() * 0.1) * W;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, rgba(acc, 0.18)); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawParticles(ctx, project, t, scene) {
  const kind = project.theme.particle;
  if (kind === "none") return;
  const W = project.width, H = project.height;
  const acc = sceneAccent(project, scene);
  ctx.save();
  if (kind === "lines") {
    const n = Math.round(W / 40); const rnd = mulberry32(scene.index * 31 + 5);
    for (let i = 0; i < n; i++) {
      const x = rnd() * W; const speed = 40 + rnd() * 160; const len = 20 + rnd() * 80;
      const y = (t * speed + rnd() * H) % (H + len) - len;
      ctx.globalAlpha = 0.25 + rnd() * 0.4; ctx.strokeStyle = i % 3 === 0 ? acc : "#FFFFFF"; ctx.lineWidth = Math.max(1, W * 0.001);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
    }
  } else if (kind === "stars") {
    const n = Math.round(W / 10); const rnd = mulberry32(scene.index * 17 + 2);
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * H, s = rnd() * 1.8 * (W / 900);
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + rnd() * 2) + i));
      ctx.globalAlpha = tw * 0.8; ctx.fillStyle = i % 5 === 0 ? acc : "#FFFFFF";
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === "confetti") {
    const n = Math.round(W / 30); const rnd = mulberry32(scene.index * 53 + 9);
    const cols = [project.theme.palette.primary, project.theme.palette.secondary, project.theme.palette.accent, "#FFFFFF"];
    for (let i = 0; i < n; i++) {
      const baseX = rnd() * W; const speed = 0.4 + rnd() * 1.2; const size = (3 + rnd() * 6) * (W / 1200);
      const y = (t * speed * 90 + rnd() * H) % (H + 40) - 20;
      const x = baseX + Math.sin(t * 2 + i) * 30; const rot = t * (1 + rnd() * 3) + i;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = 0.8; ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(-size / 2, -size / 2, size, size * 1.6); ctx.restore();
    }
  } else { // dots / bokeh
    const n = Math.round(W / (kind === "bokeh" ? 40 : 24)); const rnd = mulberry32(scene.index * 101 + 3);
    for (let i = 0; i < n; i++) {
      const baseX = rnd() * W; const speed = 0.2 + rnd() * 0.8;
      const size = (kind === "bokeh" ? 4 + rnd() * 10 : 0.6 + rnd() * 2.4) * (W / 900);
      const phase = rnd() * Math.PI * 2;
      const y = H - ((t * speed * 60 + rnd() * H) % (H + 100));
      const x = baseX + Math.sin(t * speed + phase) * 30;
      ctx.globalAlpha = (kind === "bokeh" ? 0.12 : 0.3) + rnd() * 0.4;
      ctx.fillStyle = i % 3 === 0 ? acc : "#FFFFFF";
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// -------------------- effects --------------------
function drawEffects(ctx, project, t) {
  const W = project.width, H = project.height;
  const fx = project.theme.effects;
  if (fx.vignette) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${fx.vignette})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (fx.scanlines) {
    ctx.save(); ctx.globalAlpha = fx.scanlines; ctx.fillStyle = "#000";
    const h = Math.max(2, Math.round(H / 320));
    for (let y = 0; y < H; y += h * 2) ctx.fillRect(0, y, W, h);
    ctx.restore();
  }
  if (fx.lightLeak) {
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = fx.lightLeak * (0.6 + 0.4 * Math.sin(t));
    const acc = project.theme.palette.accent;
    const g = ctx.createLinearGradient(W, 0, W * 0.4, H);
    g.addColorStop(0, rgba(acc, 0.9)); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

// -------------------- text --------------------
function setHeadFont(ctx, theme, size) { ctx.font = `${theme.headWeight} ${size}px ${famHead(theme)}`; }

function fitFont(ctx, theme, text, maxWidth, startPx) {
  let size = startPx;
  do { setHeadFont(ctx, theme, size); if (ctx.measureText(text).width <= maxWidth || size <= 20) break; size -= 2; } while (size > 20);
  return size;
}
function wrapWords(ctx, theme, words, maxWidth, size) {
  setHeadFont(ctx, theme, size);
  const lines = []; let line = [];
  for (const w of words) {
    const test = [...line, w].join(" ");
    if (ctx.measureText(test).width > maxWidth && line.length) { lines.push(line); line = [w]; } else line.push(w);
  }
  if (line.length) lines.push(line);
  return lines;
}

function drawHeadline(ctx, project, scene, p, anchorY = 0.5) {
  const theme = project.theme;
  const raw = transformCase(theme, scene.headline);
  if (!raw) return { bottomY: project.height * anchorY };
  const W = project.width, H = project.height;
  const maxWidth = W * 0.84;
  const startPx = Math.min(W, H) * 0.145;
  const words = raw.split(/\s+/);
  let size = fitFont(ctx, theme, raw, maxWidth, startPx);
  let lines = wrapWords(ctx, theme, words, maxWidth, size);
  if (lines.length > 3) { size *= 0.78; lines = wrapWords(ctx, theme, words, maxWidth, size); }
  const lineH = size * 1.1;
  const totalH = lines.length * lineH;
  const startY = H * anchorY - totalH / 2 + lineH * 0.78;
  const ls = (theme.letterSpacing || 0) * size;
  const supportsLS = "letterSpacing" in ctx;

  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const mode = theme.textAnim;
  let wordIndex = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const y = startY + li * lineH;
    setHeadFont(ctx, theme, size);
    if (supportsLS) ctx.letterSpacing = `${ls}px`;

    if (mode === "typewriter") {
      const full = line.join(" ");
      const totalChars = full.length;
      const shownGlobal = Math.floor(p * totalChars * 1.4);
      const shown = clamp(shownGlobal, 0, totalChars);
      const sub = full.slice(0, shown);
      ctx.save(); ctx.fillStyle = theme.palette.text;
      ctx.shadowColor = rgba(sceneAccent(project, scene), 0.6); ctx.shadowBlur = size * 0.18;
      ctx.fillText(sub, W / 2, y);
      if (shown < totalChars && Math.sin(p * 40) > 0) {
        const cw = ctx.measureText(sub).width;
        ctx.fillRect(W / 2 + cw / 2, y - size * 0.8, size * 0.08, size * 0.9);
      }
      ctx.restore();
      continue;
    }

    if (mode === "maskUp") {
      const appear = clamp((p - li * 0.12) / 0.4, 0, 1);
      const e = easeOutExpo(appear);
      ctx.save();
      ctx.beginPath();
      const clipY = y - size;
      ctx.rect(0, clipY, W, (size * 1.25) * e);
      ctx.clip();
      ctx.globalAlpha = 1;
      ctx.fillStyle = theme.palette.text;
      ctx.shadowColor = rgba(sceneAccent(project, scene), 0.6); ctx.shadowBlur = size * 0.16;
      ctx.fillText(line.join(" "), W / 2, y);
      ctx.restore();
      continue;
    }

    if (mode === "slide") {
      const appear = clamp((p - li * 0.1) / 0.4, 0, 1);
      const e = easeOutExpo(appear);
      ctx.save(); ctx.globalAlpha = appear;
      ctx.translate((1 - e) * -W * 0.25, 0);
      ctx.fillStyle = theme.palette.text;
      ctx.shadowColor = rgba(sceneAccent(project, scene), 0.6); ctx.shadowBlur = size * 0.18;
      ctx.fillText(line.join(" "), W / 2, y);
      ctx.restore();
      continue;
    }

    if (mode === "scaleIn") {
      const appear = clamp((p - li * 0.08) / 0.45, 0, 1);
      const e = easeOutBack(appear);
      ctx.save(); ctx.globalAlpha = appear;
      ctx.translate(W / 2, y - size * 0.35); ctx.scale(e, e); ctx.translate(-W / 2, -(y - size * 0.35));
      ctx.fillStyle = theme.palette.text;
      ctx.shadowColor = rgba(sceneAccent(project, scene), 0.6); ctx.shadowBlur = size * 0.2;
      ctx.fillText(line.join(" "), W / 2, y);
      ctx.restore();
      continue;
    }

    // per-word modes: kinetic, wordPop, glitch
    if (supportsLS) ctx.letterSpacing = `${ls}px`;
    const widths = line.map((w) => ctx.measureText(w + " ").width);
    const lineWidth = widths.reduce((a, b) => a + b, 0) - ctx.measureText(" ").width;
    let x = W / 2 - lineWidth / 2;
    for (let wi = 0; wi < line.length; wi++) {
      const appear = clamp((p - wordIndex * 0.07) / 0.3, 0, 1);
      const w = line[wi];
      ctx.save();
      ctx.fillStyle = theme.palette.text;
      ctx.shadowColor = rgba(sceneAccent(project, scene), 0.65);
      if (mode === "wordPop") {
        const e = easeOutBack(appear); ctx.globalAlpha = appear;
        const wx = x + ctx.measureText(w).width / 2;
        ctx.translate(wx, y - size * 0.35); ctx.scale(e, e); ctx.translate(-wx, -(y - size * 0.35));
        ctx.shadowBlur = size * 0.22 * appear;
        ctx.fillText(w, wx, y);
      } else if (mode === "glitch") {
        const e = easeOutExpo(appear); ctx.globalAlpha = appear;
        const wx = x + ctx.measureText(w).width / 2;
        const jitter = (1 - e) * size * 0.1;
        ctx.save(); ctx.globalAlpha = appear * 0.5; ctx.fillStyle = theme.palette.primary;
        ctx.fillText(w, wx - jitter, y); ctx.restore();
        ctx.save(); ctx.globalAlpha = appear * 0.5; ctx.fillStyle = theme.palette.secondary;
        ctx.fillText(w, wx + jitter, y); ctx.restore();
        ctx.fillStyle = theme.palette.text; ctx.shadowBlur = size * 0.18 * e;
        ctx.fillText(w, wx, y);
      } else { // kinetic
        const e = easeOutExpo(appear); ctx.globalAlpha = appear;
        ctx.translate(0, (1 - e) * size * 0.55);
        ctx.shadowBlur = size * 0.24 * e;
        ctx.fillText(w, x + ctx.measureText(w).width / 2, y);
      }
      ctx.restore();
      x += widths[wi]; wordIndex++;
    }
  }
  if (supportsLS) ctx.letterSpacing = "0px";
  return { bottomY: startY + (lines.length - 1) * lineH };
}

function drawSubtext(ctx, project, scene, p, yBase) {
  const text = scene.subtext;
  if (!text) return;
  const theme = project.theme; const W = project.width, H = project.height;
  const appear = clamp((p - 0.35) / 0.3, 0, 1);
  const size = Math.min(W, H) * 0.038;
  ctx.save(); ctx.globalAlpha = appear;
  ctx.font = `500 ${size}px ${famBody(theme)}`; ctx.textAlign = "center";
  ctx.fillStyle = rgba(theme.palette.text, 0.9);
  ctx.fillText(text, W / 2, (yBase || H / 2) + size * 2.1 + (1 - easeOutExpo(appear)) * 20);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawKeywordChips(ctx, project, scene, p) {
  const kws = scene.keywords || []; if (!kws.length) return;
  const theme = project.theme; const W = project.width, H = project.height;
  const acc = sceneAccent(project, scene);
  const size = Math.min(W, H) * 0.03;
  ctx.font = `600 ${size}px ${famBody(theme)}`;
  const padX = size * 0.9, gap = size * 0.6, chipH = size * 2;
  const widths = kws.map((k) => ctx.measureText(k.toUpperCase()).width + padX * 2);
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (kws.length - 1);
  let x = W / 2 - totalW / 2; const y = H * 0.74;
  kws.forEach((k, i) => {
    const appear = clamp((p - 0.4 - i * 0.08) / 0.3, 0, 1); const e = easeOutBack(clamp(appear, 0, 1));
    ctx.save(); ctx.globalAlpha = clamp(appear, 0, 1); const w = widths[i];
    ctx.translate(x + w / 2, y); ctx.scale(e, e);
    ctx.fillStyle = rgba(acc, 0.18); ctx.strokeStyle = acc; ctx.lineWidth = Math.max(1.5, W * 0.0016);
    roundRect(ctx, -w / 2, -chipH / 2, w, chipH, chipH / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = theme.palette.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `600 ${size}px ${famBody(theme)}`; ctx.fillText(k.toUpperCase(), 0, size * 0.05);
    ctx.restore(); x += widths[i] + gap;
  });
}

function drawCtaButton(ctx, project, scene, p) {
  const theme = project.theme; const W = project.width, H = project.height;
  const label = (scene.keywords && scene.keywords[0]) ? scene.keywords[0].toUpperCase() : "EN SAVOIR PLUS";
  const size = Math.min(W, H) * 0.04;
  ctx.font = `700 ${size}px ${famBody(theme)}`;
  const padX = size * 1.6, w = ctx.measureText(label).width + padX * 2, h = size * 2.6;
  const pulse = 1 + Math.sin(p * Math.PI * 6) * 0.03;
  const appear = clamp((p - 0.4) / 0.3, 0, 1); const y = H * 0.78;
  ctx.save(); ctx.globalAlpha = appear; ctx.translate(W / 2, y);
  ctx.scale(pulse * easeOutBack(appear), pulse * easeOutBack(appear));
  const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grad.addColorStop(0, theme.palette.primary); grad.addColorStop(1, theme.palette.secondary);
  ctx.fillStyle = grad; ctx.shadowColor = rgba(theme.palette.accent, 0.7); ctx.shadowBlur = size * 0.8;
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#0A0A12"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, 0, size * 0.05); ctx.restore();
}

function drawBrand(ctx, project, p) {
  const name = (project.brandName || "").trim(); if (!name) return;
  const theme = project.theme; const W = project.width, H = project.height;
  const appear = clamp((p - 0.15) / 0.3, 0, 1); const size = Math.min(W, H) * 0.045;
  ctx.save(); ctx.globalAlpha = appear;
  ctx.font = `${theme.headWeight} ${size}px ${famHead(theme)}`; ctx.textAlign = "center";
  ctx.fillStyle = rgba(theme.palette.text, 0.96);
  ctx.fillText(transformCase(theme, name), W / 2, H * 0.9); ctx.restore();
}

function drawLogo(ctx, logo, W, H, scale, alpha, cx, cy, maxW) {
  if (!logo) return;
  const ratio = logo.width / logo.height || 1;
  let w = maxW * scale; let h = w / ratio;
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h); ctx.restore();
}

// -------------------- main frame --------------------
export function renderFrame(ctx, project, t) {
  const { width: W, height: H, scenes, images, logo } = project;
  ctx.clearRect(0, 0, W, H);

  let scene = scenes[scenes.length - 1];
  for (const s of scenes) { if (t >= s.start && t < s.end) { scene = s; break; } }
  const local = t - scene.start;
  const dur = Math.max(0.1, scene.end - scene.start);
  const p = clamp(local / dur, 0, 1);

  const hasImages = images && images.length > 0;
  if (hasImages) drawImageSlideshow(ctx, project, t);
  else drawThemeBackground(ctx, project, t, scene);

  drawDecor(ctx, project, t, scene);
  drawParticles(ctx, project, t, scene);
  if (hasImages) drawScrim(ctx, project, scene);

  const role = scene.role;
  if (role === "cta") {
    if (logo) drawLogo(ctx, logo, W, H, clamp(p / 0.3, 0, 1), 0.95, W / 2, H * 0.28, W * 0.26);
    drawHeadline(ctx, project, scene, p, 0.5);
    drawCtaButton(ctx, project, scene, p);
    drawBrand(ctx, project, p);
  } else if (["solution", "features", "benefits", "showcase"].includes(role)) {
    const r = drawHeadline(ctx, project, scene, p, 0.44);
    drawSubtext(ctx, project, scene, p, r.bottomY);
    drawKeywordChips(ctx, project, scene, p);
  } else {
    const r = drawHeadline(ctx, project, scene, p, 0.5);
    drawSubtext(ctx, project, scene, p, r.bottomY);
  }

  if (logo && role !== "cta" && scene.index > 0) {
    drawLogo(ctx, logo, W, H, 1, 0.5, W - W * 0.09, H * 0.08, W * 0.12);
  }

  drawEffects(ctx, project, t);

  // scene cuts
  const cut = hasImages ? 0.18 : 0.3;
  const fadeIn = clamp(local / cut, 0, 1);
  const remaining = scene.end - t;
  const fadeOut = clamp(remaining / cut, 0, 1);
  const black = 1 - (scene.index === 0 ? 1 : fadeIn) * (scene.index === scenes.length - 1 ? 1 : fadeOut);
  if (black > 0.001) { ctx.save(); ctx.globalAlpha = black; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.restore(); }

  const introFade = clamp(t / 0.5, 0, 1);
  const outroFade = clamp((project.duration - t) / 0.6, 0, 1);
  const gBlack = 1 - Math.min(introFade, outroFade);
  if (gBlack > 0.001) { ctx.save(); ctx.globalAlpha = gBlack; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// -------------------- fonts + export --------------------
export function pickMime() {
  const candidates = [
    "video/mp4;codecs=avc1.4d002a,mp4a.40.2", "video/mp4;codecs=avc1.64003e", "video/mp4;codecs=avc1", "video/mp4",
    "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return { mime: "video/webm", ext: "webm" };
  for (const m of candidates) { try { if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext: m.includes("mp4") ? "mp4" : "webm" }; } catch (e) {} }
  return { mime: "video/webm", ext: "webm" };
}

export async function ensureProjectFonts(project) {
  const fams = new Set(["Outfit", "Inter"]);
  if (project?.theme) { fams.add(project.theme.fontHead); fams.add(project.theme.fontBody); }
  if (document.fonts && document.fonts.load) {
    try {
      await Promise.all([...fams].flatMap((f) => [
        document.fonts.load(`700 72px '${f}'`),
        document.fonts.load(`400 32px '${f}'`),
      ]));
      await document.fonts.ready;
    } catch (e) {}
  }
}

export async function exportVideo(project, opts = {}) {
  const { audioUrl = null, fps = 30, bitrate = 10_000_000, onProgress } = opts;
  await ensureProjectFonts(project);

  const canvas = document.createElement("canvas");
  canvas.width = project.width; canvas.height = project.height;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(fps);

  let audioCtx = null, audioEl = null;
  if (audioUrl) {
    try {
      audioEl = new Audio(audioUrl); audioEl.crossOrigin = "anonymous"; audioEl.loop = true;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      src.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      await audioCtx.resume();
    } catch (e) { audioEl = null; }
  }

  const { mime, ext } = pickMime();
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: mime })); });

  rec.start(200);
  if (audioEl) { try { audioEl.currentTime = 0; await audioEl.play(); } catch (e) {} }

  const startTs = performance.now();
  await new Promise((resolve) => {
    const frame = (now) => {
      const tt = (now - startTs) / 1000;
      if (tt >= project.duration) { renderFrame(ctx, project, project.duration - 0.001); if (onProgress) onProgress(1); resolve(); return; }
      renderFrame(ctx, project, tt); if (onProgress) onProgress(clamp(tt / project.duration, 0, 1));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  await new Promise((r) => setTimeout(r, 150));
  rec.stop();
  if (audioEl) audioEl.pause();
  const blob = await stopped;
  if (audioCtx) { try { await audioCtx.close(); } catch (e) {} }
  return { blob, ext, mime };
}
