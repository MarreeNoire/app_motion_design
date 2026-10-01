import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyRound, Eye, EyeOff, CheckCircle2, XCircle, ShieldAlert, Loader2, Trash2, Save, ExternalLink } from "lucide-react";

const STATUS_META = {
  empty: { label: "Clé requise", cls: "text-amber-400 border-amber-400/40 bg-amber-400/10", icon: ShieldAlert },
  saved: { label: "Enregistrée (non testée)", cls: "text-slate-300 border-white/15 bg-white/5", icon: Save },
  valid: { label: "Clé validée", cls: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10", icon: CheckCircle2 },
  invalid: { label: "Clé invalide", cls: "text-red-400 border-red-400/40 bg-red-400/10", icon: XCircle },
};

export const ApiKeyManager = ({ apiKey, onChange, onSave, onDelete, onValidate, status, validating, message }) => {
  const [show, setShow] = useState(false);
  const meta = STATUS_META[status] || STATUS_META.empty;
  const StatusIcon = meta.icon;

  return (
    <section
      data-testid="api-key-manager"
      className="rounded-2xl border border-white/10 bg-[#121218]/80 backdrop-blur-md p-5 shadow-lg"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-[0_0_18px_rgba(124,58,237,0.5)]">
            <KeyRound className="h-4.5 w-4.5 text-white" size={18} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Clé API Agnes AI</h2>
            <p className="text-xs text-slate-400">Obligatoire pour la génération</p>
          </div>
        </div>
        <span
          data-testid="api-key-status-badge"
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}
        >
          <StatusIcon size={13} /> {meta.label}
        </span>
      </div>

      <div className="relative">
        <Input
          data-testid="agnes-api-key-input"
          type={show ? "text" : "password"}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-agnes-..."
          className="bg-[#0c0c12] border-white/10 text-slate-100 pr-11 font-mono text-sm h-11 focus-visible:ring-violet-500"
        />
        <button
          type="button"
          data-testid="api-key-toggle-visibility"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Afficher/masquer la clé"
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {message ? (
        <p
          data-testid="api-key-message"
          className={`mt-2.5 text-xs leading-relaxed ${status === "valid" ? "text-emerald-400" : status === "invalid" ? "text-red-400" : "text-slate-400"}`}
        >
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          data-testid="agnes-api-key-validate-button"
          onClick={onValidate}
          disabled={validating || !apiKey.trim()}
          className="bg-violet-600 hover:bg-violet-500 text-white flex-1 min-w-[130px]"
        >
          {validating ? <Loader2 className="animate-spin mr-1.5" size={16} /> : <CheckCircle2 className="mr-1.5" size={16} />}
          Tester la clé
        </Button>
        <Button
          data-testid="agnes-api-key-save-button"
          onClick={onSave}
          disabled={!apiKey.trim()}
          variant="outline"
          className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
        >
          <Save className="mr-1.5" size={16} /> Enregistrer
        </Button>
        <Button
          data-testid="agnes-api-key-delete-button"
          onClick={onDelete}
          variant="outline"
          className="border-red-500/30 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:text-red-200"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <a
        href="https://platform.agnes-ai.com"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="agnes-platform-link"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        Obtenir une clé sur platform.agnes-ai.com <ExternalLink size={12} />
      </a>
    </section>
  );
};
