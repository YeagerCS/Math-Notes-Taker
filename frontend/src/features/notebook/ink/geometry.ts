import type { Stroke } from '../../../api/types';

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const boundsCache = new WeakMap<Stroke, Bounds>();

function strokeBounds(stroke: Stroke): Bounds {
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
