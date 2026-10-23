/** Cost used for every stored password (models/User.ts). */
export const PASSWORD_HASH_ROUNDS = 12;

/**
 * Checked against when the email has no account (or no password), so the answer takes exactly as
 * long as for a real account and the timing never tells whether an email is registered. Same cost
 * as real passwords; the password behind it was random and thrown away.
 */
export const DUMMY_PASSWORD_HASH = '$2b$12$SegXZle4okVnRIKQcaJebuSbEUrm4xywNUSY/g.5yhZGY7VGYeqX2';

/** Compares a password with a stored hash, or with the dummy one when there is none. */
export async function checkPasswordEvenTime(candidate: string, hash?: string | null): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  const ok = await bcrypt.compare(candidate, hash || DUMMY_PASSWORD_HASH);
  return Boolean(hash) && ok;
}
