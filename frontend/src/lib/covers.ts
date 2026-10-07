import type { Paper } from '../api/types';

export interface CoverColor {
  id: string;
  label: string;
  base: string;
  deep: string;
}

export const COVER_COLORS: CoverColor[] = [
  { id: 'navy', label: 'Navy', base: '#27395c', deep: '#18243b' },
  { id: 'forest', label: 'Forest', base: '#2f5a46', deep: '#1d3a2d' },
  { id: 'oxblood', label: 'Oxblood', base: '#7a2e35', deep: '#511c22' },
  { id: 'ochre', label: 'Ochre', base: '#c48a2c', deep: '#8c5f19' },
  { id: 'terracotta', label: 'Terracotta', base: '#b65a3c', deep: '#7f3a24' },
  { id: 'slate', label: 'Slate', base: '#4c5560', deep: '#30363e' },
  { id: 'sage', label: 'Sage', base: '#8a9a7b', deep: '#5f6d52' },
  { id: 'plum', label: 'Plum', base: '#5b3a5e', deep: '#3b243d' },
];

export function coverColor(id: string): CoverColor {
  return COVER_COLORS.find((c) => c.id === id) ?? COVER_COLORS[0];
}

export const PAPER_OPTIONS: { id: Paper; label: string }[] = [
  { id: 'grid', label: 'Squared' },
  { id: 'lined', label: 'Lined' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'blank', label: 'Blank' },
];
