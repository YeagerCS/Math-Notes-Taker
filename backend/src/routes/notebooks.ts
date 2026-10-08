import type { FastifyPluginAsync } from 'fastify';
import { notebooks, pages, type NotebookInput, type PageBackgroundInput } from '../repositories.js';
import {
  BACKGROUND_MIME_TYPES,
  createNotebookBody,
  createPageQuery,
  idParams,
  updateNotebookBody,
} from '../schemas.js';

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

  // Page backgrounds are uploaded as the raw image body.
  app.addContentTypeParser(BACKGROUND_MIME_TYPES, { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  /**
   * Adds a page. `?position=N` inserts it there (default: at the end).
   * With an image body plus `?width=&height=` the page gets that image as its background.
   */
  app.post<IdParams & { Querystring: { position?: number; width?: number; height?: number }; Body?: Buffer }>(
    '/notebooks/:id/pages',
    { schema: { params: idParams, querystring: createPageQuery } },
    async (req, reply) => {
      const { position, width, height } = req.query;
      let background: PageBackgroundInput | undefined;
      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        if (!width || !height) {
          return reply.code(400).send({ error: 'Bad Request', message: 'width and height are required with an image' });
        }
        const mime = (req.headers['content-type'] ?? '').split(';')[0].trim();
        background = { mime, width, height, data: req.body };
      }
      const page = await pages.create(req.params.id, { position, background });
      return page ? reply.code(201).send(page) : reply.code(404).send({ error: 'Notebook not found' });
    },
  );
};
