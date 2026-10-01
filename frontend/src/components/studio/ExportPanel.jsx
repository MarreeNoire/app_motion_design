import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportVideo, pickMime } from "@/lib/motionEngine";
import { toast } from "sonner";
import { Download, Loader2, FileVideo, Clapperboard } from "lucide-react";

export const ExportPanel = ({ project, logoImg, audioUrl, onBeforeExport }) => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastUrl, setLastUrl] = useState(null);
  const [lastExt, setLastExt] = useState(null);

  const detected = pickMime();

  const handleExport = async () => {
    if (!project) return;
    onBeforeExport?.();
    setExporting(true);
    setProgress(0);
    if (lastUrl) {
      URL.revokeObjectURL(lastUrl);
      setLastUrl(null);
    }
    const tId = toast.loading("Rendu de la vidéo en temps réel…");
    try {
      const { blob, ext } = await exportVideo(project, {
        logoImg,
        audioUrl,
        fps: 30,
        bitrate: 10_000_000,
        onProgress: (p) => setProgress(Math.round(p * 100)),
      });
      const url = URL.createObjectURL(blob);
      setLastUrl(url);
      setLastExt(ext);
      // auto-download
      const a = document.createElement("a");
      a.href = url;
      a.download = `agnes-motion-${project.duration}s-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      const sizeMb = (blob.size / 1024 / 1024).toFixed(1);
      toast.success(`Vidéo exportée (${ext.toUpperCase()}, ${sizeMb} Mo)`, { id: tId });
    } catch (e) {
      toast.error(`Échec de l'export : ${e?.message || e}`, { id: tId });
    } finally {
      setExporting(false);
    }
  };

  return (
    <section data-testid="export-panel" className="rounded-2xl border border-white/10 bg-[#121218]/80 backdrop-blur-md p-5 shadow-lg">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
          <FileVideo className="text-white" size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-100">Exportation Vidéo</h2>
          <p className="text-xs text-slate-400">30 FPS · bitrate élevé · audio synchronisé</p>
        </div>
      </div>

      {project ? (
        <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
            <p className="text-slate-500">Résolution</p>
            <p className="font-mono text-slate-200">{project.width}×{project.height}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
            <p className="text-slate-500">Format</p>
            <p className="font-mono text-slate-200">{detected.ext.toUpperCase()} {detected.ext === "mp4" ? "(H.264)" : "(VP9)"}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
            <p className="text-slate-500">Durée</p>
            <p className="font-mono text-slate-200">{project.duration}s</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
            <p className="text-slate-500">Audio</p>
            <p className="font-mono text-slate-200">{audioUrl ? "Inclus" : "Aucun"}</p>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-sm text-slate-500">Générez d'abord une vidéo pour activer l'export.</p>
      )}

      {exporting ? (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Rendu en cours…</span>
            <span className="font-mono text-cyan-400">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#1e1e2a]">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">Le rendu s'effectue en temps réel — laissez l'onglet actif.</p>
        </div>
      ) : null}

      <Button
        data-testid="export-mp4-button"
        onClick={handleExport}
        disabled={!project || exporting}
        className="w-full h-12 font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white disabled:opacity-50"
      >
        {exporting ? <Loader2 className="animate-spin mr-2" size={18} /> : <Download className="mr-2" size={18} />}
        {exporting ? "Export…" : `Exporter la vidéo ${detected.ext.toUpperCase()}`}
      </Button>

      {lastUrl && !exporting ? (
        <a
          href={lastUrl}
          download={`agnes-motion-${project.duration}s.${lastExt}`}
          data-testid="redownload-link"
          className="mt-3 flex items-center justify-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
        >
          <Clapperboard size={13} /> Re-télécharger le dernier rendu
        </a>
      ) : null}
    </section>
  );
};
