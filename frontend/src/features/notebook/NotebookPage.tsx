import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  toolRef.current = tool === 'eraser' ? { tool, ...presets.pen } : { tool, ...presets[tool] };

  const changePreset = useCallback((which: 'pen' | 'highlighter', patch: Partial<ToolPresets['pen']>) => {
    setPresets((prev) => {
      const next = { ...prev, [which]: { ...prev[which], ...patch } };
      savePresets(next);
      return next;
    });
  }, []);

  const { undo, redo, addPage, deletePage } = editor;

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
      />
      <NotebookViewport
        ref={viewport}
        pages={editor.pages}
        paper={editor.notebook.paper}
        toolRef={toolRef}
        onZoomChange={setZoom}
        onCommit={editor.commitStrokes}
        onAddPage={onAddPage}
        onDeletePage={onDeletePage}
      />
      {showPenDebug && <PenDebug />}
    </div>
  );
}
