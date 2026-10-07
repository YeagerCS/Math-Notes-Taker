import { memo, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Paper, Stroke } from '../../api/types';
import { ERASER_RADIUS, MAX_CANVAS_PIXELS, PAGE_HEIGHT, PAGE_WIDTH } from './ink/constants';
import { strokeHit } from './ink/geometry';
import { hasEraserButton, isEraserInput, penState } from './ink/input';
import { paperStyle } from './ink/paper';
import { drawPage, drawStroke } from './ink/render';
import type { ToolSettings } from './tools';

interface Props {
  pageId: string;
  index: number;
  strokes: Stroke[];
  paper: Paper;
  /** CSS px per page unit. */
  scale: number;
  toolRef: RefObject<ToolSettings>;
  canDelete: boolean;
  onCommit: (pageId: string, strokes: Stroke[]) => void;
  onDelete: (pageId: string) => void;
}

type Session =
  | { kind: 'draw'; pointerId: number; stroke: Stroke }
  | { kind: 'erase'; pointerId: number; strokes: Stroke[]; changed: boolean };

const round = (n: number) => Math.round(n * 10) / 10;

// crypto.randomUUID only exists in secure contexts (https/localhost), not on plain-http LAN dev.
const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function backingScale(scale: number) {
  const ideal = scale * (window.devicePixelRatio || 1);
  const max = Math.sqrt(MAX_CANVAS_PIXELS / (PAGE_WIDTH * PAGE_HEIGHT));
  return Math.min(ideal, max);
}

export const PageSheet = memo(function PageSheet({
  pageId,
  index,
  strokes,
  paper,
  scale,
  toolRef,
  canDelete,
  onCommit,
  onDelete,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const session = useRef<Session | null>(null);
  const liveFrame = useRef(0);
  const [visible, setVisible] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pxPerUnit = backingScale(scale);
  const width = PAGE_WIDTH * scale;
  const height = PAGE_HEIGHT * scale;

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
    if (ctx) drawPage(ctx, strokes, pxPerUnit);
  }, [strokes, pxPerUnit, visible]);

  const toPage = (e: { clientX: number; clientY: number }) => {
    const rect = sheetRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAGE_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * PAGE_HEIGHT,
    };
  };

  const renderLive = (eraserAt?: { x: number; y: number }) => {
    cancelAnimationFrame(liveFrame.current);
    liveFrame.current = requestAnimationFrame(() => {
      const ctx = liveRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, 0, 0);
      const s = session.current;
      if (s?.kind === 'draw') drawStroke(ctx, s.stroke, false);
      if (s?.kind === 'erase' && eraserAt) {
        ctx.beginPath();
        ctx.arc(eraserAt.x, eraserAt.y, ERASER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 30, 30, 0.08)';
        ctx.strokeStyle = 'rgba(30, 30, 30, 0.45)';
        ctx.lineWidth = 1 / pxPerUnit;
        ctx.fill();
        ctx.stroke();
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

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || session.current) return; // fingers pan/zoom (handled by viewport)
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    sheetRef.current!.setPointerCapture(e.pointerId);
    if (e.pointerType === 'pen') penState.activePointers++;

    const tool = toolRef.current!;
    const { x, y } = toPage(e);
    if (tool.tool === 'eraser' || isEraserInput(e)) {
      const s: Session = { kind: 'erase', pointerId: e.pointerId, strokes, changed: false };
      session.current = s;
      erase(s, x, y);
      renderLive({ x, y });
    } else {
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
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    let s = session.current;
    if (!s || s.pointerId !== e.pointerId) return;
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
    if (e.pointerType === 'pen') {
      penState.activePointers = Math.max(0, penState.activePointers - 1);
      penState.lastPenAt = performance.now();
    }
    if (s.kind === 'draw') {
      // Commit first so the base canvas has the stroke before the live layer clears.
      onCommit(pageId, [...strokes, s.stroke]);
    } else if (s.changed) {
      onCommit(pageId, s.strokes);
    }
    renderLive();
  };

  return (
    <div className="sheet-wrap" style={{ width }}>
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
        {visible && (
          <>
            <canvas
              ref={baseRef}
              className="sheet__canvas"
              width={Math.round(PAGE_WIDTH * pxPerUnit)}
              height={Math.round(PAGE_HEIGHT * pxPerUnit)}
            />
            <canvas
              ref={liveRef}
              className="sheet__canvas"
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
