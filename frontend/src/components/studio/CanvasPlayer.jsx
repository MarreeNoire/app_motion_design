import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { renderFrame, ensureProjectFonts } from "@/lib/motionEngine";
import { Play, Pause, RotateCcw, Maximize, Grid3x3, Gauge } from "lucide-react";

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const SPEEDS = [0.5, 1, 1.5, 2];

export const CanvasPlayer = forwardRef(({ project, audioUrl, onTime }, ref) => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const audioRef = useRef(null);
  const tRef = useRef(0);
  const lastTsRef = useRef(0);
  const rafRef = useRef(null);
  const speedRef = useRef(1);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [ready, setReady] = useState(false);

  const duration = project?.duration || 0;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;
    const ctx = canvas.getContext("2d");
    renderFrame(ctx, project, tRef.current);
  }, [project]);

  // initialise / reset on project change
  useEffect(() => {
    let cancelled = false;
    if (!project) return;
    const canvas = canvasRef.current;
    canvas.width = project.width;
    canvas.height = project.height;
    tRef.current = 0;
    setCurrentTime(0);
    onTime?.(0);
    ensureProjectFonts(project).then(() => {
      if (!cancelled) {
        setReady(true);
        draw();
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const stopLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const pause = useCallback(() => {
    setPlaying(false);
    stopLoop();
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const loop = useCallback(
    (now) => {
      const dt = ((now - lastTsRef.current) / 1000) * speedRef.current;
      lastTsRef.current = now;
      tRef.current += dt;
      if (tRef.current >= duration) {
        tRef.current = duration;
        draw();
        setCurrentTime(duration);
        onTime?.(duration);
        pause();
        return;
      }
      draw();
      setCurrentTime(tRef.current);
      onTime?.(tRef.current);
      rafRef.current = requestAnimationFrame(loop);
    },
    [duration, draw, onTime, pause]
  );

  const play = useCallback(() => {
    if (!project) return;
    if (tRef.current >= duration) tRef.current = 0;
    setPlaying(true);
    lastTsRef.current = performance.now();
    if (audioRef.current) {
      audioRef.current.currentTime = tRef.current;
      audioRef.current.playbackRate = speedRef.current;
      audioRef.current.play().catch(() => {});
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [project, duration, loop]);

  const seek = useCallback(
    (t) => {
      const clamped = Math.max(0, Math.min(duration, t));
      tRef.current = clamped;
      setCurrentTime(clamped);
      onTime?.(clamped);
      if (audioRef.current) audioRef.current.currentTime = clamped;
      draw();
    },
    [duration, draw, onTime]
  );

  useImperativeHandle(ref, () => ({ seek, play, pause, isPlaying: () => playing }), [seek, play, pause, playing]);

  useEffect(() => () => stopLoop(), []);

  useEffect(() => {
    speedRef.current = speed;
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const isVertical = project && project.height > project.width;

  return (
    <section data-testid="canvas-player" className="rounded-2xl border border-white/10 bg-[#0c0c12]/80 backdrop-blur-md p-4 shadow-lg">
      <div ref={wrapRef} className="relative flex items-center justify-center rounded-xl bg-black p-3" style={{ minHeight: 200 }}>
        <div className="relative inline-block">
          <canvas
            ref={canvasRef}
            data-testid="preview-canvas"
            className="block rounded-lg"
            style={{ maxHeight: isVertical ? "62vh" : "56vh", maxWidth: "100%", width: "auto", height: "auto" }}
          />
          {showGrid ? (
            <div className="pointer-events-none absolute inset-0 rounded-lg" data-testid="composition-grid">
              <div className="absolute inset-[5%] border border-cyan-400/40" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-400/30" />
              <div className="absolute top-1/2 left-0 w-full h-px bg-cyan-400/30" />
              <div className="absolute left-1/3 top-0 h-full w-px bg-white/10" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-white/10" />
            </div>
          ) : null}
          {!project ? (
            <div className="absolute inset-0 grid place-items-center rounded-lg">
              <p className="text-sm text-slate-500">Générez une vidéo pour lancer l'aperçu</p>
            </div>
          ) : null}
        </div>
      </div>

      {audioUrl ? <audio ref={audioRef} src={audioUrl} preload="auto" /> : null}

      {/* scrubber */}
      <div className="mt-4 flex items-center gap-3">
        <span data-testid="video-player-timecode" className="font-mono text-sm text-cyan-400 tabular-nums w-[108px]">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
        <input
          data-testid="video-player-scrubber"
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={currentTime}
          disabled={!project}
          onChange={(e) => seek(parseFloat(e.target.value))}
          className="studio-range flex-1"
        />
      </div>

      {/* controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            data-testid="video-player-play-button"
            onClick={() => (playing ? pause() : play())}
            disabled={!project}
            className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-[0_0_16px_rgba(124,58,237,0.5)] disabled:opacity-40"
          >
            {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button
            data-testid="video-player-restart-button"
            onClick={() => seek(0)}
            disabled={!project}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-40"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1">
            <Gauge size={14} className="text-slate-400" />
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                data-testid={`speed-${sp}x`}
                onClick={() => setSpeed(sp)}
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${speed === sp ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                {sp}x
              </button>
            ))}
          </div>
          <button
            data-testid="toggle-grid-button"
            onClick={() => setShowGrid((g) => !g)}
            className={`grid h-10 w-10 place-items-center rounded-xl border text-slate-200 ${showGrid ? "border-cyan-500 bg-cyan-500/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
          >
            <Grid3x3 size={16} />
          </button>
          <button
            data-testid="fullscreen-button"
            onClick={toggleFullscreen}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>
    </section>
  );
});

CanvasPlayer.displayName = "CanvasPlayer";
