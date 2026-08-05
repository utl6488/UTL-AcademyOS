import * as argon2 from 'argon2';

// argon2id with memory/time tuned for interactive login (~50-100ms on modern CPU).
const OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, OPTS);
}

export function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  return argon2.verify(hash, plaintext).catch(() => false);
}

/** True when the stored hash is weaker than current OPTS and should be rehashed. */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, OPTS);
}
