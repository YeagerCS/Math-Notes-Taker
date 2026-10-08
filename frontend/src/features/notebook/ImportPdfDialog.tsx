import { useEffect, useRef, useState } from 'react';
import type { NewPageBackground, Page } from '../../api/types';
import { primeBackground } from './backgrounds';
import {
  formatPageRanges,
  openPdf,
  parsePageRanges,
  renderPageBackground,
  renderThumbnail,
  type PdfDocument,
} from './pdfImport';

interface Props {
  /** Number of pages currently in the notebook. */
  pageCount: number;
  /** Index of the page the import goes after by default (the one on screen). */
  defaultAfterIndex: number;
  addPage: (options: { position: number; background: NewPageBackground }) => Promise<Page>;
  /** Called after a successful import with the first new page. */
  onImported: (firstPage: Page) => void;
  onClose: () => void;
}

export function ImportPdfDialog({ pageCount, defaultAfterIndex, addPage, onImported, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [thumbnails, setThumbnails] = useState<(string | undefined)[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = useState('');
  /** Insert position in the notebook: 0 = at the beginning, n = after page n. */
  const [insertAfter, setInsertAfter] = useState(defaultAfterIndex + 1);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Render previews one after another; stop if the dialog closes or another file is picked.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const url = await renderThumbnail(doc, n).catch(() => undefined);
        if (cancelled) return;
        setThumbnails((prev) => {
          const next = prev.slice();
          next[n - 1] = url;
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
      void doc.loadingTask.destroy();
    };
  }, [doc]);

  const select = (pages: Iterable<number>) => {
    const next = new Set(pages);
    setSelected(next);
    setRangeText(formatPageRanges([...next]));
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    setDoc(null);
    try {
      const opened = await openPdf(file);
      setFileName(file.name);
      setThumbnails(new Array(opened.numPages).fill(undefined));
      select(Array.from({ length: opened.numPages }, (_, i) => i + 1));
      setDoc(opened);
    } catch (err) {
      const message = (err as Error).message ?? '';
      setError(/password/i.test(message) ? 'This PDF is password-protected.' : "Couldn't read this PDF.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (n: number) => {
    const next = new Set(selected);
    if (!next.delete(n)) next.add(n);
    select(next);
  };

  const runImport = async () => {
    if (!doc || selected.size === 0) return;
    const pages = [...selected].sort((a, b) => a - b);
    setError(null);
    setProgress({ done: 0, total: pages.length });
    let first: Page | null = null;
    try {
      for (const [i, n] of pages.entries()) {
        const background = await renderPageBackground(doc, n);
        const page = await addPage({ position: insertAfter + i, background });
        primeBackground(page.id, background.blob);
        first ??= page;
        setProgress({ done: i + 1, total: pages.length });
      }
      onImported(first!);
    } catch (err) {
      // Pages imported so far stay in the notebook.
      setError(`Import stopped: ${(err as Error).message}`);
      setProgress(null);
      if (first) onImported(first);
    }
  };

  const busy = progress !== null;

  return (
    <dialog
      ref={dialogRef}
      className="dialog import-dialog"
      onClose={onClose}
      onCancel={(e) => busy && e.preventDefault()}
    >
      <div className="import-dialog__body">
        <h2 className="dialog__title">Import PDF</h2>

        <label className={`btn import-dialog__file ${busy ? 'is-disabled' : ''}`}>
          {loading ? 'Opening…' : fileName ? 'Choose another PDF' : 'Choose a PDF'}
          <input
            type="file"
            accept="application/pdf,.pdf"
            hidden
            disabled={busy || loading}
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
        </label>
        {fileName && <span className="import-dialog__filename">{fileName}</span>}

        {doc && (
          <>
            <div className="import-dialog__controls">
              <label className="field import-dialog__range">
                <span className="field__label">Pages to import</span>
                <input
                  className="input"
                  value={rangeText}
                  placeholder="e.g. 1-3, 7"
                  inputMode="text"
                  disabled={busy}
                  onChange={(e) => {
                    setRangeText(e.target.value);
                    setSelected(new Set(parsePageRanges(e.target.value, doc.numPages)));
                  }}
                />
              </label>
              <label className="field">
                <span className="field__label">Insert</span>
                <select
                  className="input"
                  value={insertAfter}
                  disabled={busy}
                  onChange={(e) => setInsertAfter(Number(e.target.value))}
                >
                  <option value={0}>At the beginning</option>
                  {Array.from({ length: pageCount }, (_, i) => (
                    <option key={i} value={i + 1}>
                      After page {i + 1}
                      {i + 1 === pageCount ? ' (end)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="import-dialog__bar">
              <span>
                {selected.size} of {doc.numPages} selected
              </span>
              <span>
                <button
                  className="link-btn"
                  disabled={busy}
                  onClick={() => select(Array.from({ length: doc.numPages }, (_, i) => i + 1))}
                >
                  All
                </button>
                <button className="link-btn" disabled={busy} onClick={() => select([])}>
                  None
                </button>
              </span>
            </div>

            <div className="import-dialog__grid">
              {thumbnails.map((src, i) => (
                <button
                  key={i}
                  className={`pdf-thumb ${selected.has(i + 1) ? 'is-selected' : ''}`}
                  aria-pressed={selected.has(i + 1)}
                  aria-label={`Page ${i + 1}`}
                  disabled={busy}
                  onClick={() => toggle(i + 1)}
                >
                  <span className="pdf-thumb__image">{src && <img src={src} alt="" draggable={false} />}</span>
                  <span className="pdf-thumb__num">{i + 1}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="dialog__actions">
          <button className="btn btn--ghost" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!doc || selected.size === 0 || busy} onClick={() => void runImport()}>
            {busy
              ? `Importing ${progress.done}/${progress.total}…`
              : `Import ${selected.size || ''} ${selected.size === 1 ? 'page' : 'pages'}`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
