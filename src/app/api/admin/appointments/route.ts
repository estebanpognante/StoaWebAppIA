import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    // 1. Verify Session
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const tenantId = decodedToken.tenantID;

    if (!tenantId) return NextResponse.json({ error: 'No tenant assigned' }, { status: 403 });

    const body = await req.json();
    const { 
      serviceId, 
      professionalId, 
      date, 
      time, 
      clientName, 
      clientEmail, 
      clientPhone, 
      duration,
      variantId 
    } = body;

    // 2. Validate
    if (!serviceId || !date || !time || !clientName || !clientEmail) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // 3. Setup Times
    const startObj = new Date(`${date}T${time}:00`);
    const endObj = new Date(startObj.getTime() + (duration || 60) * 60000);

    const newAppointment = {
      tenantID: tenantId,
      serviceId,
      variantId: variantId || '',
      professionalId,
      clientName,
      clientEmail,
      clientPhone: clientPhone || '',
      startTime: startObj.toISOString(),
      endTime: endObj.toISOString(),
      duration: duration || 60,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    const docRef = await adminDb.collection('appointments').add(newAppointment);

    // 4. Send Email
    const [tenantDoc, serviceDoc] = await Promise.all([
      adminDb.collection('tenants').doc(tenantId).get(),
      adminDb.collection('services').doc(serviceId).get()
    ]);

    const tenantData = tenantDoc.data();
    const serviceData = serviceDoc.data();
    const businessName = tenantData?.companyName || 'Nuestra Empresa';

    sendEmail({
      to: clientEmail,
      subject: `Confirmación de Turno - ${businessName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #4f46e5;">Reserva Confirmada</h2>
          <p>Hola <strong>${clientName}</strong>,</p>
          <p>Hemos agendado tu turno para <strong>${serviceData?.name || 'Servicio'}</strong>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p><strong>Fecha:</strong> ${date}</p>
          <p><strong>Hora:</strong> ${time} hs</p>
          <p><strong>Lugar:</strong> ${tenantData?.address || 'Nuestra oficina'}</p>
          <br>
          <p style="font-size: 0.9rem; color: #666;">¡Te esperamos!</p>
          <p style="font-size: 0.8rem; color: #999;">Enviado por ${businessName}</p>
        </div>
      `,
      tenantId
    }).catch(e => console.error('Admin booking email error:', e));

    return NextResponse.json({ success: true, id: docRef.id });

  } catch (error: any) {
    console.error('Admin API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
