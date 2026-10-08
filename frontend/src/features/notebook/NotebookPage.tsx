import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ImportPdfDialog } from './ImportPdfDialog';
import { NotebookViewport, type ViewportHandle } from './NotebookViewport';
import { PenDebug } from './PenDebug';
import { Toolbar } from './Toolbar';
import { loadPresets, savePresets, type ToolKind, type ToolPresets, type ToolSettings } from './tools';
import { useNotebookEditor } from './useNotebookEditor';
import './notebook.css';

const showPenDebug = new URLSearchParams(location.search).has('debug');

export function NotebookPage() {
  const { id } = useParams<{ id: string }>();
  const editor = useNotebookEditor(id!);
  const viewport = useRef<ViewportHandle>(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<ToolKind>('pen');
  const [presets, setPresets] = useState<ToolPresets>(loadPresets);

  // Pages read the current tool through a ref so tool changes don't re-render every sheet.
  const toolRef = useRef<ToolSettings>({ tool, ...presets.pen });
  toolRef.current = tool === 'pen' || tool === 'highlighter' ? { tool, ...presets[tool] } : { tool, ...presets.pen };

  const changePreset = useCallback((which: 'pen' | 'highlighter', patch: Partial<ToolPresets['pen']>) => {
    setPresets((prev) => {
      const next = { ...prev, [which]: { ...prev[which], ...patch } };
      savePresets(next);
      return next;
    });
  }, []);

  const { undo, redo, addPage, deletePage, movePage } = editor;

  /** Open import dialog and the page index it should insert after by default. */
  const [importAfter, setImportAfter] = useState<number | null>(null);

  const [exporting, setExporting] = useState(false);
  const exportPdf = async () => {
    if (!editor.notebook || exporting) return;
    setExporting(true);
    try {
      // Loaded on demand so the PDF library isn't part of the initial bundle.
      const { downloadNotebookPdf } = await import('./exportPdf');
      await downloadNotebookPdf({ title: editor.notebook.title, paper: editor.notebook.paper, pages: editor.pages });
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) undo();
      else if (key === 'y' || (key === 'z' && e.shiftKey)) redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const onAddPage = useCallback(() => {
    void addPage();
  }, [addPage]);

  const onDeletePage = useCallback((pageId: string) => void deletePage(pageId), [deletePage]);

  const onMovePage = useCallback(
    (pageId: string, toIndex: number) => {
      void movePage(pageId, toIndex).catch(() => {}); // rolled back in the hook; nothing else to do
      // Follow the page to its new place once the list has re-rendered.
      requestAnimationFrame(() =>
        document.querySelector(`[data-page-id="${pageId}"]`)?.scrollIntoView({ block: 'center' }),
      );
    },
    [movePage],
  );

  if (editor.loadError) {
    return (
      <div className="notebook-state">
        <p>Couldn't open this notebook: {editor.loadError}</p>
        <Link to="/" className="btn">
          Back to library
        </Link>
      </div>
    );
  }

  if (!editor.notebook) return <div className="notebook-state">Opening notebook…</div>;

  return (
    <div className="notebook">
      <Toolbar
        title={editor.notebook.title}
        tool={tool}
        presets={presets}
        zoom={zoom}
        saveStatus={editor.saveStatus}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onToolChange={setTool}
        onPresetChange={changePreset}
        onUndo={undo}
        onRedo={redo}
        onZoomBy={(f) => viewport.current?.zoomBy(f)}
        onZoomReset={() => viewport.current?.resetZoom()}
        exporting={exporting}
        onExport={() => void exportPdf()}
        onImportPdf={() => setImportAfter(viewport.current?.currentPageIndex() ?? editor.pages.length - 1)}
      />
      <NotebookViewport
        ref={viewport}
        pages={editor.pages}
        paper={editor.notebook.paper}
        toolRef={toolRef}
        onZoomChange={setZoom}
        lassoActive={tool === 'lasso'}
        onCommit={editor.commitStrokes}
        onCommitChanges={editor.commitChanges}
        onAddPage={onAddPage}
        onDeletePage={onDeletePage}
        onMovePage={onMovePage}
      />
      {importAfter !== null && (
        <ImportPdfDialog
          pageCount={editor.pages.length}
          defaultAfterIndex={importAfter}
          addPage={addPage}
          onClose={() => setImportAfter(null)}
          onImported={(first) => {
            setImportAfter(null);
            // Jump to the first imported page once it has been laid out.
            requestAnimationFrame(() =>
              document.querySelector(`[data-page-id="${first.id}"]`)?.scrollIntoView({ block: 'start' }),
            );
          }}
        />
      )}
      {showPenDebug && <PenDebug />}
    </div>
  );
}
