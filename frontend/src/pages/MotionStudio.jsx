import React, { useState, useEffect, useRef, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ApiKeyManager } from "@/components/studio/ApiKeyManager";
import { PromptPanel } from "@/components/studio/PromptPanel";
import { ThemeGallery } from "@/components/studio/ThemeGallery";
import { ImagePanel } from "@/components/studio/ImagePanel";
import { StoryboardTimeline } from "@/components/studio/StoryboardTimeline";
import { ProgressTracker } from "@/components/studio/ProgressTracker";
import { CanvasPlayer } from "@/components/studio/CanvasPlayer";
import { ExportPanel } from "@/components/studio/ExportPanel";
import { validateAgnesKey, generateAgnesStoryboard, extractApiError } from "@/lib/agnesApi";
import { buildProject, buildLocalStoryboard } from "@/lib/storyboard";
import { getTheme, getRandomTheme } from "@/lib/themes";
import { Clapperboard, Zap } from "lucide-react";

const LS_KEY = "agnes_ai_api_key";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let imgSeq = 0;

const DEFAULT_SETTINGS = {
  prompt: "",
  brandName: "",
  duration: 30,
  aspect: "16:9",
  quality: "1080p",
  themeId: "aurora-violet",
};

function loadImageFromFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ id: `img-${imgSeq++}`, url, name: file.name, img });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function MotionStudio() {
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState("empty");
  const [keyMessage, setKeyMessage] = useState("");
  const [validating, setValidating] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [logoImg, setLogoImg] = useState(null);
  const [logoName, setLogoName] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioName, setAudioName] = useState("");
  const [images, setImages] = useState([]);

  const [project, setProject] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [logLine, setLogLine] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  const playerRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      setApiKey(saved);
      setKeyStatus("saved");
      setKeyMessage("Clé chargée depuis le navigateur. Testez-la pour confirmer sa validité.");
    }
  }, []);

  const update = useCallback((partial) => setSettings((s) => ({ ...s, ...partial })), []);

  // ---------- API key ----------
  const onKeyChange = (v) => {
    setApiKey(v);
    if (keyStatus === "valid" || keyStatus === "invalid") {
      setKeyStatus(v.trim() ? "saved" : "empty");
      setKeyMessage("");
    }
  };
  const saveKey = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem(LS_KEY, apiKey.trim());
    setKeyStatus((s) => (s === "valid" ? "valid" : "saved"));
    toast.success("Clé API enregistrée dans le navigateur.");
  };
  const deleteKey = () => {
    localStorage.removeItem(LS_KEY);
    setApiKey("");
    setKeyStatus("empty");
    setKeyMessage("");
    toast.success("Clé API supprimée.");
  };
  const runValidation = async (silent = false) => {
    if (!apiKey.trim()) {
      setKeyStatus("empty");
      setKeyMessage("Veuillez saisir votre clé API Agnes AI.");
      if (!silent) toast.error("Clé API manquante.");
      return false;
    }
    setValidating(true);
    try {
      const res = await validateAgnesKey(apiKey.trim());
      if (res.valid) {
        setKeyStatus("valid");
        setKeyMessage(res.message || "Clé validée.");
        localStorage.setItem(LS_KEY, apiKey.trim());
        if (!silent) toast.success("Clé API Agnes AI validée.");
        return true;
      }
      setKeyStatus("invalid");
      setKeyMessage(res.message || "Clé invalide.");
      if (!silent) toast.error(res.message || "Clé invalide.");
      return false;
    } catch (e) {
      const msg = extractApiError(e);
      setKeyStatus("invalid");
      setKeyMessage(msg);
      if (!silent) toast.error(msg);
      return false;
    } finally {
      setValidating(false);
    }
  };

  // ---------- assets ----------
  const onLogoUpload = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setLogoImg(img);
        setLogoName(file.name);
        toast.success("Logo importé.");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const onLogoClear = () => { setLogoImg(null); setLogoName(""); };

  const onAudioUpload = (file) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioName(file.name);
    toast.success("Audio de fond importé.");
  };
  const onAudioClear = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioName("");
  };

  const onImagesAdd = async (files) => {
    const loaded = (await Promise.all(files.map(loadImageFromFile))).filter(Boolean);
    if (loaded.length) {
      setImages((prev) => [...prev, ...loaded]);
      toast.success(`${loaded.length} image(s) ajoutée(s).`);
    }
  };
  const onImageRemove = (index) => {
    setImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };
  const onImagesClear = () => {
    images.forEach((im) => URL.revokeObjectURL(im.url));
    setImages([]);
  };

  // ---------- themes ----------
  const onThemeSelect = (id) => update({ themeId: id });
  const onRandomTheme = () => {
    const t = getRandomTheme(settings.themeId);
    update({ themeId: t.id });
    toast.success(`Thème aléatoire : ${t.name}`);
  };

  // ---------- generation ----------
  const generate = async () => {
    if (!settings.prompt.trim()) {
      toast.error("Veuillez décrire votre vidéo dans le prompt.");
      return;
    }
    if (!apiKey.trim()) {
      toast.error("Clé API Agnes AI requise avant la génération.");
      setKeyStatus("empty");
      return;
    }

    setGenerating(true);
    setProject(null);
    setProgress(6);
    setActiveStage(0);
    setLogLine("Découpage syntaxique du prompt…");

    const theme = getTheme(settings.themeId);
    const localSb = buildLocalStoryboard(settings.prompt, settings.duration);

    await sleep(500);
    setProgress(20);

    if (keyStatus !== "valid") {
      setLogLine("Vérification de la clé API Agnes AI…");
      const ok = await runValidation(true);
      if (!ok) {
        setGenerating(false);
        toast.error(keyMessage || "Clé API invalide. Impossible de générer.");
        return;
      }
    }

    setActiveStage(1);
    setProgress(35);
    setLogLine("Appel du modèle Agnes AI (storyboard créatif)…");

    let sb = localSb;
    try {
      const res = await generateAgnesStoryboard({
        apiKey: apiKey.trim(),
        prompt: settings.prompt.trim(),
        duration: settings.duration,
        aspect: settings.aspect,
        brandName: settings.brandName,
      });
      if (res?.scenes?.length) {
        sb = res;
        setLogLine(`Storyboard reçu d'Agnes AI — ${res.scene_count} scènes générées.`);
      }
    } catch (e) {
      const msg = extractApiError(e);
      toast.warning(`Agnes AI indisponible — storyboard local utilisé. (${msg})`);
      setLogLine("Basculement sur le moteur de storyboard local.");
    }

    setProgress(66);
    setActiveStage(2);
    const imgNote = images.length ? ` · diaporama de ${images.length} images` : "";
    setLogLine(`Assemblage · thème « ${theme.name} »${imgNote}…`);
    await sleep(650);

    const proj = buildProject(sb, {
      duration: settings.duration,
      aspect: settings.aspect,
      quality: settings.quality,
      brandName: settings.brandName,
      theme,
      images: images.map((im) => im.img),
      logo: logoImg,
    });

    setProgress(90);
    setActiveStage(3);
    setLogLine("Rendu final & préparation de l'aperçu…");
    await sleep(500);

    setProject(proj);
    setProgress(100);
    setLogLine("Terminé.");
    toast.success(`Motion design ${settings.duration}s prêt — thème « ${theme.name} ».`);
    await sleep(600);
    setGenerating(false);
  };

  const handleSeek = (t) => {
    playerRef.current?.seek(t);
    setCurrentTime(t);
  };
  const pausePlayer = () => playerRef.current?.pause();

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-200">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-cyan-500/15 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#09090B]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-[0_0_20px_rgba(124,58,237,0.5)]">
              <Clapperboard className="text-white" size={20} />
            </span>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
                Agnes Motion Studio
              </h1>
              <p className="text-[11px] text-slate-400">Prompt → Motion Design · 30s+ · propulsé par Agnes AI</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 sm:flex">
            <Zap size={13} className={keyStatus === "valid" ? "text-emerald-400" : "text-amber-400"} />
            <span className="text-xs text-slate-300">{keyStatus === "valid" ? "Agnes AI connecté" : "Clé à valider"}</span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-3">
            <ApiKeyManager
              apiKey={apiKey}
              onChange={onKeyChange}
              onSave={saveKey}
              onDelete={deleteKey}
              onValidate={() => runValidation(false)}
              status={keyStatus}
              validating={validating}
              message={keyMessage}
            />
            <PromptPanel
              settings={settings}
              update={update}
              onGenerate={generate}
              generating={generating}
              onLogoUpload={onLogoUpload}
              onLogoClear={onLogoClear}
              onAudioUpload={onAudioUpload}
              onAudioClear={onAudioClear}
              logoName={logoName}
              audioName={audioName}
              canGenerate={!!apiKey.trim() && !!settings.prompt.trim()}
            />
          </div>

          <div className="space-y-5 lg:col-span-6">
            <CanvasPlayer ref={playerRef} project={project} audioUrl={audioUrl} onTime={setCurrentTime} />
            {generating ? <ProgressTracker activeStage={activeStage} progress={progress} logLine={logLine} /> : null}
            <ImagePanel images={images} onAdd={onImagesAdd} onRemove={onImageRemove} onClear={onImagesClear} />
          </div>

          <div className="space-y-5 lg:col-span-3">
            <ThemeGallery themeId={settings.themeId} onSelect={onThemeSelect} onRandom={onRandomTheme} />
            <StoryboardTimeline project={project} currentTime={currentTime} onSeek={handleSeek} />
            <ExportPanel project={project} audioUrl={audioUrl} onBeforeExport={pausePlayer} />
          </div>
        </div>
      </main>

      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}
