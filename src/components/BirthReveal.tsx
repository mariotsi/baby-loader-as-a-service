'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { MediaUrl } from '@/lib/birthMedia';
import type { PublicPageCopy } from '@/lib/copy/publicPage';
import styles from './BirthReveal.module.css';

/** The Birth video full screen, with sound where the browser allows it; it closes when the video ends or stalls. */
export function BirthReveal({ url, t, onClose }: { url: MediaUrl; t: PublicPageCopy['reveal']; onClose: () => void }) {
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
    <dialog ref={dialog} className={styles.dialog} aria-label={t.label} onCancel={onClose}>
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
          {t.close}
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
            {t.turnOnSound}
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
