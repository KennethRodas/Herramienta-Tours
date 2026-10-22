import { Resend } from "resend";

// Branded email delivery through Resend. Server only.

export async function sendEmail(params: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false as const, error: "RESEND_API_KEY no está configurada" };
  const resend = new Resend(key);
  const from = process.env.EMAIL_FROM ?? "Wilber <onboarding@resend.dev>";
  const { data, error } = await resend.emails.send({ from, to: params.to, subject: params.subject, html: params.html, text: params.text });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, id: data?.id };
}
