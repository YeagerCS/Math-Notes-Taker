import { getStroke } from 'perfect-freehand';
import type { Stroke } from '../../../api/types';

const pathCache = new WeakMap<Stroke, Path2D>();

function toTriples(points: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i + 2 < points.length; i += 3) out.push([points[i], points[i + 1], points[i + 2]]);
  return out;
}

function outlineToPath(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length === 0) return path;
  // Quadratic smoothing between outline midpoints.
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

function buildPath(stroke: Stroke, complete: boolean): Path2D {
  const isHighlighter = stroke.tool === 'highlighter';
  const outline = getStroke(toTriples(stroke.points), {
    size: stroke.size,
    thinning: isHighlighter ? 0 : 0.6,
    smoothing: 0.55,
    streamline: isHighlighter ? 0.5 : 0.35,
    simulatePressure: false,
    last: complete,
    start: { cap: true },
    end: { cap: true },
  });
  return outlineToPath(outline);
}

/** Path in page units. Completed strokes are cached; pass complete=false for a stroke in progress. */
export function strokePath(stroke: Stroke, complete = true): Path2D {
  if (!complete) return buildPath(stroke, false);
  let path = pathCache.get(stroke);
  if (!path) {
    path = buildPath(stroke, true);
    pathCache.set(stroke, path);
  }
  return path;
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, complete = true) {
  ctx.fillStyle = stroke.color;
  ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.38 : 1;
  ctx.globalCompositeOperation = stroke.tool === 'highlighter' ? 'multiply' : 'source-over';
  ctx.fill(strokePath(stroke, complete));
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Clears the canvas and draws strokes; highlighters first so ink stays crisp on top. */
export function drawPage(ctx: CanvasRenderingContext2D, strokes: Stroke[], pxPerUnit: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, 0, 0);
  for (const s of strokes) if (s.tool === 'highlighter') drawStroke(ctx, s);
  for (const s of strokes) if (s.tool !== 'highlighter') drawStroke(ctx, s);
}
