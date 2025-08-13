// scripts/test-email-config.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

async function testEmailConfiguration() {
    console.log('🧪 Test de la configuration email...');
    console.log('📧 MAIL_USER:', process.env.MAIL_USER ? '✅ Défini' : '❌ Non défini');
    console.log('🔐 MAIL_PASS:', process.env.MAIL_PASS ? '✅ Défini' : '❌ Non défini');

    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
        console.log('\n❌ Configuration incomplète !');
        console.log('Assurez-vous que votre fichier .env contient :');
        console.log('MAIL_USER=votre.email@gmail.com');
        console.log('MAIL_PASS=votre_mot_de_passe_application');
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100
    });

    try {
        console.log('\n🔍 Test de connexion SMTP...');
        await transporter.verify();
        console.log('✅ Connexion SMTP réussie !');

        console.log('\n📧 Envoi d\'un email de test...');
        const info = await transporter.sendMail({
            from: `"CrystosJewel Test" <${process.env.MAIL_USER}>`,
            to: process.env.MAIL_USER, // Envoi à soi-même
            subject: '🧪 Test Email Marketing CrystosJewel',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #d89ab3, #b794a8); color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">CrystosJewel</h1>
                        <p style="margin: 10px 0 0 0;">Test de configuration email</p>
                    </div>
                    <div style="padding: 20px; background: white;">
                        <h2 style="color: #d89ab3;">✅ Configuration réussie !</h2>
                        <p>Votre système d'email marketing est prêt à fonctionner.</p>
                        <ul>
                            <li>Connexion SMTP : ✅</li>
                            <li>Authentification : ✅</li>
                            <li>Envoi d'emails : ✅</li>
                        </ul>
                        <p><strong>Date du test :</strong> ${new Date().toLocaleString('fr-FR')}</p>
                    </div>
                    <div style="background: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
                        © 2025 CrystosJewel - Email de test automatique
                    </div>
                </div>
            `
        });

        console.log('✅ Email de test envoyé avec succès !');
        console.log('📨 Message ID:', info.messageId);
        console.log('📧 Destinataire:', process.env.MAIL_USER);
        console.log('\n🎉 Configuration email entièrement fonctionnelle !');

    } catch (error) {
        console.error('\n❌ Erreur lors du test :', error);
        
        if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
            console.log('\n💡 Solutions possibles :');
            console.log('1. Vérifiez votre connexion internet');
            console.log('2. Vérifiez que Gmail autorise les connexions moins sécurisées');
            console.log('3. Utilisez un mot de passe d\'application Gmail');
            console.log('4. Vérifiez vos identifiants MAIL_USER et MAIL_PASS');
        } else if (error.code === 'EAUTH') {
            console.log('\n💡 Erreur d\'authentification :');
            console.log('1. Vérifiez votre email dans MAIL_USER');
            console.log('2. Utilisez un mot de passe d\'application (pas votre mot de passe Gmail)');
            console.log('3. Activez l\'authentification à 2 facteurs sur Gmail');
            console.log('4. Générez un mot de passe d\'application sur https://myaccount.google.com/apppasswords');
        }
    } finally {
        transporter.close();
    }
}

// Exécuter le test
testEmailConfiguration();