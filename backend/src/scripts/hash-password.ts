// Prints an ADMIN_PASSWORD_HASH for the given password, or generates a strong password if none is given.
//   npm run hash-password -- 'my password'
//   docker exec mathnotes-api node dist/scripts/hash-password.js 'my password'
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../auth/password.js';

const given = process.argv[2];
const password = given ?? randomBytes(18).toString('base64url');

if (!given) console.log(`Generated password: ${password}`);
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
