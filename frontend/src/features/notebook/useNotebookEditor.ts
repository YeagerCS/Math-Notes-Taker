import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { Notebook, Page, Stroke } from '../../api/types';

export type SaveStatus = 'saved' | 'saving' | 'error';

interface HistoryEntry {
  pageId: string;
  before: Stroke[];
  after: Stroke[];
}

const SAVE_DEBOUNCE_MS = 700;
const RETRY_MS = 3000;
const HISTORY_LIMIT = 200;

/**
 * Owns a notebook's pages, undo/redo history and debounced autosave.
 * Stroke arrays are treated as immutable, so history snapshots are cheap.
 */
export function useNotebookEditor(notebookId: string) {
  const [notebook, setNotebook] = useState<Omit<Notebook, 'pages'> | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const dirty = useRef(new Set<string>());
  const saveTimer = useRef<number | undefined>(undefined);
  const flushing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getNotebook(notebookId)
      .then(({ pages, ...meta }) => {
        if (cancelled) return;
        setNotebook(meta);
        setPages(pages);
      })
      .catch((err: Error) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    if (flushing.current) return;
    flushing.current = true;
    setSaveStatus('saving');
    try {
      while (dirty.current.size > 0) {
        const [pageId] = dirty.current;
        dirty.current.delete(pageId);
        const page = pagesRef.current.find((p) => p.id === pageId);
        if (!page) continue;
        try {
          await api.savePage(pageId, page.strokes);
        } catch {
          dirty.current.add(pageId);
          setSaveStatus('error');
          saveTimer.current = window.setTimeout(() => void flush(), RETRY_MS);
          return;
        }
      }
      setSaveStatus('saved');
    } finally {
      flushing.current = false;
    }
  }, []);

  const markDirty = useCallback(
    (pageId: string) => {
      dirty.current.add(pageId);
      setSaveStatus('saving');
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  // Warn before leaving with unsaved ink; flush when the tab is hidden.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current.size > 0 || flushing.current) e.preventDefault();
    };
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, [flush]);

  const replaceStrokes = useCallback(
    (pageId: string, strokes: Stroke[]) => {
      const next = pagesRef.current.map((p) => (p.id === pageId ? { ...p, strokes } : p));
      pagesRef.current = next;
      setPages(next);
      markDirty(pageId);
    },
    [markDirty],
  );

  const syncHistoryState = () =>
    setHistoryState({ canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 });

  /** Records a user edit of one page. */
  const commitStrokes = useCallback(
    (pageId: string, strokes: Stroke[]) => {
      const before = pagesRef.current.find((p) => p.id === pageId)?.strokes ?? [];
      undoStack.current.push({ pageId, before, after: strokes });
      if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
      redoStack.current = [];
      syncHistoryState();
      replaceStrokes(pageId, strokes);
    },
    [replaceStrokes],
  );

  const travel = useCallback(
    (from: typeof undoStack, to: typeof undoStack, pick: 'before' | 'after') => {
      // Skip entries whose page was deleted meanwhile.
      let entry: HistoryEntry | undefined;
      while ((entry = from.current.pop())) {
        if (pagesRef.current.some((p) => p.id === entry!.pageId)) break;
      }
      if (!entry) return syncHistoryState();
      to.current.push(entry);
      syncHistoryState();
      replaceStrokes(entry.pageId, entry[pick]);
    },
    [replaceStrokes],
  );

  const undo = useCallback(() => travel(undoStack, redoStack, 'before'), [travel]);
  const redo = useCallback(() => travel(redoStack, undoStack, 'after'), [travel]);

  const addPage = useCallback(async () => {
    const page = await api.addPage(notebookId);
    setPages((prev) => [...prev, page]);
    return page;
  }, [notebookId]);

  const deletePage = useCallback(async (pageId: string) => {
    await api.deletePage(pageId);
    dirty.current.delete(pageId);
    setPages((prev) =>
      prev.filter((p) => p.id !== pageId).map((p, i) => ({ ...p, position: i })),
    );
  }, []);

  return {
    notebook,
    pages,
    loadError,
    saveStatus,
    ...historyState,
    commitStrokes,
    undo,
    redo,
    addPage,
    deletePage,
  };
}
