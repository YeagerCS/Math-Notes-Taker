import type { CSSProperties } from 'react';
import type { Paper } from '../../../api/types';
import { GRID_SPACING, LINE_SPACING, PAGE_WIDTH } from './constants';

const LINE = 'rgba(70, 110, 160, 0.22)';
const DOT = 'rgba(60, 80, 110, 0.38)';
const MARGIN = 'rgba(214, 90, 90, 0.35)';

/** CSS background for a sheet of paper at the given scale (CSS px per page unit). */
export function paperStyle(paper: Paper, scale: number): CSSProperties {
  switch (paper) {
    case 'grid': {
      const s = GRID_SPACING * scale;
      const offset = ((PAGE_WIDTH % GRID_SPACING) / 2) * scale;
      return {
        backgroundImage: `linear-gradient(to right, ${LINE} 1px, transparent 1px), linear-gradient(to bottom, ${LINE} 1px, transparent 1px)`,
        backgroundSize: `${s}px ${s}px`,
        backgroundPosition: `${offset}px ${offset}px`,
      };
    }
    case 'lined': {
      const s = LINE_SPACING * scale;
      const margin = 90 * scale;
      return {
        backgroundImage: `linear-gradient(to right, transparent ${margin}px, ${MARGIN} ${margin}px, ${MARGIN} ${margin + 1}px, transparent ${margin + 1}px), linear-gradient(to bottom, transparent ${s - 1}px, ${LINE} ${s - 1}px)`,
        backgroundSize: `100% 100%, 100% ${s}px`,
        backgroundRepeat: 'no-repeat, repeat-y',
      };
    }
    case 'dotted': {
      const s = GRID_SPACING * scale;
      const r = Math.max(0.8, 1.6 * scale);
      return {
        backgroundImage: `radial-gradient(circle, ${DOT} ${r}px, transparent ${r + 0.6}px)`,
        backgroundSize: `${s}px ${s}px`,
        backgroundPosition: `${(-s / 2) % s}px ${(-s / 2) % s}px`,
      };
    }
    default:
      return {};
  }
}
