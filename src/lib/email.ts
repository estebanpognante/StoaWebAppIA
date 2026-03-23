import nodemailer from 'nodemailer';
import { adminDb } from './firebase/admin';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  tenantId: string;
}

export async function sendEmail({ to, subject, html, tenantId }: EmailOptions) {
  try {
    // 1. Fetch tenant SMTP settings
    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) throw new Error('Tenant not found');
    
    const data = tenantDoc.data();
    if (!data?.smtpHost || !data?.smtpUser || !data?.smtpPass) {
      console.warn(`SMTP not configured for tenant ${tenantId}. Skipping email.`);
      return { success: false, error: 'SMTP_NOT_CONFIGURED' };
    }

    // 2. Create transporter
    const transporter = nodemailer.createTransport({
      host: data.smtpHost,
      port: parseInt(data.smtpPort || '587'),
      secure: data.smtpPort === '465', // true for 465, false for other ports
      auth: {
        user: data.smtpUser,
        pass: data.smtpPass,
      },
    });

    // 3. Send mail
    const info = await transporter.sendMail({
      from: data.smtpFrom || data.smtpUser,
      to,
      subject,
      html,
    });

    console.log(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}
