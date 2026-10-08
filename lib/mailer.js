import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

// Envoi d'e-mails (rapport quotidien, alertes techniques). Optionnel :
// sans SMTP_HOST, rien n'est envoyé et l'appelant reçoit { sent: false }.
// MAIL_TRANSPORT=json (hors production) : les e-mails sont écrits dans
// storage/mail-outbox.jsonl au lieu d'être envoyés (scripts de recette).

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (process.env.NODE_ENV !== "production" && process.env.MAIL_TRANSPORT === "json") {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    transporter.__json = true;
    return transporter;
  }
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export function isMailConfigured() {
  return Boolean(getTransporter());
}

export async function sendMail({ to, subject, text, html }) {
  const recipients = (Array.isArray(to) ? to : String(to || "").split(/[,;\s]+/)).map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) return { sent: false, reason: "aucun destinataire" };
  const t = getTransporter();
  if (!t) return { sent: false, reason: "SMTP non configuré" };
  const info = await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@localhost", to: recipients.join(", "), subject, text, html });
  if (t.__json) {
    const file = path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "mail-outbox.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${info.message}\n`);
  }
  return { sent: true, messageId: info.messageId };
}
