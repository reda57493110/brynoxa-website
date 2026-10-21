/**
 * A sign-in token issued before the last password change is no longer valid, so changing the
 * password signs out every other device right away (not only when its token expires).
 * `iat` is in seconds; one second of tolerance for a token issued in the same second.
 */
export function issuedBeforePasswordChange(payload: { iat?: number }, user: { passwordChangedAt?: Date | null }) {
  if (!user.passwordChangedAt || typeof payload.iat !== 'number') return false;
  return payload.iat * 1000 + 1000 < new Date(user.passwordChangedAt).getTime();
}
