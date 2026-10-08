import type { FastifyPluginAsync } from 'fastify';
import { pages } from '../repositories.js';
import { idParams, movePageBody, savePageBody } from '../schemas.js';

type IdParams = { Params: { id: string } };

export const pageRoutes: FastifyPluginAsync = async (app) => {
  app.put<IdParams & { Body: { strokes: unknown[] } }>(
    '/pages/:id',
    { schema: { params: idParams, body: savePageBody } },
    async (req, reply) => {
      const page = await pages.saveStrokes(req.params.id, req.body.strokes);
      return page ?? reply.code(404).send({ error: 'Page not found' });
    },
  );

  /** Reorders: moves the page to the given 0-based position in its notebook. */
  app.patch<IdParams & { Body: { position: number } }>(
    '/pages/:id',
    { schema: { params: idParams, body: movePageBody } },
    async (req, reply) => {
      const page = await pages.move(req.params.id, req.body.position);
      return page ?? reply.code(404).send({ error: 'Page not found' });
    },
  );

  app.get<IdParams>('/pages/:id/background', { schema: { params: idParams } }, async (req, reply) => {
    const background = await pages.getBackground(req.params.id);
    if (!background) return reply.code(404).send({ error: 'No background for this page' });
    // A page's background never changes, so the browser may keep it.
    return reply
      .header('Cache-Control', 'private, max-age=31536000, immutable')
      .type(background.mime)
      .send(background.data);
  });

  app.delete<IdParams>('/pages/:id', { schema: { params: idParams } }, async (req, reply) => {
    const result = await pages.remove(req.params.id);
    if (result === 'not_found') return reply.code(404).send({ error: 'Page not found' });
    if (result === 'last_page') return reply.code(409).send({ error: 'A notebook needs at least one page' });
    return reply.code(204).send();
  });
};
