import { User } from '../models/User';
import type { ISettings } from '../models/Settings';

/**
 * Records who changed the shop's payment details (RIB, Cash Plus…) and when, so a change is
 * always visible in the editor. Call before settings.save() when depositMethods or
 * depositInstructions are in the update.
 */
export async function stampPaymentDetailsChange(settings: ISettings, userId?: string) {
  const user = userId ? await User.findById(userId).select('name email').lean<{ name?: string; email?: string }>() : null;
  settings.paymentDetailsChangedAt = new Date();
  settings.paymentDetailsChangedBy = user ? `${user.name || 'Staff'} (${user.email || ''})`.slice(0, 200) : 'Unknown';
}

export function touchesPaymentDetails(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  return b.depositMethods !== undefined || b.depositInstructions !== undefined;
}
