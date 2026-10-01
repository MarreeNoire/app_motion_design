import React, { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DURATIONS, ASPECTS, QUALITIES, PRESET_PROMPTS } from "@/lib/storyboard";
import { Sparkles, Wand2, ImageUp, Music, X, Clapperboard, Loader2 } from "lucide-react";

const Field = ({ label, children }) => (
  <div className="space-y-2">
    <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">{label}</p>
    {children}
  </div>
);

export const PromptPanel = ({
  settings,
  update,
  onGenerate,
  generating,
  onLogoUpload,
  onLogoClear,
  onAudioUpload,
  onAudioClear,
  logoName,
  audioName,
  canGenerate,
}) => {
  const logoRef = useRef(null);
  const audioRef = useRef(null);

  return (
    <section
      data-testid="prompt-panel"
      className="rounded-2xl border border-white/10 bg-[#121218]/80 backdrop-blur-md p-5 shadow-lg space-y-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600">
          <Wand2 className="text-white" size={18} />
        </span>
        <h2 className="text-base font-semibold text-slate-100">Prompt & Paramètres</h2>
      </div>

      <Field label="Décrivez votre vidéo motion design">
        <Textarea
          data-testid="motion-prompt-textarea"
          value={settings.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="Ex : Créer une publicité motion design dynamique et moderne pour une application de livraison rapide avec typographie cinétique, couleurs vives et appel à l'action."
          className="min-h-[120px] bg-[#0c0c12] border-white/10 text-slate-100 text-sm leading-relaxed resize-y focus-visible:ring-violet-500"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PRESET_PROMPTS.map((p, i) => (
            <button
              key={i}
              data-testid={`preset-prompt-${i}`}
              onClick={() => update({ prompt: p })}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:border-violet-500/50 hover:text-white transition-colors"
            >
              <Sparkles size={11} className="text-violet-400" />
              {p.split(" ").slice(0, 3).join(" ")}…
            </button>
          ))}
        </div>
      </Field>

      <Field label="Nom de la marque (optionnel)">
        <Input
          data-testid="brand-name-input"
          value={settings.brandName}
          onChange={(e) => update({ brandName: e.target.value })}
          placeholder="Ex : SwiftDelivery"
          className="bg-[#0c0c12] border-white/10 text-slate-100 h-10 focus-visible:ring-violet-500"
        />
      </Field>

      <Field label="Durée (minimum 30s)">
        <div className="grid grid-cols-4 gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              data-testid={`duration-select-${d}s`}
              onClick={() => update({ duration: d })}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition-all ${
                settings.duration === d
                  ? "border-violet-500 bg-violet-500/15 text-white shadow-[0_0_14px_rgba(124,58,237,0.35)]"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25"
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
      </Field>

      <Field label="Format d'aspect">
        <div className="grid grid-cols-3 gap-2">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              data-testid={`aspect-ratio-${a.id.replace(":", "-")}`}
              onClick={() => update({ aspect: a.id })}
              className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 transition-all ${
                settings.aspect === a.id
                  ? "border-cyan-500 bg-cyan-500/10 text-white shadow-[0_0_14px_rgba(6,182,212,0.3)]"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25"
              }`}
            >
              <span
                className="rounded-sm border border-current"
                style={{ width: 22 * (a.w >= a.h ? 1 : a.w / a.h), height: 22 * (a.h >= a.w ? 1 : a.h / a.w) }}
              />
              <span className="text-[11px] font-semibold">{a.id}</span>
              <span className="text-[9px] text-slate-400 text-center leading-tight px-1">{a.hint}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Éléments optionnels">
        <div className="grid grid-cols-2 gap-2">
          <input ref={logoRef} type="file" accept="image/png,image/*" hidden onChange={(e) => e.target.files[0] && onLogoUpload(e.target.files[0])} data-testid="logo-file-input" />
          <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => e.target.files[0] && onAudioUpload(e.target.files[0])} data-testid="audio-file-input" />
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><ImageUp size={14} className="text-violet-400" /> Logo</span>
              {logoName ? (
                <button onClick={onLogoClear} data-testid="logo-clear-button" className="text-red-400 hover:text-red-300"><X size={14} /></button>
              ) : null}
            </div>
            <Button data-testid="logo-upload-button" onClick={() => logoRef.current?.click()} variant="outline" size="sm" className="mt-2 w-full border-white/10 bg-transparent text-xs text-slate-300 hover:bg-white/10">
              {logoName ? "Changer" : "Importer PNG"}
            </Button>
            {logoName ? <p className="mt-1 truncate text-[10px] text-slate-500">{logoName}</p> : null}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5"><Music size={14} className="text-cyan-400" /> Audio</span>
              {audioName ? (
                <button onClick={onAudioClear} data-testid="audio-clear-button" className="text-red-400 hover:text-red-300"><X size={14} /></button>
              ) : null}
            </div>
            <Button data-testid="audio-upload-button" onClick={() => audioRef.current?.click()} variant="outline" size="sm" className="mt-2 w-full border-white/10 bg-transparent text-xs text-slate-300 hover:bg-white/10">
              {audioName ? "Changer" : "Importer musique"}
            </Button>
            {audioName ? <p className="mt-1 truncate text-[10px] text-slate-500">{audioName}</p> : null}
          </div>
        </div>
      </Field>

      <Field label="Qualité d'export">
        <Select value={settings.quality} onValueChange={(v) => update({ quality: v })}>
          <SelectTrigger data-testid="quality-select" className="bg-[#0c0c12] border-white/10 text-slate-100 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#16161e] border-white/10 text-slate-100">
            {QUALITIES.map((q) => (
              <SelectItem key={q.id} value={q.id} data-testid={`quality-${q.id}`}>{q.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Button
        data-testid="generate-motion-button"
        onClick={onGenerate}
        disabled={generating || !canGenerate}
        className="w-full h-12 text-sm font-bold bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-[0_0_24px_rgba(124,58,237,0.45)] disabled:opacity-50"
      >
        {generating ? <Loader2 className="animate-spin mr-2" size={18} /> : <Clapperboard className="mr-2" size={18} />}
        {generating ? "Génération en cours…" : "Générer le Motion Design"}
      </Button>
    </section>
  );
};
