import React from "react";
import { CheckCircle2, Loader2, Circle } from "lucide-react";

export const STAGES = [
  "Analyse du prompt & découpage",
  "Génération API Agnes AI",
  "Assemblage des couches & transitions",
  "Rendu final & préparation",
];

export const ProgressTracker = ({ activeStage, progress, logLine }) => {
  return (
    <section
      data-testid="generation-progress"
      className="rounded-2xl border border-violet-500/30 bg-[#121218]/90 backdrop-blur-md p-5 shadow-[0_0_30px_rgba(124,58,237,0.2)]"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-100">Génération Agnes AI</h3>
        <span data-testid="progress-percent" className="font-mono text-sm text-cyan-400">{Math.round(progress)}%</span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1e1e2a]">
        <div
          data-testid="progress-bar-fill"
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2.5">
        {STAGES.map((label, i) => {
          const done = i < activeStage;
          const active = i === activeStage;
          return (
            <li key={i} data-testid={`progress-stage-${i}`} className="flex items-center gap-2.5 text-sm">
              {done ? (
                <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
              ) : active ? (
                <Loader2 size={17} className="text-cyan-400 animate-spin shrink-0" />
              ) : (
                <Circle size={17} className="text-slate-600 shrink-0" />
              )}
              <span className={done ? "text-slate-400" : active ? "text-white font-medium" : "text-slate-500"}>
                {i + 1}. {label}
              </span>
            </li>
          );
        })}
      </ul>

      {logLine ? (
        <p data-testid="progress-log" className="mt-3 font-mono text-[11px] text-slate-400 truncate">
          › {logLine}
        </p>
      ) : null}
    </section>
  );
};
