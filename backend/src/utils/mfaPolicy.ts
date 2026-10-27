/**
 * 2-step sign-in is required for the owner account only (the owner decided: staff accounts are
 * created and managed by the owner, who also sets their passwords). The owner gets a grace period
 * to set it up; after it, admin pages are refused until they do (the setup page stays open).
 * Other staff and customers are never concerned.
 */

export const MFA_GRACE_DAYS = 7;
/** When the rule started: existing staff get their grace period from this day. */
export const MFA_RULE_START = new Date('2026-10-24T00:00:00Z');
export const MFA_REQUIRED_CODE = 'MFA_REQUIRED';

const DAY = 24 * 60 * 60 * 1000;

type MfaUser = {
  role?: string;
  mfaEnabled?: boolean;
  mfaGraceUntil?: Date | string | null;
};

/** Grace period for someone who becomes staff now. */
export function newMfaGraceUntil(now = Date.now()) {
  return new Date(now + MFA_GRACE_DAYS * DAY);
}

/** Last day staff can work without 2-step (null when not concerned). */
export function mfaSetupDeadline(user: MfaUser): Date | null {
  if (!user || user.role !== 'admin' || user.mfaEnabled) return null;
  if (user.mfaGraceUntil) return new Date(user.mfaGraceUntil);
  return new Date(MFA_RULE_START.getTime() + MFA_GRACE_DAYS * DAY);
}

/** True when a staff account must turn on 2-step before using staff pages again. */
export function mfaSetupOverdue(user: MfaUser, now = Date.now()) {
  const deadline = mfaSetupDeadline(user);
  return Boolean(deadline && now > deadline.getTime());
}

export const MFA_REQUIRED_MESSAGE = 'Turn on 2-step sign-in (Admin → Security) to keep using the admin pages.';
