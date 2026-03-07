import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await resend.emails.send({
    from: 'Tuldio <noreply@tuldio.fr>',
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
