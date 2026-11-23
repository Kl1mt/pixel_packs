import { useEffect, useState } from 'react';

/** Frames per second over the last second, from requestAnimationFrame (debug only). */
export function FpsMeter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let since = performance.now();
    const loop = (now: number) => {
      frames++;
      if (now - since >= 1000) {
        setFps(Math.round((frames * 1000) / (now - since)));
        frames = 0;
        since = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <output className="fps" data-fps={fps} aria-label="Frames per second">
      {fps} fps
    </output>
  );
}
