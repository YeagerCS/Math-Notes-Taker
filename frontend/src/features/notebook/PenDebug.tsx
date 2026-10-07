import { useEffect, useState } from 'react';
import { isEraserInput } from './ink/input';

/**
 * On-screen log of raw pointer/pen events, enabled with `?debug` in the URL.
 * Used to see what a given tablet/browser actually reports for stylus buttons.
 */
export function PenDebug() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    let lastKey = '';
    const push = (line: string) => setLines((prev) => [line, ...prev].slice(0, 18));

    const onPointer = (e: PointerEvent) => {
      // Moves are noisy: only log when type/button state changes.
      const key = `${e.type}|${e.pointerType}|${e.button}|${e.buttons}|${e.pressure > 0.001}`;
      if (e.type === 'pointermove' && key === lastKey) return;
      lastKey = key;
      const decision = e.type === 'pointerdown' ? (isEraserInput(e) ? '  ⇒ ERASE' : '  ⇒ draw') : '';
      push(
        `${e.type.replace('pointer', 'p.')} ${e.pointerType} button=${e.button} buttons=${e.buttons} ` +
          `pressure=${e.pressure.toFixed(2)} tilt=${e.tiltX},${e.tiltY}${decision}`,
      );
    };
    const onOther = (e: Event) => {
      const m = e as MouseEvent;
      push(`${e.type} button=${m.button ?? '-'} buttons=${m.buttons ?? '-'}`);
    };

    const pointerTypes = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerover', 'pointerleave'];
    const otherTypes = ['contextmenu', 'auxclick', 'selectstart', 'touchstart', 'touchcancel'];
    pointerTypes.forEach((t) => window.addEventListener(t, onPointer as EventListener, true));
    otherTypes.forEach((t) => window.addEventListener(t, onOther, true));
    return () => {
      pointerTypes.forEach((t) => window.removeEventListener(t, onPointer as EventListener, true));
      otherTypes.forEach((t) => window.removeEventListener(t, onOther, true));
    };
  }, []);

  return (
    <div className="pen-debug">
      <div className="pen-debug__head">
        pen debug · {navigator.userAgent.match(/(SamsungBrowser|Chrome|Firefox)\/[\d.]+/)?.[0] ?? 'unknown browser'}
        <button onClick={() => setLines([])}>clear</button>
      </div>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
