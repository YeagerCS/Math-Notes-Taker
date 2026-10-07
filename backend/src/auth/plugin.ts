import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Registers JWT support and an `authenticate` hook (Bearer token in the Authorization header). */
export const authPlugin = fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: config.auth.jwtSecret,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      await reply.code(401).send({ error: 'Unauthorized', message: 'Please log in.' });
    }
  });
});
