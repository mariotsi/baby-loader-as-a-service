/**
 * Whether SectionNav holds its mark on the section a link jumped to.
 *
 * A jump glides the page past other sections, and the last ones never reach the band the observer watches, so the
 * mark holds while the page moves. After the jump lands, the first scroll lets go: the observer's last report comes
 * after scrollend. A click on a section already in place moves nothing, so no scroll and no scrollend arrive;
 * `settle`, two frames after the click, lets go of a jump that never started.
 */
export type JumpHold = { phase: 'free' } | { phase: 'jumping'; moved: boolean } | { phase: 'landed' };

export type JumpEvent =
  /** A link was clicked. */
  | 'click'
  /** The page scrolled. */
  | 'scroll'
  /** The page stopped scrolling: the browser's scrollend, or a quiet spell where the browser has none. */
  | 'scrollend'
  /** Two frames have passed since the click. */
  | 'settle';

export const freeHold: JumpHold = { phase: 'free' };

export function jumpHold(hold: JumpHold, event: JumpEvent): JumpHold {
  switch (event) {
    case 'click':
      return { phase: 'jumping', moved: false };
    case 'scroll':
      if (hold.phase === 'jumping') {
        return hold.moved ? hold : { phase: 'jumping', moved: true };
      }
      return hold.phase === 'landed' ? freeHold : hold;
    case 'scrollend':
      return hold.phase === 'jumping' ? { phase: 'landed' } : hold;
    case 'settle':
      return hold.phase === 'jumping' && !hold.moved ? freeHold : hold;
  }
}

/** Whether the observer's reports leave the mark where it is. */
export function isHeld(hold: JumpHold): boolean {
  return hold.phase !== 'free';
}
