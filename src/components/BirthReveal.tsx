'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Lang } from '@/lib/i18n';
import styles from './BirthReveal.module.css';

export function BirthReveal({ url, lang, onClose }: { url: string; lang: Lang; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [needsSound, setNeedsSound] = useState(false);
  const stalled = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function clearStall() {
    clearTimeout(stalled.current);
  }
  function waitForPlayback() {
    clearStall();
    stalled.current = setTimeout(onClose, 8000);
  }

  useEffect(() => {
    const element = dialog.current;
    const player = video.current;
    let active = true;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    stalled.current = setTimeout(onClose, 8000);
    if (player) {
      void playReveal(player)
        .then((muted) => {
          if (active) {
            setNeedsSound(muted);
          }
        })
        .catch(() => {
          if (active) {
            onClose();
          }
        });
    }

    return () => {
      active = false;
      clearTimeout(stalled.current);
      player?.pause();
      element?.close();
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label={lang === 'it' ? 'Il nostro benvenuto' : 'Welcome to the world'}
      onCancel={onClose}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: Owner videos are personal recordings without a caption track. */}
      <video
        ref={video}
        className={styles.video}
        src={url}
        playsInline
        preload="auto"
        onEnded={onClose}
        onError={onClose}
        onPlaying={clearStall}
        onWaiting={waitForPlayback}
      />
      <div className={styles.close}>
        <Button variant="ghost" onClick={onClose}>
          {lang === 'it' ? 'Chiudi il video' : 'Close video'}
        </Button>
      </div>
      {needsSound ? (
        <div className={styles.sound}>
          <Button
            onClick={() => {
              if (video.current) {
                video.current.muted = false;
                setNeedsSound(false);
              }
            }}
          >
            {lang === 'it' ? 'Attiva audio' : 'Turn on sound'}
          </Button>
        </div>
      ) : null}
    </dialog>
  );
}

async function playReveal(player: HTMLVideoElement): Promise<boolean> {
  player.muted = false;
  try {
    await player.play();
    return false;
  } catch (error) {
    if (!player.isConnected) {
      throw error;
    }
    player.muted = true;
    await player.play();
    return true;
  }
}
