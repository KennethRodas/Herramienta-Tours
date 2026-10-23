import nodemailer from "nodemailer";
import { Resend } from "resend";

// Branded email delivery. Server only.
// - Gmail (GMAIL_USER + GMAIL_APP_PASSWORD): sends from that account to anyone,
//   no domain needed (Google's limit is about 500 recipients a day).
// - Resend (RESEND_API_KEY + EMAIL_FROM on a verified domain): used when Gmail
//   is not configured. Without a verified domain Resend only delivers to the
//   account owner's own address.

const SENDER_NAME = "Wilber · Tours de aventura";

export const emailProvider = () =>
  process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? "gmail" : process.env.RESEND_API_KEY ? "resend" : null;

let gmail: nodemailer.Transporter | null = null;

export async function sendEmail(params: { to: string; subject: string; html: string; text: string }) {
  const provider = emailProvider();
  if (provider === "gmail") {
    gmail ??= nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") },
    });
    try {
      const info = await gmail.sendMail({
        from: { name: SENDER_NAME, address: process.env.GMAIL_USER! },
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      return { ok: true as const, id: info.messageId };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }
  if (provider === "resend") {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.EMAIL_FROM ?? "Wilber <onboarding@resend.dev>";
    const { data, error } = await resend.emails.send({ from, to: params.to, subject: params.subject, html: params.html, text: params.text });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: data?.id };
  }
  return { ok: false as const, error: "Correo sin configurar (GMAIL_USER y GMAIL_APP_PASSWORD, o RESEND_API_KEY)" };
}
