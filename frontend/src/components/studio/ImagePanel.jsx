import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Images, Plus, X, Info } from "lucide-react";

export const ImagePanel = ({ images, onAdd, onRemove, onClear }) => {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const count = images.length;
  const enough = count >= 5;

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (files.length) onAdd(files);
  };

  return (
    <section data-testid="image-panel" className="rounded-2xl border border-white/10 bg-[#121218]/80 backdrop-blur-md p-5 shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500">
            <Images className="text-white" size={18} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Images (diaporama animé)</h2>
            <p className="text-xs text-slate-400">Optionnel · 5 images min. recommandé</p>
          </div>
        </div>
        {count > 0 ? (
          <button data-testid="images-clear-button" onClick={onClear} className="text-xs text-red-400 hover:text-red-300">Tout retirer</button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="images-file-input"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        data-testid="images-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
          drag ? "border-cyan-400 bg-cyan-400/10" : "border-white/15 bg-white/[0.03] hover:border-white/30"
        }`}
      >
        <Plus className="mx-auto mb-1 text-slate-400" size={20} />
        <p className="text-xs text-slate-300">Glissez-déposez ou cliquez pour importer</p>
        <p className="text-[10px] text-slate-500">PNG, JPG, WebP · plusieurs fichiers à la fois</p>
      </div>

      {count > 0 ? (
        <>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {images.map((im, i) => (
              <div key={im.id || i} data-testid={`image-thumb-${i}`} className="group relative aspect-square overflow-hidden rounded-lg border border-white/10">
                <img src={im.url} alt={im.name} className="h-full w-full object-cover" />
                <button
                  data-testid={`image-remove-${i}`}
                  onClick={() => onRemove(i)}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500"
                >
                  <X size={12} />
                </button>
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">{i + 1}</span>
              </div>
            ))}
          </div>
          <p data-testid="images-count" className={`mt-2.5 flex items-center gap-1.5 text-xs ${enough ? "text-emerald-400" : "text-amber-400"}`}>
            <Info size={12} /> {count} image{count > 1 ? "s" : ""} · {enough ? "diaporama enrichi activé" : `ajoutez-en ${5 - count} de plus pour un rendu optimal`}
          </p>
        </>
      ) : null}
    </section>
  );
};
