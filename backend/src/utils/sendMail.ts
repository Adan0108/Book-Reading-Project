require("dotenv").config();
import nodemailer, { Transporter } from "nodemailer";
import ejs from "ejs";
import path from "path";

interface EmailOptions {
  email: string;
  subject: string;
  template: string;
  data: { [key: string]: any };
}

const toBool = (v?: string) => String(v).toLowerCase() === 'true';

const host = (process.env.EMAIL_HOST || '').trim();
const port = Number((process.env.EMAIL_PORT || '465').trim());
const secure = toBool(process.env.EMAIL_SECURE) || port === 465;
const user = (process.env.EMAIL_USER || '').trim();
const pass = (process.env.EMAIL_PASSWORD || '').trim();
const from = (process.env.EMAIL_FROM || process.env.EMAIL_USER || '').trim();
const allowSelfSigned = toBool(process.env.EMAIL_ALLOW_SELF_SIGNED);

const transporter: Transporter = nodemailer.createTransport({
  host, 
  port, 
  secure, // true -> SMTPS(465), false -> STARTTLS(587)
  auth: { user, pass },
  tls: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: !allowSelfSigned, // <-- dev bypass
    servername: host, // SNI
  },
  // logger: true, //flooded the terminal, turn on for debug only
  // debug: true, //flooded the terminal, turn on for debug only
});

transporter.verify()
.then(() => console.log(`[Email] Transport ready host=${host} port=${port} secure=${secure} allowSelfSigned=${allowSelfSigned}`))
.catch(err => console.error('[Email] Transport verify failed:', err));

export default async function sendMail({ email, subject, template, data }: EmailOptions): Promise<void> {
  const templatePath = path.join(__dirname, '../mail-template', template);
  try {
    const html = await ejs.renderFile(templatePath, data);
    const info = await transporter.sendMail({
      from,
      to: email.trim(),
      subject,
      html,
      priority: 'high',
    });
    console.log(`[Email] Message sent: ${info.messageId}`);
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    throw new Error('Failed to send email.');
  }
}
