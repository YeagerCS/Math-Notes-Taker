import { config } from '../config.js';
import { sql } from '../db.js';
import { verifyPassword } from './password.js';

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; lockedUntil: Date | null };

const { maxAttempts, lockMinutes, passwordHash } = config.auth;

function lockExpiry(lockedAt: Date): Date | null {
  return lockMinutes > 0 ? new Date(lockedAt.getTime() + lockMinutes * 60_000) : null;
}

/**
 * Checks the admin password against the persistent lockout state.
 * The auth_state row is locked for the whole check, so concurrent guesses are serialized
 * and can't race past the attempt limit. While locked, even the correct password is rejected.
 */
export function attemptLogin(password: string): Promise<LoginResult> {
  return sql.begin(async (tx) => {
    const [state] = await tx`SELECT failed_attempts, locked_at FROM auth_state WHERE id = 1 FOR UPDATE`;
    let failed: number = state.failedAttempts;

    if (state.lockedAt) {
      const until = lockExpiry(state.lockedAt);
      if (!until || until > new Date()) return { ok: false, reason: 'locked', lockedUntil: until };
      failed = 0; // lock expired: fresh set of attempts
    }

    if (await verifyPassword(password, passwordHash)) {
      await tx`UPDATE auth_state SET failed_attempts = 0, locked_at = NULL WHERE id = 1`;
      return { ok: true };
    }

    failed += 1;
    if (failed >= maxAttempts) {
      const [row] = await tx`
        UPDATE auth_state SET failed_attempts = ${failed}, locked_at = now() WHERE id = 1 RETURNING locked_at`;
      return { ok: false, reason: 'locked', lockedUntil: lockExpiry(row.lockedAt) };
    }
    await tx`UPDATE auth_state SET failed_attempts = ${failed}, locked_at = NULL WHERE id = 1`;
    return { ok: false, reason: 'invalid', attemptsLeft: maxAttempts - failed };
  });
}
