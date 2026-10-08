import type { Stroke } from '../../../api/types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const boundsCache = new WeakMap<Stroke, Bounds>();

export function strokeBounds(stroke: Stroke): Bounds {
  let b = boundsCache.get(stroke);
  if (!b) {
    b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const p = stroke.points;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < b.minX) b.minX = p[i];
      if (p[i] > b.maxX) b.maxX = p[i];
      if (p[i + 1] < b.minY) b.minY = p[i + 1];
      if (p[i + 1] > b.maxY) b.maxY = p[i + 1];
    }
    boundsCache.set(stroke, b);
  }
  return b;
}

function distToSegmentSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/** True if a circle at (x, y) with the given radius touches the stroke's centerline (plus its width). */
export function strokeHit(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const r = radius + stroke.size / 2;
  const b = strokeBounds(stroke);
  if (x < b.minX - r || x > b.maxX + r || y < b.minY - r || y > b.maxY + r) return false;
  const p = stroke.points;
  const rSq = r * r;
  if (p.length < 6) return distToSegmentSq(x, y, p[0], p[1], p[0], p[1]) <= rSq;
  for (let i = 3; i < p.length; i += 3) {
    if (distToSegmentSq(x, y, p[i - 3], p[i - 2], p[i], p[i + 1]) <= rSq) return true;
  }
  return false;
}

/** Bounding box of several strokes including their ink width. */
export function strokesBounds(strokes: Stroke[]): Bounds {
  const out = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const s of strokes) {
    const b = strokeBounds(s);
    const pad = s.size / 2;
    out.minX = Math.min(out.minX, b.minX - pad);
    out.minY = Math.min(out.minY, b.minY - pad);
    out.maxX = Math.max(out.maxX, b.maxX + pad);
    out.maxY = Math.max(out.maxY, b.maxY + pad);
  }
  return out;
}

/**
 * Winding-number test; `polygon` is a flat [x0, y0, x1, y1, ...] list (implicitly closed).
 * Non-zero winding (rather than even-odd) so a sloppy lasso that overlaps itself still counts
 * the doubly-circled area as inside.
 */
export function pointInPolygon(x: number, y: number, polygon: number[]): boolean {
  let winding = 0;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
    const x0 = polygon[j];
    const y0 = polygon[j + 1];
    const x1 = polygon[i];
    const y1 = polygon[i + 1];
    const side = (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0);
    if (y0 <= y) {
      if (y1 > y && side > 0) winding++;
    } else if (y1 <= y && side < 0) winding--;
  }
  return winding !== 0;
}

/** A stroke counts as lassoed when most of its points lie inside the loop. */
export function strokeInLasso(stroke: Stroke, polygon: number[], bounds: Bounds): boolean {
  const b = strokeBounds(stroke);
  if (b.maxX < bounds.minX || b.minX > bounds.maxX || b.maxY < bounds.minY || b.minY > bounds.maxY) {
    return false;
  }
  const p = stroke.points;
  let inside = 0;
  for (let i = 0; i < p.length; i += 3) if (pointInPolygon(p[i], p[i + 1], polygon)) inside++;
  return inside >= (p.length / 3) * 0.6;
}

export function polygonBounds(polygon: number[]): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let i = 0; i < polygon.length; i += 2) {
    b.minX = Math.min(b.minX, polygon[i]);
    b.maxX = Math.max(b.maxX, polygon[i]);
    b.minY = Math.min(b.minY, polygon[i + 1]);
    b.maxY = Math.max(b.maxY, polygon[i + 1]);
  }
  return b;
}

/** New stroke object shifted by (dx, dy); keeps the id so a selection can follow it. */
export function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  const points = stroke.points.slice();
  for (let i = 0; i < points.length; i += 3) {
    points[i] = Math.round((points[i] + dx) * 10) / 10;
    points[i + 1] = Math.round((points[i + 1] + dy) * 10) / 10;
  }
  return { ...stroke, points };
}

/** Lines within this angle of horizontal/vertical snap to it (handy for axes). */
const LINE_SNAP_DEGREES = 3;
const LINE_SAMPLE_SPACING = 12;

/**
 * Stroke points ([x, y, pressure, ...]) for a straight line with uniform width.
 * Sampled along its length so hit-testing and lasso selection treat it like handwriting.
 */
export function straightLinePoints(x0: number, y0: number, x1: number, y1: number): number[] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const snap = Math.tan((LINE_SNAP_DEGREES * Math.PI) / 180);
  if (Math.abs(dy) <= Math.abs(dx) * snap) y1 = y0;
  else if (Math.abs(dx) <= Math.abs(dy) * snap) x1 = x0;

  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / LINE_SAMPLE_SPACING));
  const points: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push(Math.round((x0 + (x1 - x0) * t) * 10) / 10, Math.round((y0 + (y1 - y0) * t) * 10) / 10, 0.5);
  }
  return points;
}
