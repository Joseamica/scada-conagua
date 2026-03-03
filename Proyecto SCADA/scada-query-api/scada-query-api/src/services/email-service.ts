import nodemailer from 'nodemailer';

// Using a standard SMTP relay while DNS access is granted for OCI
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your preferred provider
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASS // Must be an App Password, not your regular password
    }
});

const EMAIL_FROM = `"Sistema SCADA SOA - CONAGUA/OCAVM" <${process.env.EMAIL_USER || 'noreply@scada-soa.com'}>`;

export const sendPasswordResetEmail = async (to: string, resetUrl: string): Promise<void> => {
    const mailOptions = {
        from: EMAIL_FROM,
        to,
        subject: 'Recuperacion de contrasena — SCADA SOA',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #4d002b, #720a2d); padding: 28px 24px; text-align: center;">
                    <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Recuperacion de contrasena</h2>
                </div>
                <div style="padding: 28px 24px;">
                    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                        Recibimos una solicitud para restablecer la contrasena de tu cuenta en el Sistema SCADA SOA.
                    </p>
                    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                        Haz clic en el siguiente boton para crear una nueva contrasena:
                    </p>
                    <div style="text-align: center; margin: 0 0 24px;">
                        <a href="${resetUrl}" style="display: inline-block; background: #6d002b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600;">
                            Restablecer contrasena
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 8px;">
                        Este enlace expira en <strong>30 minutos</strong>. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.
                    </p>
                    <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 16px 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                        Si el boton no funciona, copia y pega este enlace en tu navegador:<br/>
                        <span style="color: #6d002b; word-break: break-all;">${resetUrl}</span>
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`>>> [PWD-RESET] Email sent to ${to.replace(/(.{2}).+(@.+)/, '$1***$2')}`);
    } catch (error) {
        console.error('>>> [EMAIL ERROR] Failed to send reset email to', to.replace(/(.{2}).+(@.+)/, '$1***$2'));
        if (process.env.NODE_ENV !== 'production') {
            console.warn('>>> [PWD-RESET DEV] URL:', resetUrl);
        }
    }
};

export const send2FACode = async (to: string, code: string): Promise<void> => {
    const mailOptions = {
        from: EMAIL_FROM,
        to: to,
        subject: `Código de Verificación: ${code}`,
        html: `
            <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px;">
                <h2 style="color: #003366;">Validación de Seguridad SCADA</h2>
                <p>Has solicitado acceso al sistema de telemetría SCADA.</p>
                <div style="background: #f4f4f4; padding: 15px; text-align: center;">
                    <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</span>
                </div>
                <p>Este código expira en 10 minutos.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`>>> [2FA] Code sent to ${to.replace(/(.{2}).+(@.+)/, '$1***$2')}`);
    } catch (error) {
        console.error('>>> [EMAIL ERROR] Failed to send 2FA email to', to.replace(/(.{2}).+(@.+)/, '$1***$2'));
        // Dev fallback: only log the code locally, never in production
        if (process.env.NODE_ENV !== 'production') {
            console.warn('>>> [2FA DEV] Code:', code);
        }
    }
};
