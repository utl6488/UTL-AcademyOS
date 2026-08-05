import { logger } from '@/common/logger.js';
import { env } from '@/config/env.js';
import { enqueueEmail } from '@/jobs/email.queue.js';

interface Payload {
  to: string;
  name?: string;
  link: string;
}

export function sendVerificationEmail(p: Payload): Promise<void> {
  return enqueueEmail({
    to: p.to,
    subject: 'Verify your UTL-ExamPro email',
    text: `Hi ${p.name ?? 'there'},\n\nConfirm your email:\n${p.link}\n\nThis link expires in 24 hours.`,
    html: renderTemplate('Verify your email', p.name, 'Verify email', p.link),
  }).then(() => {
    logger.info({ to: p.to }, 'verification email queued');
  });
}

export function sendPasswordResetEmail(p: Payload): Promise<void> {
  return enqueueEmail({
    to: p.to,
    subject: 'Reset your UTL-ExamPro password',
    text: `Hi ${p.name ?? 'there'},\n\nReset your password:\n${p.link}\n\nThis link expires in 30 minutes.`,
    html: renderTemplate('Reset your password', p.name, 'Reset password', p.link),
  }).then(() => {
    logger.info({ to: p.to }, 'password reset email queued');
  });
}

export function sendInviteEmail(p: Payload & { role: string }): Promise<void> {
  return enqueueEmail({
    to: p.to,
    subject: `You're invited to UTL-ExamPro as ${p.role}`,
    text: `You've been invited as ${p.role}.\n\nAccept:\n${p.link}\n\nExpires in 7 days.`,
    html: renderTemplate(`Invitation — ${p.role}`, p.name, 'Accept invite', p.link),
  }).then(() => {
    logger.info({ to: p.to, role: p.role }, 'invite email queued');
  });
}

function renderTemplate(
  heading: string,
  name: string | undefined,
  cta: string,
  link: string,
): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
    <h2 style="margin:0 0 12px">${escape(heading)}</h2>
    <p>Hi ${escape(name ?? 'there')},</p>
    <p><a href="${escape(link)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">${escape(cta)}</a></p>
    <p style="color:#666;font-size:13px">Or copy this link: ${escape(link)}</p>
    <p style="color:#999;font-size:12px">Sent by ${escape(env.SMTP_FROM)}</p>
  </body></html>`;
}

function escape(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
