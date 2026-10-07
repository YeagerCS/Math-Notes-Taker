import { Link } from 'react-router-dom';
import { FullscreenButton } from '../../components/FullscreenButton';
import {
  BackIcon,
  CloudAlertIcon,
  CloudCheckIcon,
  EraserIcon,
  HighlighterIcon,
  MinusIcon,
  PenIcon,
  PlusIcon,
  RedoIcon,
  UndoIcon,
} from '../../components/icons';
import { HIGHLIGHTER_COLORS, HIGHLIGHTER_SIZES, PEN_COLORS, PEN_SIZES } from './ink/constants';
import type { ToolKind, ToolPresets } from './tools';
import type { SaveStatus } from './useNotebookEditor';

interface Props {
  title: string;
  tool: ToolKind;
  presets: ToolPresets;
  zoom: number;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: ToolKind) => void;
  onPresetChange: (tool: 'pen' | 'highlighter', patch: Partial<ToolPresets['pen']>) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomBy: (factor: number) => void;
  onZoomReset: () => void;
}

const TOOLS = [
  { id: 'pen', label: 'Pen', Icon: PenIcon },
  { id: 'highlighter', label: 'Highlighter', Icon: HighlighterIcon },
  { id: 'eraser', label: 'Eraser (or hold the S Pen button)', Icon: EraserIcon },
] as const;

export function Toolbar(props: Props) {
  const { tool, presets } = props;
  const inkTool = tool === 'eraser' ? null : tool;
  const colors = inkTool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS;
  const sizes = inkTool === 'highlighter' ? HIGHLIGHTER_SIZES : PEN_SIZES;
  const active = inkTool ? presets[inkTool] : null;

  return (
    <header className="toolbar">
      <div className="toolbar__group toolbar__group--start">
        <Link to="/" className="icon-btn" aria-label="Back to library">
          <BackIcon />
        </Link>
        <h1 className="toolbar__title" title={props.title}>
          {props.title}
        </h1>
      </div>

      <div className="toolbar__group toolbar__tools">
        <div className="segmented">
          {TOOLS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`icon-btn ${tool === id ? 'is-active' : ''}`}
              aria-label={label}
              title={label}
              aria-pressed={tool === id}
              onClick={() => props.onToolChange(id)}
            >
              <Icon />
            </button>
          ))}
        </div>

        {inkTool && active && (
          <>
            <span className="toolbar__divider" />
            <div className="swatches">
              {colors.map((c) => (
                <button
                  key={c}
                  className={`swatch ${active.color === c ? 'is-active' : ''}`}
                  style={{ '--swatch': c } as React.CSSProperties}
                  aria-label={`Color ${c}`}
                  onClick={() => props.onPresetChange(inkTool, { color: c })}
                />
              ))}
            </div>
            <span className="toolbar__divider" />
            <div className="sizes">
              {sizes.map((s, i) => (
                <button
                  key={s}
                  className={`size-btn ${active.size === s ? 'is-active' : ''}`}
                  aria-label={`Size ${i + 1}`}
                  onClick={() => props.onPresetChange(inkTool, { size: s })}
                >
                  <span
                    className="size-btn__dot"
                    style={{
                      width: 4 + i * 4,
                      height: 4 + i * 4,
                      background: inkTool === 'highlighter' ? active.color : 'currentColor',
                    }}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="toolbar__group toolbar__group--end">
        <button className="icon-btn" aria-label="Undo" disabled={!props.canUndo} onClick={props.onUndo}>
          <UndoIcon />
        </button>
        <button className="icon-btn" aria-label="Redo" disabled={!props.canRedo} onClick={props.onRedo}>
          <RedoIcon />
        </button>
        <span className="toolbar__divider" />
        <button className="icon-btn" aria-label="Zoom out" onClick={() => props.onZoomBy(1 / 1.25)}>
          <MinusIcon />
        </button>
        <button className="zoom-label" onClick={props.onZoomReset} title="Reset zoom">
          {Math.round(props.zoom * 100)}%
        </button>
        <button className="icon-btn" aria-label="Zoom in" onClick={() => props.onZoomBy(1.25)}>
          <PlusIcon />
        </button>
        <FullscreenButton className="icon-btn fullscreen-btn" />
        <span className={`save-status save-status--${props.saveStatus}`} title={statusLabel(props.saveStatus)}>
          {props.saveStatus === 'error' ? <CloudAlertIcon size={20} /> : <CloudCheckIcon size={20} />}
        </span>
      </div>
    </header>
  );
}

function statusLabel(status: SaveStatus) {
  if (status === 'saving') return 'Saving…';
  if (status === 'error') return 'Offline — retrying';
  return 'All changes saved';
}
