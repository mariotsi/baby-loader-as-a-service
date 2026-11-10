/**
 * Whether SectionNav holds its mark on the section a link jumped to.
 *
 * A jump glides the page past other sections, and the last ones never reach the band the observer watches, so the
 * mark holds while the page moves. After the jump lands, the first scroll lets go: the observer's last report comes
 * after scrollend. A click on a section already in place moves nothing, so no scroll and no scrollend arrive;
 * `settle` lets go of a jump that never started. A glide's first scroll can come several frames after the click, so
 * a jump that will move holds until it scrolls, and only a long spell with no scroll at all settles it.
 */
export type JumpHold = { phase: 'free' } | { phase: 'jumping'; moved: boolean } | { phase: 'landed' };

export type JumpEvent =
  /** A link was clicked. */
  | 'click'
  /** The page scrolled. */
  | 'scroll'
  /** The page stopped scrolling: the browser's scrollend, or a quiet spell where the browser has none. */
  | 'scrollend'
  /** The jump has not started and will not: its section was already in place, or a long spell passed with no scroll. */
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

/**
 * Whether a jump to a section moves the page: false when the section is already where the jump puts it, or the page
 * cannot scroll any closer to it. `offset` is how far the section's top, less its scroll-margin-top, sits below the
 * top of the viewport; `scrollY` is the page's scroll and `maxScroll` the furthest it can go.
 */
export function jumpMoves({
  scrollY,
  offset,
  maxScroll,
}: {
  scrollY: number;
  offset: number;
  maxScroll: number;
}): boolean {
  const destination = Math.min(Math.max(scrollY + offset, 0), Math.max(maxScroll, 0));
  return Math.abs(destination - scrollY) >= 1;
}
