function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  auth: {
    /** scrypt hash of the admin password — generate with `npm run hash-password`. */
    passwordHash: required('ADMIN_PASSWORD_HASH'),
    jwtSecret,
    tokenTtl: '14d',
    maxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
    /** How long the login stays locked after too many failures; 0 = until unlocked manually. */
    lockMinutes: Number(process.env.LOGIN_LOCK_MINUTES ?? 15),
  },
};
