// Stores the admin JWT. localStorage is fine for a single-user app; the token expires after 14 days.

const KEY = 'mathnotes.session';

interface Session {
  token: string;
  expiresAt: string;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    const session = raw ? (JSON.parse(raw) as Session) : null;
    if (session && new Date(session.expiresAt).getTime() > Date.now()) return session;
  } catch {
    /* storage unavailable or corrupt */
  }
  return null;
}

let current = read();

export const session = {
  token: () => (current && new Date(current.expiresAt).getTime() > Date.now() ? current.token : null),

  set(next: Session) {
    current = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* keeps working in memory */
    }
    listeners.forEach((l) => l());
  },

  clear() {
    current = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
