'use client';

import type { CreateTypes, Options } from 'canvas-confetti';
import { useCallback, useEffect, useRef } from 'react';
import styles from './Confetti.module.css';

// Ported 1:1 from the original baby-loader celebration, palette included: these
// colours are the original confetti, not theme tokens, so they stay fixed whatever
// palette the Site wears.
const COLORS = ['#FF8FB1', '#FFD66B', '#7DE2C9', '#8EC7FF', '#FFD1F0', '#FFC9A8', '#E3C6FF', '#BEE7A8'];

const TOTAL_PARTICLES = 400;

const BURSTS: Array<{ ratio: number; options: Options }> = [
  { ratio: 0.25, options: { spread: 26, startVelocity: 55 } },
  { ratio: 0.2, options: { spread: 60 } },
  { ratio: 0.35, options: { spread: 100, decay: 0.91, scalar: 0.8 } },
  { ratio: 0.1, options: { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 } },
  { ratio: 0.1, options: { spread: 120, startVelocity: 45 } },
];

/** A full-screen canvas that fires the celebration bursts each time `shots` goes up. */
export function Confetti({ shots }: { shots: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<CreateTypes | null>(null);

  const getInstance = useCallback(async () => {
    if (instanceRef.current) {
      return instanceRef.current;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const { default: confetti } = await import('canvas-confetti');
    // useWorker moves the whole animation onto an OffscreenCanvas in a worker,
    // so a busy main thread cannot stutter it. It degrades gracefully when
    // OffscreenCanvas is unavailable.
    instanceRef.current = confetti.create(canvas, { resize: true, useWorker: true });
    return instanceRef.current;
  }, []);

  useEffect(() => {
    if (shots === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    void getInstance().then((instance) => {
      if (!instance) {
        return;
      }
      for (const burst of BURSTS) {
        instance({
          origin: { y: 0.7 },
          colors: COLORS,
          disableForReducedMotion: true,
          ...burst.options,
          particleCount: Math.floor(TOTAL_PARTICLES * burst.ratio),
        });
      }
    });
  }, [shots, getInstance]);

  useEffect(() => {
    // Warm up the module and the worker now, so the first launch does not pay
    // for a dynamic import at the exact moment the animation should start.
    void getInstance();

    return () => {
      instanceRef.current?.reset();
      instanceRef.current = null;
    };
  }, [getInstance]);

  return (
    <div aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
