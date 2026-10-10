import { getSettings } from '../models/Settings';
import { User, type CustomerType, type IBusinessInfo } from '../models/User';
import { ApiError } from '../utils/ApiError';

export interface CustomerUpdate {
  name?: string;
  phone?: string;
  isActive?: boolean;
  customerType?: CustomerType;
  adminNotes?: string;
  business?: IBusinessInfo;
  billingAddress?: {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  } | null;
  tierId?: string;
  paymentTerms?: string;
}

const TYPE_LABEL: Record<CustomerType, string> = { retail: 'Retail', wholesale: 'Wholesale', business: 'Business / B2B' };

/**
 * Staff edits to a customer, each change logged on the activity timeline.
 * Changing the type never grants wholesale prices by itself — those need an approved wholesale account.
 */
export async function updateCustomer(id: string, input: CustomerUpdate, actorId: string) {
  const user = await User.findOne({ _id: id, role: 'customer' }).select('+adminNotes +activity');
  if (!user) throw new ApiError(404, 'Customer not found');
  const notes: { type: string; note: string }[] = [];

  if (input.name !== undefined && input.name.trim() !== user.name) {
    notes.push({ type: 'profile', note: `Name changed from “${user.name}” to “${input.name.trim()}”` });
    user.name = input.name.trim();
  }
  if (input.phone !== undefined && input.phone.trim() !== (user.phone || '')) {
    notes.push({ type: 'profile', note: 'Phone number updated' });
    user.phone = input.phone.trim() || undefined;
  }
  if (input.isActive !== undefined && input.isActive !== user.isActive) {
    user.isActive = input.isActive;
    if (!input.isActive) user.refreshToken = undefined;
    notes.push({ type: input.isActive ? 'enabled' : 'disabled', note: input.isActive ? 'Account reactivated' : 'Account disabled' });
  }
  if (input.customerType && input.customerType !== user.customerType) {
    notes.push({ type: 'type', note: `Customer type: ${TYPE_LABEL[user.customerType || 'retail']} → ${TYPE_LABEL[input.customerType]}` });
    user.customerType = input.customerType;
    if (input.customerType === 'retail' && user.wholesale?.status === 'approved') {
      user.wholesale.status = 'none';
      user.wholesale.tierId = undefined;
      notes.push({ type: 'wholesale-revoke', note: 'Wholesale access removed (type set to retail)' });
    }
  }
  if (input.adminNotes !== undefined && input.adminNotes.trim() !== (user.adminNotes || '')) {
    user.adminNotes = input.adminNotes.trim();
    notes.push({ type: 'note', note: 'Internal notes updated' });
  }
  if (input.business !== undefined) {
    user.business = { ...(user.business ?? {}), ...input.business };
    notes.push({ type: 'business', note: 'Business details updated' });
  }
  if (input.billingAddress !== undefined) {
    user.billingAddress = input.billingAddress ?? undefined;
    notes.push({ type: 'profile', note: input.billingAddress ? 'Billing address updated' : 'Billing address removed' });
  }
  if (input.tierId !== undefined || input.paymentTerms !== undefined) {
    if (user.wholesale?.status !== 'approved') {
      throw new ApiError(400, 'Approve the wholesale account before assigning a tier or payment terms');
    }
    if (input.tierId !== undefined && input.tierId !== user.wholesale.tierId) {
      const tier = (await getSettings()).wholesaleTiers?.find((t) => t.id === input.tierId);
      if (!tier) throw new ApiError(400, 'Unknown wholesale tier');
      user.wholesale.tierId = tier.id;
      notes.push({ type: 'tier', note: `Pricing tier set to ${tier.name} (−${tier.discountPercent}%)` });
    }
    if (input.paymentTerms !== undefined && input.paymentTerms.trim() !== (user.wholesale.paymentTerms || '')) {
      user.wholesale.paymentTerms = input.paymentTerms.trim() || undefined;
      notes.push({ type: 'terms', note: 'Payment terms updated' });
    }
    user.markModified('wholesale');
  }

  if (!notes.length) return user;
  const at = new Date();
  for (const n of notes) user.activity.push({ ...n, at, by: actorId as never });
  if (user.activity.length > 300) user.activity = user.activity.slice(-300);
  await user.save({ validateBeforeSave: true });
  return user;
}
