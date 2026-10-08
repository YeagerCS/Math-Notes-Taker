import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Paper, Stroke } from '../../api/types';
import { ERASER_RADIUS, MAX_CANVAS_PIXELS, PAGE_HEIGHT, PAGE_WIDTH } from './ink/constants';
import { polygonBounds, straightLinePoints, strokeHit, strokeInLasso, strokesBounds } from './ink/geometry';
import { hasEraserButton, isEraserInput, penState } from './ink/input';
import { paperStyle } from './ink/paper';
import { drawPage, drawStroke } from './ink/render';
import type { ToolSettings } from './tools';

export interface Selection {
  pageId: string;
  ids: string[];
}

interface Props {
  pageId: string;
  index: number;
  strokes: Stroke[];
  paper: Paper;
  /** CSS px per page unit. */
  scale: number;
  toolRef: RefObject<ToolSettings>;
  canDelete: boolean;
  /** Ids of lassoed strokes on this page, or null when the selection is elsewhere / empty. */
  selectedIds: string[] | null;
  onCommit: (pageId: string, strokes: Stroke[]) => void;
  onDelete: (pageId: string) => void;
  onSelect: (selection: Selection | null) => void;
  /** Selection dropped at an offset (page units, relative to this page — may land on another page). */
  onMoveSelection: (pageId: string, ids: string[], dx: number, dy: number) => void;
}

interface Point {
  x: number;
  y: number;
}

type Session =
  | { kind: 'draw'; pointerId: number; stroke: Stroke }
  | { kind: 'erase'; pointerId: number; strokes: Stroke[]; changed: boolean }
  | { kind: 'line'; pointerId: number; start: Point; stroke: Stroke }
  | { kind: 'lasso'; pointerId: number; points: number[] }
  | { kind: 'move'; pointerId: number; start: Point; client: { clientX: number; clientY: number }; dx: number; dy: number };

const round = (n: number) => Math.round(n * 10) / 10;

// crypto.randomUUID only exists in secure contexts (https/localhost), not on plain-http LAN dev.
const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function backingScale(scale: number) {
  const ideal = scale * (window.devicePixelRatio || 1);
  const max = Math.sqrt(MAX_CANVAS_PIXELS / (PAGE_WIDTH * PAGE_HEIGHT));
  return Math.min(ideal, max);
}

/** Padding (page units) around the selected ink for the selection frame. */
const SELECTION_PAD = 8;
/** Dragging a selection this close (CSS px) to the viewport's top/bottom edge scrolls it. */
const AUTOSCROLL_EDGE = 80;
const AUTOSCROLL_MAX_SPEED = 22;

export const PageSheet = memo(function PageSheet({
  pageId,
  index,
  strokes,
  paper,
  scale,
  toolRef,
  canDelete,
  selectedIds,
  onCommit,
  onDelete,
  onSelect,
  onMoveSelection,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const session = useRef<Session | null>(null);
  const liveFrame = useRef(0);
  const scrollFrame = useRef(0);
  const [visible, setVisible] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pxPerUnit = backingScale(scale);
  const width = PAGE_WIDTH * scale;
  const height = PAGE_HEIGHT * scale;

  // Selected strokes live on their own layer so dragging is just a CSS transform.
  const { selected, rest, bounds } = useMemo(() => {
    if (!selectedIds) return { selected: [] as Stroke[], rest: strokes, bounds: null };
    const ids = new Set(selectedIds);
    const selected = strokes.filter((s) => ids.has(s.id));
    if (selected.length === 0) return { selected, rest: strokes, bounds: null };
    const b = strokesBounds(selected);
    return {
      selected,
      rest: strokes.filter((s) => !ids.has(s.id)),
      bounds: {
        minX: b.minX - SELECTION_PAD,
        minY: b.minY - SELECTION_PAD,
        maxX: b.maxX + SELECTION_PAD,
        maxY: b.maxY + SELECTION_PAD,
      },
    };
  }, [strokes, selectedIds]);

  // The selection points at strokes that no longer exist here (undo, erase, …): drop it.
  useEffect(() => {
    if (selectedIds && selected.length === 0) onSelect(null);
  }, [selectedIds, selected, onSelect]);

  // Only keep canvases for pages near the viewport; big canvases are expensive on tablets.
  useEffect(() => {
    const el = sheetRef.current!;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '100% 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useLayoutEffect(() => {
    const ctx = baseRef.current?.getContext('2d');
    if (ctx) drawPage(ctx, rest, pxPerUnit);
  }, [rest, pxPerUnit, visible]);

  useLayoutEffect(() => {
    if (selectionRef.current) selectionRef.current.style.transform = '';
    const ctx = selectionCanvasRef.current?.getContext('2d');
    if (!ctx || !bounds) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, -bounds.minX * pxPerUnit, -bounds.minY * pxPerUnit);
    for (const s of selected) if (s.tool === 'highlighter') drawStroke(ctx, s);
    for (const s of selected) if (s.tool !== 'highlighter') drawStroke(ctx, s);
  }, [selected, bounds, pxPerUnit, visible]);

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  const toPage = (e: { clientX: number; clientY: number }): Point => {
    const rect = sheetRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAGE_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * PAGE_HEIGHT,
    };
  };

  /** Length in page units that renders as `cssPx` on screen. */
  const screenPx = (cssPx: number) => cssPx / scale;

  const renderLive = (eraserAt?: Point) => {
    cancelAnimationFrame(liveFrame.current);
    liveFrame.current = requestAnimationFrame(() => {
      const ctx = liveRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, 0, 0);
      const s = session.current;
      if (s?.kind === 'draw' || s?.kind === 'line') drawStroke(ctx, s.stroke, false);
      if (s?.kind === 'erase' && eraserAt) {
        ctx.beginPath();
        ctx.arc(eraserAt.x, eraserAt.y, ERASER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 30, 30, 0.08)';
        ctx.strokeStyle = 'rgba(30, 30, 30, 0.45)';
        ctx.lineWidth = 1 / pxPerUnit;
        ctx.fill();
        ctx.stroke();
      }
      if (s?.kind === 'lasso' && s.points.length >= 4) {
        ctx.beginPath();
        ctx.moveTo(s.points[0], s.points[1]);
        for (let i = 2; i < s.points.length; i += 2) ctx.lineTo(s.points[i], s.points[i + 1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(47, 85, 212, 0.07)';
        ctx.strokeStyle = 'rgba(47, 85, 212, 0.9)';
        ctx.lineWidth = screenPx(1.5);
        ctx.setLineDash([screenPx(6), screenPx(5)]);
        ctx.lineJoin = 'round';
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  };

  const erase = (s: Extract<Session, { kind: 'erase' }>, x: number, y: number) => {
    const kept = s.strokes.filter((st) => !strokeHit(st, x, y, ERASER_RADIUS));
    if (kept.length !== s.strokes.length) {
      s.strokes = kept;
      s.changed = true;
      const ctx = baseRef.current?.getContext('2d');
      if (ctx) drawPage(ctx, kept, pxPerUnit);
    }
  };

  /** Positions the dragged selection under the pen; also called while auto-scrolling. */
  const updateMove = (s: Extract<Session, { kind: 'move' }>) => {
    const p = toPage(s.client);
    s.dx = p.x - s.start.x;
    s.dy = p.y - s.start.y;
    if (selectionRef.current) {
      selectionRef.current.style.transform = `translate(${s.dx * scale}px, ${s.dy * scale}px)`;
    }
  };

  /** While a selection is dragged near the top/bottom edge, scroll so other pages come into reach. */
  const autoScroll = () => {
    const s = session.current;
    if (s?.kind !== 'move') return;
    const viewport = sheetRef.current?.closest<HTMLElement>('.viewport');
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const fromTop = s.client.clientY - rect.top;
      const fromBottom = rect.bottom - s.client.clientY;
      const strength = (dist: number) => Math.min(1, Math.max(0, (AUTOSCROLL_EDGE - dist) / AUTOSCROLL_EDGE));
      const delta = (strength(fromBottom) - strength(fromTop)) * AUTOSCROLL_MAX_SPEED;
      if (delta !== 0) {
        viewport.scrollTop += delta;
        updateMove(s);
      }
    }
    scrollFrame.current = requestAnimationFrame(autoScroll);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || session.current) return; // fingers pan/zoom (handled by viewport)
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    sheetRef.current!.setPointerCapture(e.pointerId);
    if (e.pointerType === 'pen') penState.activePointers++;

    const tool = toolRef.current!;
    const { x, y } = toPage(e);
    const erasing = tool.tool === 'eraser' || isEraserInput(e);

    if (!erasing && tool.tool === 'lasso') {
      const insideSelection = bounds && x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
      if (insideSelection) {
        session.current = {
          kind: 'move',
          pointerId: e.pointerId,
          start: { x, y },
          client: { clientX: e.clientX, clientY: e.clientY },
          dx: 0,
          dy: 0,
        };
        scrollFrame.current = requestAnimationFrame(autoScroll);
      } else {
        onSelect(null);
        session.current = { kind: 'lasso', pointerId: e.pointerId, points: [x, y] };
        renderLive();
      }
      return;
    }

    onSelect(null); // drawing or erasing ends any selection
    if (erasing) {
      const s: Session = { kind: 'erase', pointerId: e.pointerId, strokes, changed: false };
      session.current = s;
      erase(s, x, y);
      renderLive({ x, y });
    } else if (tool.tool === 'pen' || tool.tool === 'highlighter') {
      const pressure = e.pointerType === 'pen' ? Math.max(e.pressure, 0.05) : 0.5;
      session.current = {
        kind: 'draw',
        pointerId: e.pointerId,
        stroke: {
          id: newId(),
          tool: tool.tool,
          color: tool.color,
          size: tool.size,
          points: [round(x), round(y), round(pressure)],
        },
      };
      renderLive();
    } else if (tool.tool === 'line') {
      session.current = {
        kind: 'line',
        pointerId: e.pointerId,
        start: { x, y },
        // Stored as a normal pen stroke, so erasing, lasso and rendering need no special case.
        stroke: { id: newId(), tool: 'pen', color: tool.color, size: tool.size, points: straightLinePoints(x, y, x, y) },
      };
      renderLive();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    let s = session.current;
    if (!s || s.pointerId !== e.pointerId) return;

    if (s.kind === 'move') {
      s.client = { clientX: e.clientX, clientY: e.clientY };
      updateMove(s);
      return;
    }

    if (s.kind === 'line') {
      const end = toPage(e);
      end.x = Math.min(PAGE_WIDTH, Math.max(0, end.x));
      end.y = Math.min(PAGE_HEIGHT, Math.max(0, end.y));
      s.stroke.points = straightLinePoints(s.start.x, s.start.y, end.x, end.y);
      renderLive();
      return;
    }

    // Side button pressed after the pen touched down: drop the half-drawn stroke and erase instead.
    if (s.kind === 'draw' && hasEraserButton(e)) {
      s = { kind: 'erase', pointerId: e.pointerId, strokes, changed: false };
      session.current = s;
    }
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    let last = { x: 0, y: 0 };
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const { x, y } = toPage(ev);
      last = { x, y };
      if (s.kind === 'erase') {
        erase(s, x, y);
      } else if (s.kind === 'lasso') {
        const pts = s.points;
        const dx = x - pts[pts.length - 2];
        const dy = y - pts[pts.length - 1];
        if (dx * dx + dy * dy >= 4) pts.push(x, y);
      } else {
        const pts = s.stroke.points;
        const dx = x - pts[pts.length - 3];
        const dy = y - pts[pts.length - 2];
        if (dx * dx + dy * dy < 0.25) continue;
        const pressure = ev.pointerType === 'pen' ? Math.max(ev.pressure, 0.05) : 0.5;
        pts.push(round(x), round(y), round(pressure));
      }
    }
    renderLive(s.kind === 'erase' ? last : undefined);
  };

  const endSession = (e: React.PointerEvent) => {
    const s = session.current;
    if (!s || s.pointerId !== e.pointerId) return;
    session.current = null;
    cancelAnimationFrame(scrollFrame.current);
    if (e.pointerType === 'pen') {
      penState.activePointers = Math.max(0, penState.activePointers - 1);
      penState.lastPenAt = performance.now();
    }

    if (s.kind === 'draw') {
      // Commit first so the base canvas has the stroke before the live layer clears.
      onCommit(pageId, [...strokes, s.stroke]);
    } else if (s.kind === 'line') {
      const p = s.stroke.points;
      const length = Math.hypot(p[p.length - 3] - p[0], p[p.length - 2] - p[1]);
      if (e.type !== 'pointercancel' && length >= 3) onCommit(pageId, [...strokes, s.stroke]);
    } else if (s.kind === 'erase') {
      if (s.changed) onCommit(pageId, s.strokes);
    } else if (s.kind === 'lasso') {
      if (s.points.length >= 6) {
        const lassoBounds = polygonBounds(s.points);
        const ids = strokes.filter((st) => strokeInLasso(st, s.points, lassoBounds)).map((st) => st.id);
        if (ids.length > 0) onSelect({ pageId, ids });
      }
    } else if (s.kind === 'move') {
      // React re-renders (new position or new page) before the next paint, so no flicker.
      if (selectionRef.current) selectionRef.current.style.transform = '';
      if (e.type !== 'pointercancel' && selectedIds && Math.hypot(s.dx, s.dy) > 0.5) {
        onMoveSelection(pageId, selectedIds, s.dx, s.dy);
      }
    }
    renderLive();
  };

  return (
    <div className={`sheet-wrap ${bounds ? 'has-selection' : ''}`} style={{ width }}>
      <div
        ref={sheetRef}
        className="sheet"
        data-page-id={pageId}
        style={{ width, height, ...paperStyle(paper, scale) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endSession}
        onPointerCancel={endSession}
        onContextMenu={(e) => e.preventDefault()}
      >
        {(visible || bounds) && (
          <>
            <canvas
              ref={baseRef}
              className="sheet__canvas"
              width={Math.round(PAGE_WIDTH * pxPerUnit)}
              height={Math.round(PAGE_HEIGHT * pxPerUnit)}
            />
            {bounds && (
              <div
                ref={selectionRef}
                className="selection"
                style={{
                  left: bounds.minX * scale,
                  top: bounds.minY * scale,
                  width: (bounds.maxX - bounds.minX) * scale,
                  height: (bounds.maxY - bounds.minY) * scale,
                }}
              >
                <canvas
                  ref={selectionCanvasRef}
                  width={Math.max(1, Math.round((bounds.maxX - bounds.minX) * pxPerUnit))}
                  height={Math.max(1, Math.round((bounds.maxY - bounds.minY) * pxPerUnit))}
                />
              </div>
            )}
            <canvas
              ref={liveRef}
              className="sheet__canvas sheet__canvas--live"
              width={Math.round(PAGE_WIDTH * pxPerUnit)}
              height={Math.round(PAGE_HEIGHT * pxPerUnit)}
            />
          </>
        )}
      </div>
      <div className="sheet-footer">
        <span className="sheet-footer__num">{index + 1}</span>
        {canDelete &&
          (confirmDelete ? (
            <span className="sheet-footer__confirm">
              <button className="link-btn link-btn--danger" onClick={() => onDelete(pageId)}>
                Delete page
              </button>
              <button className="link-btn" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button className="link-btn sheet-footer__delete" onClick={() => setConfirmDelete(true)}>
              Remove
            </button>
          ))}
      </div>
    </div>
  );
});
