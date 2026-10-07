import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { session } from '../../auth/session';
import type { NotebookSummary } from '../../api/types';
import { MoreIcon, PlusIcon } from '../../components/icons';
import { NotebookCover } from './NotebookCover';
import { NotebookDialog } from './NotebookDialog';
import './dashboard.css';

type DialogState = { mode: 'create' } | { mode: 'edit'; notebook: NotebookSummary } | null;

export function DashboardPage() {
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<NotebookSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    api.listNotebooks().then(setNotebooks, (err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => {
      setMenuFor(null);
      setConfirmDelete(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menuFor]);

  const remove = async (id: string) => {
    await api.deleteNotebook(id);
    setNotebooks((prev) => prev?.filter((n) => n.id !== id) ?? null);
    setMenuFor(null);
  };

  return (
    <div className="library">
      <header className="library__header">
        <div>
          <p className="library__eyebrow">Math Notes</p>
          <h1 className="library__title">Library</h1>
        </div>
        <div className="library__actions">
          <button className="btn btn--ghost" onClick={() => session.clear()}>
            Log out
          </button>
          <button className="btn btn--primary" onClick={() => setDialog({ mode: 'create' })}>
            <PlusIcon size={18} /> New notebook
          </button>
        </div>
      </header>

      {error && (
        <div className="library__notice">
          Couldn't reach the server ({error}). Is the backend running?
        </div>
      )}

      {notebooks && (
        <ul className="shelf">
          <li>
            <button className="shelf__new" onClick={() => setDialog({ mode: 'create' })}>
              <span className="shelf__new-icon">
                <PlusIcon size={28} />
              </span>
              <span>New notebook</span>
            </button>
          </li>

          {notebooks.map((nb) => (
            <li key={nb.id} className="shelf__item">
              <button className="shelf__open" onClick={() => navigate(`/notebooks/${nb.id}`)}>
                <NotebookCover title={nb.title} color={nb.color} />
              </button>
              <div className="shelf__meta">
                <div className="shelf__text">
                  <span className="shelf__name">{nb.title}</span>
                  <span className="shelf__sub">
                    {nb.pageCount} {nb.pageCount === 1 ? 'page' : 'pages'} · {relativeTime(nb.updatedAt)}
                  </span>
                </div>
                <div className="menu" onPointerDown={(e) => e.stopPropagation()}>
                  <button
                    className="icon-btn icon-btn--sm"
                    aria-label="Notebook options"
                    onClick={() => setMenuFor(menuFor === nb.id ? null : nb.id)}
                  >
                    <MoreIcon size={18} />
                  </button>
                  {menuFor === nb.id && (
                    <div className="menu__popover" role="menu">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setMenuFor(null);
                          setDialog({ mode: 'edit', notebook: nb });
                        }}
                      >
                        Edit cover &amp; title
                      </button>
                      {confirmDelete === nb.id ? (
                        <button role="menuitem" className="is-danger" onClick={() => void remove(nb.id)}>
                          Really delete?
                        </button>
                      ) : (
                        <button role="menuitem" className="is-danger" onClick={() => setConfirmDelete(nb.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog?.mode === 'create' && (
        <NotebookDialog
          mode="create"
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const nb = await api.createNotebook(input);
            navigate(`/notebooks/${nb.id}`);
          }}
        />
      )}
      {dialog?.mode === 'edit' && (
        <NotebookDialog
          mode="edit"
          initial={dialog.notebook}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const updated = await api.updateNotebook(dialog.notebook.id, input);
            setNotebooks((prev) => prev?.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)) ?? null);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
