import type { FastifyPluginAsync } from 'fastify';
import { pages } from '../repositories.js';
import { idParams, savePageBody } from '../schemas.js';

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

  app.delete<IdParams>('/pages/:id', { schema: { params: idParams } }, async (req, reply) => {
    const result = await pages.remove(req.params.id);
    if (result === 'not_found') return reply.code(404).send({ error: 'Page not found' });
    if (result === 'last_page') return reply.code(409).send({ error: 'A notebook needs at least one page' });
    return reply.code(204).send();
  });
};
