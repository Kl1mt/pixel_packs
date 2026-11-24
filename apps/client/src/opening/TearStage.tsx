import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/audio.js';
import { crossedTearStep, sealSounds, tearStepSound } from '../audio/events.js';
import { Button } from '../components/Button.js';
import { TearScene, type TearSceneOptions } from './tearScene.js';
import type { PackTheme } from './themes.js';

export interface TearStageProps {
  theme: PackTheme;
  packSrc: string;
  packName: string;
  mood: TearSceneOptions['mood'];
  reduced: boolean;
  onTorn: () => void;
}

/** Big pixels for the tear on roomy screens (up to 6×), never below the card scale. */
const sceneScale = (w: number, h: number) =>
  Math.max(3, Math.min(6, Math.floor(Math.min(w, h) / 150)));

/**
 * Step 1 of an opening: drag across the seam to tear the pack (mouse or touch), or
 * click the pack / press "Tear it open" (GDD §7). The scene itself is a canvas.
 */
export function TearStage({ theme, packSrc, packName, mood, reduced, onTorn }: TearStageProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<TearScene | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const stepped = useRef(0);
  useEffect(() => {
    const step = tearStepSound(theme);
    if (theme.seal) for (const id of sealSounds(stepped.current, progress)) audio.play(id);
    else if (step && crossedTearStep(stepped.current, progress)) audio.play(step);
    stepped.current = progress;
  }, [progress, theme]);
  const torn = useRef(onTorn);
  useEffect(() => {
    torn.current = onTorn;
  }, [onTorn]);

  useEffect(() => {
    const el = host.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let live = true;
    let made: TearScene | null = null;
    const img = new Image();
    img.src = packSrc;
    const fit = () => {
      const r = el.getBoundingClientRect();
      made?.resize(r.width, r.height, sceneScale(window.innerWidth, window.innerHeight));
    };
    const ro = new ResizeObserver(fit);
    void img.decode().then(() => {
      if (!live) return;
      made = scene.current = new TearScene(cv, {
        theme,
        packImage: img,
        mood,
        reduced,
        onProgress: setProgress,
        onTorn: () => {
          torn.current();
        },
      });
      fit();
      ro.observe(el);
      setReady(true);
    });
    return () => {
      live = false;
      ro.disconnect();
      made?.destroy();
      scene.current = null;
    };
  }, [theme, packSrc, mood, reduced]);

  const pct = Math.round(progress * 100);
  return (
    <div className="tear" data-ready={ready} data-progress={pct}>
      <div ref={host} className="tear__scene">
        <canvas
          ref={canvas}
          className="tear__canvas"
          role="img"
          aria-label={`${packName}, sealed. Drag across the top seam to tear it open.`}
          data-testid="tear-canvas"
        />
      </div>
      <div className="tear__controls">
        <p className="tear__hint" aria-live="polite">
          {pct === 0
            ? 'Drag across the stitched seam to tear it open.'
            : `Tearing… ${String(pct)} %`}
        </p>
        <Button
          onClick={() => {
            scene.current?.autoTear();
          }}
          disabled={!ready}
        >
          Tear it open
        </Button>
      </div>
    </div>
  );
}
