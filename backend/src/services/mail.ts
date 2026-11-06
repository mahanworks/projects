import nodemailer from "nodemailer";
import { config } from "../config";

let transporterPromise: Promise<nodemailer.Transporter> | undefined;
async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (config.etherealUser && config.etherealPass) {
        return nodemailer.createTransport({
          host: "smtp.ethereal.email", port: 587, secure: false,
          auth: { user: config.etherealUser, pass: config.etherealPass }
        });
      }
      const account = await nodemailer.createTestAccount();
      console.log("Temporary Ethereal account:", account.user);
      console.log("Temporary Ethereal password:", account.pass);
      return nodemailer.createTransport({
        host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass }
      });
    })();
  }
  return transporterPromise;
}
export async function sendTestEmail(to: string, subject: string, body: string) {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: `"ReachInbox Demo" <${config.etherealUser || "demo@ethereal.email"}>`,
    to, subject, text: body
  });
  const preview = nodemailer.getTestMessageUrl(info);
  console.log("Ethereal preview:", preview);
  return { messageId: info.messageId, previewUrl: preview || null };
}
