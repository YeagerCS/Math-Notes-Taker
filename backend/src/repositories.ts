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
    const pages = await sql`
      SELECT id, position, strokes, updated_at FROM pages
      WHERE notebook_id = ${id} ORDER BY position`;
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

export const pages = {
  /** Appends a blank page at the end of the notebook. */
  append(notebookId: string) {
    return sql.begin(async (tx) => {
      const [nb] = await tx`SELECT id FROM notebooks WHERE id = ${notebookId} FOR UPDATE`;
      if (!nb) return null;
      const [page] = await tx`
        INSERT INTO pages (notebook_id, position)
        SELECT ${notebookId}, coalesce(max(position) + 1, 0) FROM pages WHERE notebook_id = ${notebookId}
        RETURNING id, position, strokes, updated_at`;
      await tx`UPDATE notebooks SET updated_at = now() WHERE id = ${notebookId}`;
      return page;
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
