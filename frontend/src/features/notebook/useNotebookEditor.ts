import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { Notebook, Page, Stroke } from '../../api/types';

export type SaveStatus = 'saved' | 'saving' | 'error';

/** One undo step: the before/after strokes of every page it touched. */
type HistoryEntry = { pageId: string; before: Stroke[]; after: Stroke[] }[];

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

  /** Replaces the strokes of one or more pages (no history entry). */
  const applyStrokes = useCallback(
    (changes: { pageId: string; strokes: Stroke[] }[]) => {
      const byId = new Map(changes.map((c) => [c.pageId, c.strokes]));
      const next = pagesRef.current.map((p) => (byId.has(p.id) ? { ...p, strokes: byId.get(p.id)! } : p));
      pagesRef.current = next;
      setPages(next);
      changes.forEach((c) => markDirty(c.pageId));
    },
    [markDirty],
  );

  const syncHistoryState = () =>
    setHistoryState({ canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 });

  /** Records a user edit as one undo step; it may span several pages (e.g. moving ink to another page). */
  const commitChanges = useCallback(
    (changes: { pageId: string; strokes: Stroke[] }[]) => {
      undoStack.current.push(
        changes.map((c) => ({
          pageId: c.pageId,
          before: pagesRef.current.find((p) => p.id === c.pageId)?.strokes ?? [],
          after: c.strokes,
        })),
      );
      if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
      redoStack.current = [];
      syncHistoryState();
      applyStrokes(changes);
    },
    [applyStrokes],
  );

  const commitStrokes = useCallback(
    (pageId: string, strokes: Stroke[]) => commitChanges([{ pageId, strokes }]),
    [commitChanges],
  );

  const travel = useCallback(
    (from: typeof undoStack, to: typeof undoStack, pick: 'before' | 'after') => {
      // Skip entries that only touch pages deleted meanwhile.
      const exists = (pageId: string) => pagesRef.current.some((p) => p.id === pageId);
      let entry: HistoryEntry | undefined;
      while ((entry = from.current.pop())) {
        if (entry.some((c) => exists(c.pageId))) break;
      }
      if (!entry) return syncHistoryState();
      to.current.push(entry);
      syncHistoryState();
      applyStrokes(entry.filter((c) => exists(c.pageId)).map((c) => ({ pageId: c.pageId, strokes: c[pick] })));
    },
    [applyStrokes],
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
    commitChanges,
    undo,
    redo,
    addPage,
    deletePage,
  };
}
