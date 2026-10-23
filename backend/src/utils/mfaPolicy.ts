/**
 * 2-step sign-in is required for every staff account. New staff (and staff who had none when this
 * rule started) get a grace period to set it up; after it, staff pages are refused until they do
 * (setting up 2-step itself stays open). Customers are never concerned.
 */
import { isStaffRole } from '../permissions';

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
  if (!user || !isStaffRole(user.role ?? '') || user.mfaEnabled) return null;
  if (user.mfaGraceUntil) return new Date(user.mfaGraceUntil);
  return new Date(MFA_RULE_START.getTime() + MFA_GRACE_DAYS * DAY);
}

/** True when a staff account must turn on 2-step before using staff pages again. */
export function mfaSetupOverdue(user: MfaUser, now = Date.now()) {
  const deadline = mfaSetupDeadline(user);
  return Boolean(deadline && now > deadline.getTime());
}

export const MFA_REQUIRED_MESSAGE = 'Turn on 2-step sign-in (Admin → Security) to keep using staff pages.';
