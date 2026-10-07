/**
 * Pen input helpers.
 *
 * Standard stylus buttons arrive as pointer `buttons` bits: 1 = tip contact, 2 = barrel/side button,
 * 32 = eraser end. Right mouse button also erases, which is handy on desktop.
 *
 * Samsung Internet (S Pen) does NOT report the side button that way. Holding it makes the pen look
 * like a primary-button press with zero pressure — even while hovering — because the browser uses
 * button+drag for text selection. Real tip contact always reports pressure > 0. So a pen that is
 * "pressed" with zero pressure, or got pressed while hovering, is treated as the side button.
 */

/** Pressure at or below this while "pressed" means side button, not tip contact. */
const ZERO_PRESSURE = 0.001;

let sideButtonHeld = false;

/** Tracks the S Pen side button from hover events (call once at startup). */
export function installPenButtonTracker() {
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'pen') return;
    if (e.buttons === 0) sideButtonHeld = false;
    // Pressed while still in the air → side button (tip contact always has pressure).
    else if (e.buttons === 1 && e.pressure <= ZERO_PRESSURE) sideButtonHeld = true;
  };
  const reset = (e: PointerEvent) => e.pointerType === 'pen' && e.buttons === 0 && (sideButtonHeld = false);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerover', onMove, true);
  window.addEventListener('pointerup', reset, true);
}

/** Standard barrel/eraser-end buttons only — safe to check mid-stroke. */
export function hasEraserButton(e: PointerEvent | React.PointerEvent): boolean {
  if (e.pointerType === 'pen') return (e.buttons & ~1) !== 0 || e.button > 0;
  if (e.pointerType === 'mouse') return e.button === 2 || (e.buttons & 2) !== 0;
  return false;
}

/**
 * For pointerdown: standard buttons plus the Samsung zero-pressure heuristic. Not used mid-stroke,
 * where a pen lifting off can briefly report zero pressure on a normal stroke.
 */
export function isEraserInput(e: PointerEvent | React.PointerEvent): boolean {
  if (hasEraserButton(e)) return true;
  return e.pointerType === 'pen' && (sideButtonHeld || e.pressure <= ZERO_PRESSURE);
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
