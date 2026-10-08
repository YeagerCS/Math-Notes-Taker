import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
  type RefObject,
} from 'react';
import type { Page, Paper, Stroke } from '../../api/types';
import { MAX_ZOOM, MIN_ZOOM, PAGE_HEIGHT, PAGE_WIDTH } from './ink/constants';
import { strokesBounds, translateStroke } from './ink/geometry';
import { penState } from './ink/input';
import { PageSheet, type Selection } from './PageSheet';
import type { ToolSettings } from './tools';

export interface ViewportHandle {
  zoomBy(factor: number): void;
  resetZoom(): void;
}

interface Props {
  ref?: Ref<ViewportHandle>;
  pages: Page[];
  paper: Paper;
  toolRef: RefObject<ToolSettings>;
  onZoomChange: (zoom: number) => void;
  /** True while the lasso tool is active; switching tools drops the selection. */
  lassoActive: boolean;
  onCommit: (pageId: string, strokes: Stroke[]) => void;
  /** One undo step touching several pages. */
  onCommitChanges: (changes: { pageId: string; strokes: Stroke[] }[]) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
}

/** Page width at zoom 1 is "fit to screen", capped for large displays. */
const fitWidth = (viewportWidth: number) => Math.max(280, Math.min(viewportWidth - 32, 920));
/** Stack padding/gaps scale with zoom so zooming maps content points linearly. */
const PAD = 20;
const GAP = 36;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

interface Point {
  x: number;
  y: number;
}

export function NotebookViewport({
  ref,
  pages,
  paper,
  toolRef,
  onZoomChange,
  lassoActive,
  onCommit,
  onCommitChanges,
  onAddPage,
  onDeletePage,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);

  const pageWidth = fitWidth(viewportWidth) * zoom;
  const scale = pageWidth / PAGE_WIDTH;
  const stackWidthAt = useCallback(
    (z: number) => fitWidth(viewportWidth) * z + 2 * PAD * z,
    [viewportWidth],
  );

  useEffect(() => {
    const el = viewportRef.current!;
    const ro = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => onZoomChange(zoom), [zoom, onZoomChange]);

  /**
   * Commits a zoom level so that `stackPoint` (in current, unscaled stack coordinates)
   * ends up under `screenPoint` (relative to the viewport).
   */
  const commitZoom = useCallback(
    (nextZoom: number, stackPoint: Point, screenPoint: Point) => {
      const el = viewportRef.current!;
      const z = clampZoom(nextZoom);
      const r = z / zoomRef.current;
      const nextOffsetX = Math.max(0, (el.clientWidth - stackWidthAt(z)) / 2);
      pendingScroll.current = {
        left: nextOffsetX + stackPoint.x * r - screenPoint.x,
        top: stackPoint.y * r - screenPoint.y,
      };
      if (z === zoomRef.current) applyPendingScroll();
      else setZoom(z);
    },
    [stackWidthAt],
  );

  const applyPendingScroll = () => {
    const el = viewportRef.current!;
    stackRef.current!.style.transform = '';
    if (pendingScroll.current) {
      el.scrollLeft = pendingScroll.current.left;
      el.scrollTop = pendingScroll.current.top;
      pendingScroll.current = null;
    }
  };

  useLayoutEffect(applyPendingScroll, [zoom]);

  /** Zoom around a point given relative to the viewport. */
  const zoomAt = useCallback(
    (nextZoom: number, screenPoint: Point) => {
      const el = viewportRef.current!;
      const stackPoint = {
        x: el.scrollLeft + screenPoint.x - stackRef.current!.offsetLeft,
        y: el.scrollTop + screenPoint.y,
      };
      commitZoom(nextZoom, stackPoint, screenPoint);
    },
    [commitZoom],
  );

  useImperativeHandle(ref, () => ({
    zoomBy(factor) {
      const el = viewportRef.current!;
      zoomAt(zoomRef.current * factor, { x: el.clientWidth / 2, y: el.clientHeight / 2 });
    },
    resetZoom() {
      const el = viewportRef.current!;
      zoomAt(1, { x: el.clientWidth / 2, y: el.clientHeight / 2 });
    },
  }));

  // ---- Lasso selection (lives here because a move can end on another page) ----
  const [selection, setSelection] = useState<Selection | null>(null);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const viewportWidthRef = useRef(viewportWidth);
  viewportWidthRef.current = viewportWidth;

  useEffect(() => {
    if (!lassoActive) setSelection(null);
  }, [lassoActive]);

  const moveSelection = useCallback(
    (pageId: string, ids: string[], dx: number, dy: number) => {
      const all = pagesRef.current;
      const sourceIndex = all.findIndex((p) => p.id === pageId);
      if (sourceIndex < 0) return;
      const source = all[sourceIndex];
      const idSet = new Set(ids);
      const moving = source.strokes.filter((s) => idSet.has(s.id));
      if (moving.length === 0) return;
      const b = strokesBounds(moving);

      // Pages are stacked at a fixed pitch, so the target page follows from where the centre of the selection lands.
      const gapUnits = (GAP * PAGE_WIDTH) / fitWidth(viewportWidthRef.current);
      const pitch = PAGE_HEIGHT + gapUnits;
      const centreY = sourceIndex * pitch + (b.minY + b.maxY) / 2 + dy;
      const targetIndex = Math.min(all.length - 1, Math.max(0, Math.floor((centreY + gapUnits / 2) / pitch)));
      const target = all[targetIndex];
      dy -= (targetIndex - sourceIndex) * pitch;

      // Keep the selection on the paper.
      const clamp = (delta: number, min: number, max: number, size: number) =>
        max - min >= size ? -min : Math.min(size - max, Math.max(-min, delta));
      dx = clamp(dx, b.minX, b.maxX, PAGE_WIDTH);
      dy = clamp(dy, b.minY, b.maxY, PAGE_HEIGHT);

      const moved = moving.map((s) => translateStroke(s, dx, dy));
      if (target.id === source.id) {
        const byId = new Map(moved.map((s) => [s.id, s]));
        onCommit(source.id, source.strokes.map((s) => byId.get(s.id) ?? s));
      } else {
        onCommitChanges([
          { pageId: source.id, strokes: source.strokes.filter((s) => !idSet.has(s.id)) },
          { pageId: target.id, strokes: [...target.strokes, ...moved] },
        ]);
      }
      setSelection({ pageId: target.id, ids });
    },
    [onCommit, onCommitChanges],
  );

  // Ctrl/⌘ + wheel (and trackpad pinch) zooms around the cursor.
  useEffect(() => {
    const el = viewportRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(zoomRef.current * Math.exp(-e.deltaY * 0.01), { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // ---- Finger gestures: one finger pans (with momentum), two fingers pinch-zoom. ----
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist0: number; mid0: Point; origin: Point; scale: number; mid: Point } | null>(null);
  const velocity = useRef<Point & { t: number }>({ x: 0, y: 0, t: 0 });
  const momentumFrame = useRef(0);

  const local = (e: React.PointerEvent): Point => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startPinch = () => {
    const [a, b] = [...touches.current.values()];
    const stackRect = stackRef.current!.getBoundingClientRect();
    const viewRect = viewportRef.current!.getBoundingClientRect();
    const mid0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch.current = {
      dist0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid0,
      mid: mid0,
      scale: 1,
      origin: { x: mid0.x + viewRect.left - stackRect.left, y: mid0.y + viewRect.top - stackRect.top },
    };
    stackRef.current!.style.transformOrigin = `${pinch.current.origin.x}px ${pinch.current.origin.y}px`;
  };

  const endPinch = () => {
    const p = pinch.current;
    pinch.current = null;
    if (p) commitZoom(zoomRef.current * p.scale, p.origin, p.mid);
  };

  const cancelGestures = () => {
    touches.current.clear();
    if (pinch.current) endPinch();
    cancelAnimationFrame(momentumFrame.current);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(momentumFrame.current);
    if (e.pointerType === 'pen') return cancelGestures(); // palm went down before the pen
    if (e.pointerType !== 'touch' || penState.blocksTouch()) return;
    viewportRef.current!.setPointerCapture(e.pointerId);
    touches.current.set(e.pointerId, local(e));
    velocity.current = { x: 0, y: 0, t: performance.now() };
    if (touches.current.size === 2) startPinch();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = touches.current.get(e.pointerId);
    if (!prev) return;
    if (penState.blocksTouch()) return cancelGestures();
    const pt = local(e);
    touches.current.set(e.pointerId, pt);
    const el = viewportRef.current!;

    if (pinch.current && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()];
      const p = pinch.current;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      p.scale = clampZoom(zoomRef.current * (dist / p.dist0)) / zoomRef.current;
      p.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      stackRef.current!.style.transform = `translate(${p.mid.x - p.mid0.x}px, ${p.mid.y - p.mid0.y}px) scale(${p.scale})`;
    } else if (touches.current.size === 1) {
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      el.scrollLeft -= dx;
      el.scrollTop -= dy;
      const now = performance.now();
      const dt = Math.max(1, now - velocity.current.t);
      // Smooth the velocity a little to avoid jittery flings.
      velocity.current = {
        x: 0.8 * (dx / dt) + 0.2 * velocity.current.x,
        y: 0.8 * (dy / dt) + 0.2 * velocity.current.y,
        t: now,
      };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!touches.current.delete(e.pointerId)) return;
    if (pinch.current && touches.current.size < 2) {
      endPinch();
      touches.current.clear(); // don't turn the remaining finger into a pan jump
      return;
    }
    if (touches.current.size === 0 && performance.now() - velocity.current.t < 60) fling();
  };

  const fling = () => {
    const el = viewportRef.current!;
    let { x: vx, y: vy } = velocity.current;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      el.scrollLeft -= vx * dt;
      el.scrollTop -= vy * dt;
      const decay = Math.pow(0.996, dt);
      vx *= decay;
      vy *= decay;
      if (Math.hypot(vx, vy) > 0.02) momentumFrame.current = requestAnimationFrame(step);
    };
    momentumFrame.current = requestAnimationFrame(step);
  };

  return (
    <div
      ref={viewportRef}
      className="viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={stackRef}
        className="stack"
        style={
          {
            width: stackWidthAt(zoom),
            padding: PAD * zoom,
            gap: GAP * zoom,
            '--gap': `${GAP * zoom}px`,
          } as CSSProperties
        }
      >
        {pages.map((page, i) => (
          <PageSheet
            key={page.id}
            pageId={page.id}
            index={i}
            strokes={page.strokes}
            paper={paper}
            scale={scale}
            toolRef={toolRef}
            canDelete={pages.length > 1}
            selectedIds={selection?.pageId === page.id ? selection.ids : null}
            onCommit={onCommit}
            onDelete={onDeletePage}
            onSelect={setSelection}
            onMoveSelection={moveSelection}
          />
        ))}
        <button className="add-page" style={{ width: pageWidth }} onClick={onAddPage}>
          <span className="add-page__plus">+</span> New page
        </button>
      </div>
    </div>
  );
}
