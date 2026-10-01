import React, { useState } from "react";
import { THEMES, THEME_CATEGORIES } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import { Palette, Shuffle, Check } from "lucide-react";

export const ThemeGallery = ({ themeId, onSelect, onRandom }) => {
  const [cat, setCat] = useState("Tous");
  const list = cat === "Tous" ? THEMES : THEMES.filter((t) => t.category === cat);

  return (
    <section data-testid="theme-gallery" className="rounded-2xl border border-white/10 bg-[#121218]/80 backdrop-blur-md p-5 shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600">
            <Palette className="text-white" size={18} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Thèmes visuels</h2>
            <p className="text-xs text-slate-400">{THEMES.length} styles · typographies & animations variées</p>
          </div>
        </div>
        <Button data-testid="random-theme-button" onClick={onRandom} size="sm" variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20">
          <Shuffle size={14} className="mr-1.5" /> Aléatoire
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {THEME_CATEGORIES.map((c) => (
          <button
            key={c}
            data-testid={`theme-cat-${c}`}
            onClick={() => setCat(c)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              cat === c ? "bg-violet-600 text-white" : "border border-white/10 bg-white/5 text-slate-300 hover:text-white"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1 studio-scroll">
        {list.map((t) => {
          const active = t.id === themeId;
          return (
            <button
              key={t.id}
              data-testid={`theme-${t.id}`}
              onClick={() => onSelect(t.id)}
              className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                active ? "border-white ring-2 ring-violet-500/60" : "border-white/10 hover:border-white/30"
              }`}
            >
              <div className="h-14 w-full relative" style={{ background: `linear-gradient(135deg, ${t.palette.bgDark}, ${t.palette.primary})` }}>
                <span className="absolute bottom-1.5 left-2 flex gap-1">
                  <span className="h-3 w-3 rounded-full border border-white/30" style={{ background: t.palette.primary }} />
                  <span className="h-3 w-3 rounded-full border border-white/30" style={{ background: t.palette.secondary }} />
                  <span className="h-3 w-3 rounded-full border border-white/30" style={{ background: t.palette.accent }} />
                </span>
                <span className="absolute right-2 top-1.5 text-[11px] font-bold tracking-wide" style={{ color: t.palette.text, fontFamily: `'${t.fontHead}', sans-serif` }}>
                  Aa
                </span>
                {active ? (
                  <span className="absolute right-1.5 bottom-1.5 grid h-5 w-5 place-items-center rounded-full bg-violet-600 text-white">
                    <Check size={12} />
                  </span>
                ) : null}
              </div>
              <div className="px-2.5 py-2">
                <p className="truncate text-xs font-semibold text-slate-100">{t.name}</p>
                <p className="truncate text-[10px] text-slate-500">{t.category}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
