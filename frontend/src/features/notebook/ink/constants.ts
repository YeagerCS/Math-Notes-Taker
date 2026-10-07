/** Pages use a fixed coordinate system (A4 ratio); strokes are stored in these units. */
export const PAGE_WIDTH = 1000;
export const PAGE_HEIGHT = 1414;

/** Squared paper ≈ 5mm on A4. */
export const GRID_SPACING = 24;
export const LINE_SPACING = 36;
export const LINE_TOP_MARGIN = 110;

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;

/** Upper bound on canvas backing-store pixels per page; mobile browsers fail on huge canvases. */
export const MAX_CANVAS_PIXELS = 14_000_000;

export const ERASER_RADIUS = 10;

export const PEN_COLORS = ['#1d1d1f', '#1f4fd1', '#d0312d', '#178a4a', '#8a3ffc'];
export const HIGHLIGHTER_COLORS = ['#ffe14d', '#7ef0a0', '#7fd3ff', '#ff9ccf'];
export const PEN_SIZES = [2, 3.5, 6];
export const HIGHLIGHTER_SIZES = [14, 22, 32];
