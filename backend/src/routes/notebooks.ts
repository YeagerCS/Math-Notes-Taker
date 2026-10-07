import type { FastifyPluginAsync } from 'fastify';
import { notebooks, pages, type NotebookInput } from '../repositories.js';
import { createNotebookBody, idParams, updateNotebookBody } from '../schemas.js';

type IdParams = { Params: { id: string } };

export const notebookRoutes: FastifyPluginAsync = async (app) => {
  app.get('/notebooks', () => notebooks.list());

  app.post<{ Body: NotebookInput & { title: string } }>(
    '/notebooks',
    { schema: { body: createNotebookBody } },
    async (req, reply) => reply.code(201).send(await notebooks.create(req.body)),
  );

  app.get<IdParams>('/notebooks/:id', { schema: { params: idParams } }, async (req, reply) => {
    const notebook = await notebooks.get(req.params.id);
    return notebook ?? reply.code(404).send({ error: 'Notebook not found' });
  });

  app.patch<IdParams & { Body: NotebookInput }>(
    '/notebooks/:id',
    { schema: { params: idParams, body: updateNotebookBody } },
    async (req, reply) => {
      const notebook = await notebooks.update(req.params.id, req.body);
      return notebook ?? reply.code(404).send({ error: 'Notebook not found' });
    },
  );

  app.delete<IdParams>('/notebooks/:id', { schema: { params: idParams } }, async (req, reply) => {
    const deleted = await notebooks.remove(req.params.id);
    return reply.code(deleted ? 204 : 404).send();
  });

  app.post<IdParams>('/notebooks/:id/pages', { schema: { params: idParams } }, async (req, reply) => {
    const page = await pages.append(req.params.id);
    return page ? reply.code(201).send(page) : reply.code(404).send({ error: 'Notebook not found' });
  });
};
