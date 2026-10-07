import type { CSSProperties } from 'react';
import { coverColor } from '../../lib/covers';

interface Props {
  title: string;
  color: string;
  size?: 'md' | 'sm';
}

/** A hardcover notebook: cloth spine, linen texture, elastic band and a paper label. */
export function NotebookCover({ title, color, size = 'md' }: Props) {
  const c = coverColor(color);
  return (
    <div
      className={`cover cover--${size}`}
      style={{ '--cover': c.base, '--cover-deep': c.deep } as CSSProperties}
    >
      <div className="cover__pages" aria-hidden="true" />
      <div className="cover__board">
        <div className="cover__spine" aria-hidden="true" />
        <div className="cover__band" aria-hidden="true" />
        <div className="cover__label">
          <span className="cover__label-title">{title}</span>
        </div>
      </div>
    </div>
  );
}
