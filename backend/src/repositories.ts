import { sql } from './db.js';
import type { Paper } from './schemas.js';

export interface NotebookInput {
  title?: string;
  color?: string;
  paper?: Paper;
}

export const notebooks = {
  list() {
    return sql`
      SELECT n.*, (SELECT count(*)::int FROM pages p WHERE p.notebook_id = n.id) AS page_count
      FROM notebooks n
      ORDER BY n.updated_at DESC`;
  },

  async get(id: string) {
    const [notebook] = await sql`SELECT * FROM notebooks WHERE id = ${id}`;
    if (!notebook) return null;
    // Backgrounds are only described here (size); the image itself is fetched per page.
    const pages = await sql`
      SELECT p.id, p.position, p.strokes, p.updated_at,
             CASE WHEN b.page_id IS NULL THEN NULL
                  ELSE json_build_object('width', b.width, 'height', b.height) END AS background
      FROM pages p
      LEFT JOIN page_backgrounds b ON b.page_id = p.id
      WHERE p.notebook_id = ${id} ORDER BY p.position`;
    return { ...notebook, pages };
  },

  /** Creates a notebook with one blank first page. */
  create(input: NotebookInput & { title: string }) {
    return sql.begin(async (tx) => {
      const [notebook] = await tx`
        INSERT INTO notebooks ${tx(stripUndefined(input))}
        RETURNING *`;
      await tx`INSERT INTO pages (notebook_id, position) VALUES (${notebook.id}, 0)`;
      return { ...notebook, pageCount: 1 };
    });
  },

  async update(id: string, input: NotebookInput) {
    const [notebook] = await sql`
      UPDATE notebooks SET ${sql(stripUndefined(input))}, updated_at = now()
      WHERE id = ${id} RETURNING *`;
    return notebook ?? null;
  },

  async remove(id: string) {
    const result = await sql`DELETE FROM notebooks WHERE id = ${id}`;
    return result.count > 0;
  },
};

export interface PageBackgroundInput {
  mime: string;
  width: number;
  height: number;
  data: Buffer;
}

export const pages = {
  /**
   * Adds a page to the notebook: at `position` (later pages shift down) or at the end when omitted.
   * Optionally with a background image (an imported PDF page).
   */
  create(notebookId: string, options: { position?: number; background?: PageBackgroundInput } = {}) {
    return sql.begin(async (tx) => {
      const [nb] = await tx`SELECT id FROM notebooks WHERE id = ${notebookId} FOR UPDATE`;
      if (!nb) return null;
      const [{ count }] = await tx`SELECT count(*)::int AS count FROM pages WHERE notebook_id = ${notebookId}`;
      const position = Math.min(options.position ?? count, count);
      // The (notebook_id, position) unique constraint is deferred, so shifting in one statement is fine.
      await tx`UPDATE pages SET position = position + 1 WHERE notebook_id = ${notebookId} AND position >= ${position}`;
      const [page] = await tx`
        INSERT INTO pages (notebook_id, position) VALUES (${notebookId}, ${position})
        RETURNING id, position, strokes, updated_at`;

      const bg = options.background;
      if (bg) {
        await tx`
          INSERT INTO page_backgrounds (page_id, mime, width, height, data)
          VALUES (${page.id}, ${bg.mime}, ${bg.width}, ${bg.height}, ${bg.data})`;
      }
      await tx`UPDATE notebooks SET updated_at = now() WHERE id = ${notebookId}`;
      return { ...page, background: bg ? { width: bg.width, height: bg.height } : null };
    });
  },

  async getBackground(pageId: string) {
    const [bg] = await sql`SELECT mime, data FROM page_backgrounds WHERE page_id = ${pageId}`;
    return (bg as { mime: string; data: Buffer } | undefined) ?? null;
  },

  /** Moves a page to `position` within its notebook; the pages in between shift by one. */
  move(id: string, position: number) {
    return sql.begin(async (tx) => {
      const [page] = await tx`SELECT notebook_id, position FROM pages WHERE id = ${id} FOR UPDATE`;
      if (!page) return null;
      const [{ count }] = await tx`SELECT count(*)::int AS count FROM pages WHERE notebook_id = ${page.notebookId}`;
      const from: number = page.position;
      const to = Math.min(position, count - 1);
      if (to !== from) {
        // The (notebook_id, position) unique constraint is deferred, so this is checked at commit.
        if (to > from) {
          await tx`
            UPDATE pages SET position = position - 1
            WHERE notebook_id = ${page.notebookId} AND position > ${from} AND position <= ${to}`;
        } else {
          await tx`
            UPDATE pages SET position = position + 1
            WHERE notebook_id = ${page.notebookId} AND position >= ${to} AND position < ${from}`;
        }
        await tx`UPDATE pages SET position = ${to} WHERE id = ${id}`;
        await tx`UPDATE notebooks SET updated_at = now() WHERE id = ${page.notebookId}`;
      }
      return { id, position: to };
    });
  },

  saveStrokes(id: string, strokes: unknown[]) {
    return sql.begin(async (tx) => {
      const [page] = await tx`
        UPDATE pages SET strokes = ${tx.json(strokes as never)}, updated_at = now()
        WHERE id = ${id} RETURNING id, notebook_id, updated_at`;
      if (!page) return null;
      await tx`UPDATE notebooks SET updated_at = now() WHERE id = ${page.notebookId}`;
      return { id: page.id, updatedAt: page.updatedAt };
    });
  },

  /** Deletes a page and closes the position gap. Refuses to delete a notebook's only page. */
  remove(id: string) {
    return sql.begin(async (tx) => {
      const [page] = await tx`SELECT notebook_id, position FROM pages WHERE id = ${id} FOR UPDATE`;
      if (!page) return 'not_found' as const;
      const [{ count }] = await tx`SELECT count(*)::int AS count FROM pages WHERE notebook_id = ${page.notebookId}`;
      if (count <= 1) return 'last_page' as const;
      await tx`DELETE FROM pages WHERE id = ${id}`;
      await tx`
        UPDATE pages SET position = position - 1
        WHERE notebook_id = ${page.notebookId} AND position > ${page.position}`;
      await tx`UPDATE notebooks SET updated_at = now() WHERE id = ${page.notebookId}`;
      return 'deleted' as const;
    });
  },
};

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
