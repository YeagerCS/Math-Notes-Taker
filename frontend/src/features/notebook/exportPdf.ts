import type { jsPDF } from 'jspdf';
import type { Page, Paper, Stroke } from '../../api/types';
import { backgroundRect, loadBackgroundBlob } from './backgrounds';
import { GRID_SPACING, LINE_SPACING, PAGE_HEIGHT, PAGE_WIDTH } from './ink/constants';
import { HIGHLIGHTER_ALPHA, strokeOutline } from './ink/render';

/** A4 portrait; the page coordinate system (1000 × 1414) has the same aspect ratio. */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MM_PER_UNIT = A4_WIDTH_MM / PAGE_WIDTH;

// Paper colours from ink/paper.ts, flattened onto white (PDF lines are drawn opaque).
const LINE_RGB = [214, 223, 234] as const;
const MARGIN_RGB = [241, 197, 197] as const;
const DOT_RGB = [181, 189, 200] as const;

const mm = (units: number) => units * MM_PER_UNIT;

function drawPaper(doc: jsPDF, paper: Paper) {
  doc.setLineWidth(0.1);
  if (paper === 'grid') {
    doc.setDrawColor(...LINE_RGB);
    const offset = (PAGE_WIDTH % GRID_SPACING) / 2;
    for (let x = offset; x <= PAGE_WIDTH; x += GRID_SPACING) doc.line(mm(x), 0, mm(x), A4_HEIGHT_MM);
    for (let y = offset; y <= PAGE_HEIGHT; y += GRID_SPACING) doc.line(0, mm(y), A4_WIDTH_MM, mm(y));
  } else if (paper === 'lined') {
    doc.setDrawColor(...LINE_RGB);
    for (let y = LINE_SPACING; y <= PAGE_HEIGHT; y += LINE_SPACING) doc.line(0, mm(y), A4_WIDTH_MM, mm(y));
    doc.setDrawColor(...MARGIN_RGB);
    doc.line(mm(90), 0, mm(90), A4_HEIGHT_MM);
  } else if (paper === 'dotted') {
    // Each dot is a zero-length line with a round cap: a few bytes instead of four Bézier curves.
    doc.setDrawColor(...DOT_RGB);
    doc.setLineWidth(mm(3.2));
    doc.setLineCap('round');
    for (let y = GRID_SPACING; y < PAGE_HEIGHT; y += GRID_SPACING) {
      for (let x = GRID_SPACING; x < PAGE_WIDTH; x += GRID_SPACING) doc.line(mm(x), mm(y), mm(x), mm(y));
    }
    doc.setLineCap('butt');
  }
}

/** Fills the stroke's outline as a vector path, using the same curve construction as the canvas. */
function drawStroke(doc: jsPDF, stroke: Stroke) {
  const outline = strokeOutline(stroke);
  if (outline.length < 2) return;
  doc.setFillColor(stroke.color);
  doc.moveTo(mm(outline[0][0]), mm(outline[0][1]));
  let [px, py] = outline[0];
  for (let i = 1; i < outline.length; i++) {
    // Quadratic segment (control = previous outline point, end = midpoint) as a cubic Bézier.
    const [cx, cy] = outline[i - 1];
    const ex = (cx + outline[i][0]) / 2;
    const ey = (cy + outline[i][1]) / 2;
    doc.curveTo(
      mm(px + (2 / 3) * (cx - px)),
      mm(py + (2 / 3) * (cy - py)),
      mm(ex + (2 / 3) * (cx - ex)),
      mm(ey + (2 / 3) * (cy - ey)),
      mm(ex),
      mm(ey),
    );
    px = ex;
    py = ey;
  }
  doc.close();
  doc.fill();
}

export interface PdfSource {
  title: string;
  paper: Paper;
  pages: Pick<Page, 'id' | 'strokes' | 'background'>[];
}

const IMAGE_FORMATS: Record<string, string> = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WEBP' };

/** Places an imported PDF page (stored as an image) where it sits on screen. */
async function drawBackground(doc: jsPDF, page: Pick<Page, 'id' | 'background'>) {
  if (!page.background) return;
  const blob = await loadBackgroundBlob(page.id);
  const rect = backgroundRect(page.background);
  doc.addImage(
    new Uint8Array(await blob.arrayBuffer()),
    IMAGE_FORMATS[blob.type] ?? 'JPEG',
    mm(rect.x),
    mm(rect.y),
    mm(rect.width),
    mm(rect.height),
    page.id, // alias: identical images are embedded once
    'FAST',
  );
}

export interface PdfOptions {
  /** Draw the grid / lines / dots under the ink (default true). */
  includePaper?: boolean;
}

/** Builds a vector PDF with one A4 page per notebook page. jsPDF is loaded on demand. */
export async function buildNotebookPdf(source: PdfSource, { includePaper = true }: PdfOptions = {}): Promise<jsPDF> {
  const { jsPDF, GState } = await import('jspdf');
  // 3 decimals of a millimetre is far below print resolution and keeps files small (default is 16 digits).
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true, precision: 3, floatPrecision: 3 });
  doc.setProperties({ title: source.title, creator: 'Math Notes' });
  const opaque = new GState({ opacity: 1 });
  const translucent = new GState({ opacity: HIGHLIGHTER_ALPHA });

  // Skip blank pages at the end (a spare page is usually waiting there); blank pages in between stay.
  let pageCount = source.pages.length;
  const isBlank = (p: PdfSource['pages'][number]) => p.strokes.length === 0 && !p.background;
  while (pageCount > 1 && isBlank(source.pages[pageCount - 1])) pageCount--;

  for (const [index, page] of source.pages.slice(0, pageCount).entries()) {
    if (index > 0) doc.addPage('a4', 'portrait');
    if (includePaper) drawPaper(doc, source.paper);
    await drawBackground(doc, page);

    // Highlighters first so pen ink stays crisp on top, like on screen.
    const highlights = page.strokes.filter((s) => s.tool === 'highlighter');
    if (highlights.length > 0) {
      doc.setGState(translucent);
      highlights.forEach((s) => drawStroke(doc, s));
      doc.setGState(opaque);
    }
    page.strokes.filter((s) => s.tool !== 'highlighter').forEach((s) => drawStroke(doc, s));
  }

  return doc;
}

const safeFileName = (title: string) =>
  (title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim() || 'notebook') + '.pdf';

/** Builds the PDF and hands it to the browser as a download. */
export async function downloadNotebookPdf(source: PdfSource, options?: PdfOptions): Promise<void> {
  const doc = await buildNotebookPdf(source, options);
  await doc.save(safeFileName(source.title), { returnPromise: true });
}
