import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { NewPageBackground } from '../../api/types';

/** Width (px) imported pages are rasterised at: ~220 dpi on A4, sharp at normal zoom. */
const IMPORT_WIDTH = 1800;
const IMPORT_MAX_HEIGHT = 2700;
const IMPORT_JPEG_QUALITY = 0.9;
const THUMBNAIL_WIDTH = 240;

export type PdfDocument = PDFDocumentProxy;

/** Opens a PDF with pdf.js, which is downloaded only when this is first called. */
export async function openPdf(file: File): Promise<PdfDocument> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}

async function renderToCanvas(doc: PdfDocument, pageNumber: number, width: number, maxHeight = Infinity) {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(width / base.width, maxHeight / base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return canvas;
}

/** Small preview of one PDF page (1-based) as a data URL. */
export async function renderThumbnail(doc: PdfDocument, pageNumber: number): Promise<string> {
  const canvas = await renderToCanvas(doc, pageNumber, THUMBNAIL_WIDTH);
  return canvas.toDataURL('image/jpeg', 0.7);
}

/** Rasterises one PDF page (1-based) into the image stored as a notebook page's background. */
export async function renderPageBackground(doc: PdfDocument, pageNumber: number): Promise<NewPageBackground> {
  const canvas = await renderToCanvas(doc, pageNumber, IMPORT_WIDTH, IMPORT_MAX_HEIGHT);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode page'))), 'image/jpeg', IMPORT_JPEG_QUALITY),
  );
  return { blob, width: canvas.width, height: canvas.height };
}

/** Parses "1-3, 7, 10-12" into sorted, de-duplicated page numbers within 1..max. */
export function parsePageRanges(text: string, max: number): number[] {
  const pages = new Set<number>();
  for (const part of text.split(/[,;\s]+/)) {
    const match = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part.trim());
    if (!match) continue;
    const from = Number(match[1]);
    const to = Number(match[2] ?? match[1]);
    for (let n = Math.min(from, to); n <= Math.max(from, to) && n <= max; n++) if (n >= 1) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}

/** Inverse of parsePageRanges, e.g. [1, 2, 3, 7] → "1-3, 7". */
export function formatPageRanges(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j;
  }
  return parts.join(', ');
}
