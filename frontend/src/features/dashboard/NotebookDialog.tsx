import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { NotebookInput, Paper } from '../../api/types';
import { COVER_COLORS, PAPER_OPTIONS } from '../../lib/covers';
import { paperStyle } from '../notebook/ink/paper';
import { NotebookCover } from './NotebookCover';

interface Props {
  mode: 'create' | 'edit';
  initial?: NotebookInput;
  onSubmit: (input: NotebookInput) => Promise<void>;
  onClose: () => void;
}

export function NotebookDialog({ mode, initial, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [color, setColor] = useState(initial?.color ?? COVER_COLORS[0].id);
  const [paper, setPaper] = useState<Paper>(initial?.paper ?? 'grid');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), color, paper });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
    >
      <form className="dialog__body" onSubmit={submit}>
        <div className="dialog__preview">
          <NotebookCover title={title || 'Untitled'} color={color} />
        </div>

        <div className="dialog__fields">
          <h2 className="dialog__title">{mode === 'create' ? 'New notebook' : 'Notebook settings'}</h2>

          <label className="field">
            <span className="field__label">Title</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Linear Algebra II"
              maxLength={120}
              autoFocus
              required
            />
          </label>

          <div className="field">
            <span className="field__label">Cover</span>
            <div className="color-picker">
              {COVER_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`color-dot ${color === c.id ? 'is-active' : ''}`}
                  style={{ background: c.base }}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => setColor(c.id)}
                />
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__label">Paper</span>
            <div className="paper-picker">
              {PAPER_OPTIONS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`paper-option ${paper === p.id ? 'is-active' : ''}`}
                  onClick={() => setPaper(p.id)}
                >
                  <span className="paper-option__sheet" style={paperStyle(p.id, 0.16)} />
                  <span className="paper-option__label">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy || !title.trim()}>
              {mode === 'create' ? 'Create notebook' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
