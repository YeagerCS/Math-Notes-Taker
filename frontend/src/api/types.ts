export type Paper = 'grid' | 'lined' | 'dotted' | 'blank';
export type InkTool = 'pen' | 'highlighter';

export interface Stroke {
  id: string;
  tool: InkTool;
  color: string;
  size: number;
  /** Flat [x0, y0, p0, x1, y1, p1, ...] in page units (see PAGE_WIDTH). */
  points: number[];
}

export interface Page {
  id: string;
  position: number;
  strokes: Stroke[];
}

export interface NotebookSummary {
  id: string;
  title: string;
  color: string;
  paper: Paper;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Notebook extends Omit<NotebookSummary, 'pageCount'> {
  pages: Page[];
}

export interface NotebookInput {
  title: string;
  color: string;
  paper: Paper;
}
