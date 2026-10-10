import { waitUntil } from '@vercel/functions';
import { env } from '../config/env';
import { getSettings } from '../models/Settings';
import { User, type IBusinessInfo } from '../models/User';
import { ApiError } from '../utils/ApiError';
import type { WholesaleTerms } from '../utils/wholesale';
import { sendEmail } from './email.service';
import { button, paragraphs, renderEmail, siteUrl, toPlainText } from './emailTemplate';

/**
 * Wholesale pricing a customer is entitled to right now, or null.
 * Only approved wholesale/business accounts with an existing tier get a discount —
 * choosing a type or applying never grants it.
 */
export async function getWholesaleTerms(userId?: string | null): Promise<WholesaleTerms | null> {
  if (!userId) return null;
  const user = await User.findById(userId).select('customerType wholesale isActive role');
  if (!user || user.role !== 'customer' || !user.isActive) return null;
  if (user.customerType === 'retail' || user.wholesale?.status !== 'approved' || !user.wholesale.tierId) {
    return null;
  }
  const tier = (await getSettings()).wholesaleTiers?.find((t) => t.id === user.wholesale.tierId);
  if (!tier || !(tier.discountPercent > 0)) return null;
  return { tierId: tier.id, tierName: tier.name, discountPercent: tier.discountPercent };
}

/** What the customer's account page shows about wholesale. */
export async function getMyWholesale(userId: string) {
  const user = await User.findById(userId).select('customerType wholesale business');
  if (!user) throw new ApiError(404, 'Account not found');
  const terms = await getWholesaleTerms(userId);
  return {
    customerType: user.customerType,
    status: user.wholesale?.status ?? 'none',
    requestedType: user.wholesale?.requestedType,
    requestedAt: user.wholesale?.requestedAt,
    rejectionReason: user.wholesale?.status === 'rejected' ? user.wholesale.rejectionReason : undefined,
    paymentTerms: user.wholesale?.status === 'approved' ? user.wholesale.paymentTerms : undefined,
    business: user.business,
    terms,
  };
}

/** Customer asks for a wholesale/business account. Stays retail until staff approve. */
export async function applyForWholesale(
  userId: string,
  input: { requestedType: 'wholesale' | 'business'; business: IBusinessInfo; message?: string }
) {
  const user = await User.findById(userId).select('+activity');
  if (!user || user.role !== 'customer' || user.isGuest) throw new ApiError(403, 'Sign in with a customer account to apply');
  if (user.wholesale?.status === 'approved') throw new ApiError(409, 'Your wholesale account is already approved');
  if (user.wholesale?.status === 'pending') throw new ApiError(409, 'Your application is already being reviewed');

  user.business = { ...(user.business ?? {}), ...input.business };
  user.wholesale = {
    ...(user.wholesale ?? { status: 'none' }),
    status: 'pending',
    requestedType: input.requestedType,
    applicationMessage: input.message,
    requestedAt: new Date(),
    rejectionReason: undefined,
  };
  user.activity.push({
    type: 'wholesale-requested',
    note: `Applied for a ${input.requestedType} account (${input.business.companyName})`,
    at: new Date(),
  });
  await user.save();

  if (env.ADMIN_EMAIL) {
    const html = renderEmail({
      heading: 'New wholesale application',
      preheader: `${input.business.companyName} applied for a ${input.requestedType} account`,
      body: [
        paragraphs(
          `${user.name} (${user.email}) applied for a ${input.requestedType} account for ${input.business.companyName}. Review it before granting wholesale prices.`
        ),
        button('Review application', siteUrl(`/admin/customers/${user._id}`)),
      ].join(''),
    });
    waitUntil(
      sendEmail({ to: env.ADMIN_EMAIL, subject: `Wholesale application — ${input.business.companyName}`, html, text: toPlainText(html) })
        .catch((e) => console.error('Wholesale staff email failed', e))
        .then(() => undefined)
    );
  }
  return getMyWholesale(userId);
}

/** Staff decision on a wholesale account. Logged on the customer's activity timeline. */
export async function reviewWholesale(
  customerId: string,
  input: { action: 'approve' | 'reject' | 'revoke'; tierId?: string; paymentTerms?: string; reason?: string; customerType?: 'wholesale' | 'business' },
  actorId: string
) {
  const user = await User.findOne({ _id: customerId, role: 'customer' }).select('+activity');
  if (!user) throw new ApiError(404, 'Customer not found');
  const tiers = (await getSettings()).wholesaleTiers ?? [];
  const now = new Date();
  let note = '';

  if (input.action === 'approve') {
    const tier = tiers.find((t) => t.id === input.tierId);
    if (!tier) throw new ApiError(400, 'Choose a wholesale pricing tier (create tiers in Settings first)');
    const type = input.customerType ?? user.wholesale?.requestedType ?? 'wholesale';
    user.customerType = type;
    user.wholesale = {
      ...(user.wholesale ?? { status: 'none' }),
      status: 'approved',
      tierId: tier.id,
      paymentTerms: input.paymentTerms?.trim() || user.wholesale?.paymentTerms,
      reviewedAt: now,
      reviewedBy: actorId as never,
      rejectionReason: undefined,
    };
    note = `Approved as ${type} — ${tier.name} (−${tier.discountPercent}%)`;
  } else if (input.action === 'reject') {
    if (!input.reason?.trim()) throw new ApiError(400, 'Give a short reason for the customer');
    user.wholesale = {
      ...(user.wholesale ?? { status: 'none' }),
      status: 'rejected',
      rejectionReason: input.reason.trim(),
      reviewedAt: now,
      reviewedBy: actorId as never,
    };
    note = `Wholesale application rejected: ${input.reason.trim()}`;
  } else {
    user.customerType = 'retail';
    user.wholesale = { ...(user.wholesale ?? { status: 'none' }), status: 'none', tierId: undefined, reviewedAt: now, reviewedBy: actorId as never };
    note = 'Wholesale access removed — back to retail prices';
  }

  user.activity.push({ type: `wholesale-${input.action}`, note, at: now, by: actorId as never });
  user.markModified('wholesale');
  await user.save();

  if (input.action !== 'revoke' && user.email) {
    const approved = input.action === 'approve';
    const html = renderEmail({
      heading: approved ? 'Your wholesale account is approved' : 'About your wholesale application',
      preheader: approved ? 'Wholesale prices now apply when you are signed in.' : 'An update on your wholesale application.',
      body: [
        paragraphs(`Hi ${user.name.split(/\s+/)[0]},`),
        paragraphs(
          approved
            ? 'Good news — your Brynoxa wholesale account is approved. Your wholesale prices apply automatically at checkout whenever you are signed in.'
            : `Thank you for your interest in a Brynoxa wholesale account. We are not able to approve it at this time.\n\nReason: ${input.reason?.trim()}\n\nYou can keep ordering at our regular prices, and contact us on WhatsApp if you have questions.`
        ),
        button(approved ? 'Start shopping' : 'Visit Brynoxa', siteUrl(approved ? '/shop' : '/')),
      ].join(''),
    });
    waitUntil(
      sendEmail({
        to: user.email,
        subject: approved ? 'Your Brynoxa wholesale account is approved' : 'Your Brynoxa wholesale application',
        html,
        text: toPlainText(html),
        idempotencyKey: `wholesale-${input.action}/${String(user._id)}/${now.getTime()}`,
      })
        .catch((e) => console.error('Wholesale decision email failed', e))
        .then(() => undefined)
    );
  }
  return user;
}
