// utils/mailUtils.js
import  { sendTestMail } from "../services/mailService.js";

export async function sendWelcomeMail(toEmail, username) {
  try {
    await transporter.sendMail({
      from: '"Crystos Jewel" <crystosjewel@outlook.fr>',
      to: toEmail,
      subject: "Bienvenue chez Crystos Jewel 💎",
      html: `
        <h1>Bonjour ${username},</h1>
        <p>Merci de votre inscription chez <strong>Crystos Jewel</strong> !</p>
        <p>Nous sommes ravis de vous compter parmi nous.</p>
      `,
    });
    console.log("✅ Mail envoyé à", toEmail);
  } catch (error) {
    console.error("❌ Erreur lors de l’envoi du mail :", error);
     throw error; // pour gérer l’erreur dans la route si besoin
  }
}
