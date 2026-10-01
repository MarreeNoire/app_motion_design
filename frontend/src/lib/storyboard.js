// Storyboard / project assembly: maps an Agnes AI storyboard (or a local
// fallback) into a renderable project for the motion engine.
import { mixHex } from "./colors";

export const DURATIONS = [30, 35, 45, 60];

export const ASPECTS = [
  { id: "9:16", label: "9:16 Vertical", hint: "Reels / TikTok / Shorts", w: 9, h: 16 },
  { id: "1:1", label: "1:1 Carré", hint: "Feeds Instagram / Facebook", w: 1, h: 1 },
  { id: "16:9", label: "16:9 Horizontal", hint: "YouTube / LinkedIn", w: 16, h: 9 },
];

export const QUALITIES = [
  { id: "720p", label: "720p HD", short: 720 },
  { id: "1080p", label: "1080p Full HD", short: 1080 },
  { id: "4k", label: "4K Ultra HD", short: 2160 },
];

export const PALETTES = [
  { id: "violet-cyan", label: "Violet / Cyan", primary: "#7C3AED", secondary: "#06B6D4", accent: "#A855F7" },
  { id: "sunset", label: "Sunset", primary: "#F97316", secondary: "#EC4899", accent: "#FB7185" },
  { id: "emerald", label: "Émeraude", primary: "#10B981", secondary: "#22D3EE", accent: "#34D399" },
  { id: "gold", label: "Or / Noir", primary: "#F59E0B", secondary: "#EAB308", accent: "#FCD34D" },
  { id: "royal", label: "Bleu Royal", primary: "#3B82F6", secondary: "#8B5CF6", accent: "#60A5FA" },
  { id: "crimson", label: "Crimson", primary: "#EF4444", secondary: "#F97316", accent: "#FB7185" },
];

export const PRESET_PROMPTS = [
  "Créer une publicité motion design dynamique et moderne pour une application de livraison rapide avec typographie cinétique, couleurs vives et appel à l'action.",
  "Lancement produit Tech cyberpunk 3D pour une montre connectée futuriste, ambiance néon et transitions énergiques.",
  "Publicité éco-responsable minimaliste pour une marque de cosmétiques naturels, douce, élégante et apaisante.",
  "Trailer d'application mobile SaaS de gestion financière, moderne, data-driven, avec statistiques animées et CTA fort.",
];

const ROLE_STYLE = {
  hook: { animation: "kinetic", particles: true, shape: "wave", tone: 0 },
  problem: { animation: "slide", particles: false, shape: "grid", tone: 1 },
  solution: { animation: "cards", particles: true, shape: "geo", tone: 0 },
  features: { animation: "cards", particles: true, shape: "geo", tone: 1 },
  showcase: { animation: "kenburns", particles: false, shape: "rings", tone: 0 },
  benefits: { animation: "counters", particles: true, shape: "wave", tone: 1 },
  cta: { animation: "cta", particles: true, shape: "burst", tone: 0 },
};

const DARK = "#09090B";

export function computeDimensions(aspectId, qualityId) {
  const aspect = ASPECTS.find((a) => a.id === aspectId) || ASPECTS[2];
  const q = QUALITIES.find((x) => x.id === qualityId) || QUALITIES[1];
  const short = q.short;
  // short side = min dimension
  if (aspect.w >= aspect.h) {
    const h = short;
    const w = Math.round((h * aspect.w) / aspect.h);
    return { width: even(w), height: even(h) };
  }
  const w = short;
  const h = Math.round((w * aspect.h) / aspect.w);
  return { width: even(w), height: even(h) };
}

const even = (n) => (n % 2 === 0 ? n : n + 1);

function styleForScene(scene, palette) {
  const base = ROLE_STYLE[scene.role] || ROLE_STYLE.solution;
  const accent = base.tone === 0 ? palette.primary : palette.secondary;
  const accent2 = base.tone === 0 ? palette.secondary : palette.primary;
  const bg = [mixHex(DARK, accent, 0.12), mixHex(DARK, accent, 0.4)];
  return {
    animation: base.animation,
    particles: base.particles,
    shape: base.shape,
    accent,
    accent2,
    bg,
    textColor: "#FFFFFF",
  };
}

// Build a renderable project from a storyboard response + settings.
export function buildProject(storyboard, settings) {
  const palette = settings.palette;
  const { width, height } = computeDimensions(settings.aspect, settings.quality);
  const scenes = storyboard.scenes.map((s, i) => ({
    id: `scene-${i}`,
    index: i,
    role: s.role,
    label: s.label,
    start: s.start,
    end: s.end,
    duration: s.duration,
    headline: s.headline,
    subtext: s.subtext,
    keywords: s.keywords || [],
    style: styleForScene(s, palette),
  }));
  return {
    duration: settings.duration,
    aspect: settings.aspect,
    width,
    height,
    brandName: settings.brandName || storyboard.brandName || "",
    palette,
    scenes,
    source: storyboard.source || "local",
  };
}

// ---------- local fallback (no Agnes AI) ----------
const ROLE_TEMPLATES = {
  30: [["hook", 0.17], ["problem", 0.17], ["solution", 0.33], ["benefits", 0.21], ["cta", 0.12]],
  35: [["hook", 0.16], ["problem", 0.16], ["solution", 0.31], ["benefits", 0.23], ["cta", 0.14]],
  45: [["hook", 0.13], ["problem", 0.14], ["solution", 0.24], ["features", 0.2], ["benefits", 0.16], ["cta", 0.13]],
  60: [["hook", 0.11], ["problem", 0.12], ["solution", 0.19], ["features", 0.18], ["showcase", 0.15], ["benefits", 0.13], ["cta", 0.12]],
};

const ROLE_LABELS = {
  hook: "Accroche visuelle / Hook",
  problem: "Exposition du problème",
  solution: "Démonstration de la solution",
  features: "Fonctionnalités clés",
  showcase: "Mise en situation",
  benefits: "Avantages & bénéfices",
  cta: "Call-To-Action & Outro",
};

const STOPWORDS = new Set([
  "de", "la", "le", "les", "des", "un", "une", "et", "ou", "pour", "avec", "dans", "sur", "en", "au", "aux",
  "du", "d", "l", "à", "the", "a", "an", "and", "or", "for", "with", "of", "to", "créer", "créez", "video",
  "vidéo", "motion", "design",
]);

function keywordsFrom(prompt, count) {
  const words = (prompt || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const uniq = [...new Set(words)];
  return uniq.slice(0, count).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
}

export function buildLocalStoryboard(prompt, duration) {
  const weights = ROLE_TEMPLATES[duration] || ROLE_TEMPLATES[30];
  const kw = keywordsFrom(prompt, 12);
  const pick = (n) => (kw.length ? kw[n % kw.length] : "Impact");

  const copy = {
    hook: { headline: "Captez l'attention", subtext: "En 3 secondes chrono", keywords: [pick(0), pick(1)] },
    problem: { headline: "Le problème", subtext: "Ce qui freine aujourd'hui", keywords: [pick(2), pick(3)] },
    solution: { headline: "La solution", subtext: "Simple, rapide, efficace", keywords: [pick(0), pick(4), pick(5)] },
    features: { headline: "Fonctionnalités clés", subtext: "Tout ce dont vous avez besoin", keywords: [pick(2), pick(6), pick(7)] },
    showcase: { headline: "En action", subtext: "Vivez l'expérience", keywords: [pick(1), pick(8)] },
    benefits: { headline: "Les bénéfices", subtext: "Gagnez du temps et plus encore", keywords: [pick(3), pick(9)] },
    cta: { headline: "Passez à l'action", subtext: "Disponible maintenant", keywords: ["Essayez maintenant"] },
  };

  const raw = weights.map(([role, w]) => [role, Math.round(w * duration * 100) / 100]);
  const total = raw.reduce((a, [, d]) => a + d, 0);
  raw[raw.length - 1][1] = Math.round((raw[raw.length - 1][1] + (duration - total)) * 100) / 100;

  let t = 0;
  const scenes = raw.map(([role, d], i) => {
    const s = {
      index: i,
      role,
      label: ROLE_LABELS[role] || role,
      start: Math.round(t * 100) / 100,
      end: Math.round((t + d) * 100) / 100,
      duration: d,
      ...copy[role],
    };
    t += d;
    return s;
  });

  return { duration, scene_count: scenes.length, scenes, source: "local" };
}
