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

const sendMail = async (options: EmailOptions): Promise<void> => {
  const transporter: Transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: Number(process.env.EMAIL_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const { email, subject, template, data } = options;

  //get the path to the email template file
  const templatePath = path.join(__dirname, "../mail-template", template);
  try {
    //Render the email template with EJS
    const html: string = await ejs.renderFile(templatePath, data);

    //send the email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Message sent: ${info.messageId}`);
    
  } catch (error) {
    console.error(`[Email] Error sending email:`, error);
    throw new Error("Failed to send email.");
  }
};
export default sendMail;
