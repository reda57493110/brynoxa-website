import { Resend } from 'resend';
import { env, isEmailConfigured } from '../config/env';

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(`Email skipped (Resend not configured): ${input.subject}`);
    return false;
  }

  try {
    const { error } = await new Resend(env.RESEND_API_KEY!).emails.send({
      from: env.EMAIL_FROM!,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (error) {
      console.error('Resend error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email send failed:', err);
    return false;
  }
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
