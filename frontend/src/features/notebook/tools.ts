import { HIGHLIGHTER_COLORS, HIGHLIGHTER_SIZES, PEN_COLORS, PEN_SIZES } from './ink/constants';

export type ToolKind = 'pen' | 'line' | 'highlighter' | 'eraser' | 'lasso';

export interface ToolSettings {
  tool: ToolKind;
  color: string;
  size: number;
}

export interface ToolPresets {
  pen: { color: string; size: number };
  highlighter: { color: string; size: number };
}

export const DEFAULT_PRESETS: ToolPresets = {
  pen: { color: PEN_COLORS[0], size: PEN_SIZES[1] },
  highlighter: { color: HIGHLIGHTER_COLORS[0], size: HIGHLIGHTER_SIZES[1] },
};

const STORAGE_KEY = 'mathnotes.tools';

export function loadPresets(): ToolPresets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PRESETS, ...JSON.parse(raw) } : DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}

export function savePresets(presets: ToolPresets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* storage unavailable — presets just won't persist */
  }
}
