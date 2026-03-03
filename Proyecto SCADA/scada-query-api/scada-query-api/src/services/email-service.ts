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

export const send2FACode = async (to: string, code: string, verifyUrl?: string): Promise<void> => {
    const verifySection = verifyUrl ? `
                    <div style="text-align: center; margin: 0 0 24px;">
                        <a href="${verifyUrl}" style="display: inline-block; background: #6d002b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600;">
                            Verificar cuenta
                        </a>
                    </div>
                    <div style="text-align: center; margin: 0 0 20px;">
                        <span style="color: #94a3b8; font-size: 13px;">o ingresa el codigo manualmente:</span>
                    </div>
    ` : '';

    const linkFallback = verifyUrl ? `
                    <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 16px 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                        Si el boton no funciona, copia y pega este enlace en tu navegador:<br/>
                        <span style="color: #6d002b; word-break: break-all;">${verifyUrl}</span>
                    </p>
    ` : '';

    const mailOptions = {
        from: EMAIL_FROM,
        to: to,
        subject: `Codigo de Verificacion: ${code} — SCADA SOA`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #4d002b, #720a2d); padding: 28px 24px; text-align: center;">
                    <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Verificacion de seguridad</h2>
                </div>
                <div style="padding: 28px 24px;">
                    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                        Has solicitado acceso al Sistema SCADA SOA. Verifica tu identidad para continuar.
                    </p>
                    ${verifySection}
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 20px;">
                        <p style="color: #64748b; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Codigo de verificacion</p>
                        <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827; font-family: 'SF Mono', 'Fira Code', monospace;">${code}</span>
                    </div>
                    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">
                        Este codigo expira en <strong>10 minutos</strong>. Si no solicitaste este acceso, puedes ignorar este correo.
                    </p>
                    ${linkFallback}
                </div>
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
            if (verifyUrl) console.warn('>>> [2FA DEV] Verify URL:', verifyUrl);
        }
    }
};
