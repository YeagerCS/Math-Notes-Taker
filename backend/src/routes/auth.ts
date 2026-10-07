import type { FastifyPluginAsync } from 'fastify';
import { attemptLogin } from '../auth/login.js';
import { config } from '../config.js';

const loginBody = {
  type: 'object',
  required: ['password'],
  additionalProperties: false,
  properties: { password: { type: 'string', minLength: 1, maxLength: 256 } },
} as const;

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { password: string } }>('/auth/login', { schema: { body: loginBody } }, async (req, reply) => {
    const result = await attemptLogin(req.body.password);

    if (result.ok) {
      const token = app.jwt.sign({ sub: 'admin' }, { expiresIn: config.auth.tokenTtl });
      const { exp } = app.jwt.decode<{ exp: number }>(token)!;
      req.log.info('admin login succeeded');
      return { token, expiresAt: new Date(exp * 1000).toISOString() };
    }

    if (result.reason === 'locked') {
      req.log.warn({ lockedUntil: result.lockedUntil }, 'login attempt while locked');
      return reply.code(423).send({
        error: 'Locked',
        message: result.lockedUntil
          ? 'Too many failed attempts. Login is locked for now.'
          : 'Too many failed attempts. Login is locked until unlocked on the server.',
        lockedUntil: result.lockedUntil?.toISOString() ?? null,
      });
    }

    req.log.warn({ attemptsLeft: result.attemptsLeft }, 'admin login failed');
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Wrong password.',
      attemptsLeft: result.attemptsLeft,
    });
  });

  app.get('/auth/me', { onRequest: [app.authenticate] }, async () => ({ user: 'admin' }));
};
