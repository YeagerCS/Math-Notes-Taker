/**
 * Pen input helpers.
 *
 * Stylus side buttons arrive as pointer `buttons` bits: barrel = 2, eraser = 32
 * (Samsung S Pen side button → 2 in Chrome/Samsung Internet; Surface-style eraser ends → 32).
 * Right mouse button also erases, which is handy on desktop.
 */
export function isEraserInput(e: PointerEvent | React.PointerEvent): boolean {
  if (e.pointerType === 'pen') return (e.buttons & 32) !== 0 || (e.buttons & 2) !== 0 || e.button === 5 || e.button === 2;
  if (e.pointerType === 'mouse') return e.button === 2 || (e.buttons & 2) !== 0;
  return false;
}

/** Shared between the viewport (finger gestures) and pages (pen) for palm rejection. */
export const penState = {
  activePointers: 0,
  lastPenAt: 0,
  /** Fingers are ignored while the pen is down and briefly after it lifts. */
  blocksTouch() {
    return this.activePointers > 0 || performance.now() - this.lastPenAt < 350;
  },
};
