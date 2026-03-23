import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email';

export async function GET(req: Request) {
  try {
    // 1. Security check (Optional: use CRON_SECRET header if using Vercel Cron)
    // const authHeader = req.headers.get('Authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // 2. Get Today's Date Range (ISO string match or date overlap)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    console.log(`Running Reminder Cron for range: ${startOfToday} to ${endOfToday}`);

    // 3. Fetch all active appointments for today
    // Note: In a huge SaaS you'd paginate or use a specialized worker.
    const apptsSnapshot = await adminDb.collection('appointments')
      .where('status', '==', 'scheduled')
      .where('startTime', '>=', startOfToday)
      .where('startTime', '<=', endOfToday)
      .get();

    if (apptsSnapshot.empty) {
      return NextResponse.json({ message: 'No appointments for today' });
    }

    const results = [];

    // 4. Process each appointment (grouped by tenant for efficiency if possible)
    for (const doc of apptsSnapshot.docs) {
      const appt = doc.data();
      const tenantId = appt.tenantID;

      // Extract time from startTime (ISO string)
      const dateObj = new Date(appt.startTime);
      const timeStr = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

      // Fetch tenant data for business name & address
      const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
      const tenantData = tenantDoc.data();
      const businessName = tenantData?.companyName || 'Nuestra Empresa';

      // Send Email
      const emailResult = await sendEmail({
        to: appt.clientEmail,
        subject: `Recordatorio: Tienes un turno hoy en ${businessName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #4f46e5;">Recordatorio de Turno</h2>
            <p>Hola <strong>${appt.clientName}</strong>,</p>
            <p>Te recordamos que tienes una cita agendada para **hoy**.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p><strong>Hora:</strong> ${timeStr} hs</p>
            <p><strong>Lugar:</strong> ${tenantData?.address || 'Nuestra oficina'}</p>
            <br>
            <p style="font-size: 0.9rem; color: #666;">Te esperamos puntualmente. Si por algún motivo no puedes asistir, avísanos cuanto antes.</p>
            <p style="font-size: 0.8rem; color: #999;">Enviado por ${businessName} vía Stoa</p>
          </div>
        `,
        tenantId
      });

      results.push({ id: doc.id, client: appt.clientName, emailSent: emailResult.success });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      details: results
    });

  } catch (error: any) {
    console.error('Reminder Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
