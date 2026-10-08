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

/** Size (px) of a page's background image, e.g. an imported PDF page. */
export interface PageBackground {
  width: number;
  height: number;
}

export interface Page {
  id: string;
  position: number;
  strokes: Stroke[];
  background?: PageBackground | null;
}

/** Background image to attach when creating a page. */
export interface NewPageBackground extends PageBackground {
  blob: Blob;
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
