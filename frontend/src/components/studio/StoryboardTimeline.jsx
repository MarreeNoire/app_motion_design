import React from "react";
import { Film, Clock } from "lucide-react";

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const StoryboardTimeline = ({ project, currentTime, onSeek }) => {
  if (!project) {
    return (
      <section data-testid="storyboard-empty" className="rounded-2xl border border-white/10 bg-[#121218]/80 backdrop-blur-md p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <Film className="text-violet-400" size={18} />
          <h2 className="text-base font-semibold text-slate-100">Storyboard</h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Le storyboard multi-scènes apparaîtra ici après la génération. Chaque scène est calculée automatiquement
          pour atteindre la durée choisie.
        </p>
      </section>
    );
  }

  const { scenes, duration } = project;

  return (
    <section data-testid="storyboard-timeline" className="rounded-2xl border border-white/10 bg-[#121218]/80 backdrop-blur-md p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Film className="text-violet-400" size={18} />
          <h2 className="text-base font-semibold text-slate-100">Storyboard ({scenes.length} scènes)</h2>
        </div>
        <span className="font-mono text-xs text-slate-400 flex items-center gap-1"><Clock size={12} /> {fmt(duration)}</span>
      </div>

      {/* visual timeline */}
      <div className="relative mb-4 flex h-9 w-full overflow-hidden rounded-lg bg-[#1e1e2a]">
        {scenes.map((s, i) => {
          const w = ((s.end - s.start) / duration) * 100;
          const active = currentTime >= s.start && currentTime < s.end;
          return (
            <button
              key={s.id}
              data-testid={`timeline-block-${i}`}
              onClick={() => onSeek(s.start)}
              style={{ width: `${w}%`, background: active ? s.style.accent : s.style.bg[1] }}
              className={`group relative border-r border-[#09090b] text-[9px] font-bold text-white/90 transition-opacity ${active ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
              title={s.label}
            >
              <span className="absolute inset-0 grid place-items-center">{i + 1}</span>
            </button>
          );
        })}
        <div
          className="pointer-events-none absolute top-0 h-full w-0.5 bg-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.9)]"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      </div>

      {/* scene cards */}
      <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 studio-scroll">
        {scenes.map((s, i) => {
          const active = currentTime >= s.start && currentTime < s.end;
          return (
            <button
              key={s.id}
              data-testid={`scene-card-${i + 1}`}
              onClick={() => onSeek(s.start)}
              className={`block w-full rounded-xl border p-3 text-left transition-all ${
                active ? "border-violet-500/60 bg-violet-500/10 shadow-[0_0_14px_rgba(124,58,237,0.25)]" : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: s.style.accent }}>{i + 1}</span>
                  <span className="text-xs font-semibold text-slate-200">{s.label}</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">{fmt(s.start)} – {fmt(s.end)}</span>
              </div>
              <p className="mt-1.5 text-sm font-bold text-white truncate">{s.headline}</p>
              {s.subtext ? <p className="text-[11px] text-slate-400 truncate">{s.subtext}</p> : null}
              {s.keywords?.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s.keywords.map((k, ki) => (
                    <span key={ki} className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-medium text-slate-300">{k}</span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
};
