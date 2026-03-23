import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    const apiKey = req.headers.get('x-api-key');

    if (!tenantId || !apiKey) {
      return NextResponse.json({ error: 'Missing x-tenant-id or x-api-key headers' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { serviceId, variantId, professionalId, date, time, clientName, clientPhone, clientEmail } = body;

    // Validación de parámetros críticos requeridos para agendar
    if (!serviceId || !professionalId || !date || !time || !clientName || !clientEmail) {
      return NextResponse.json({ error: 'Missing required fields: serviceId, professionalId, date, time, clientName, clientEmail' }, { status: 400 });
    }

    // 1. Obtener la duración base calculándola del Servicio Real
    const serviceDoc = await adminDb.collection('services').doc(serviceId).get();
    if (!serviceDoc.exists || serviceDoc.data()?.tenantID !== tenantId) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
    const serviceData = serviceDoc.data()!;
    let duration = serviceData.duration || 60;
    if (variantId && serviceData.variants) {
      const variant = serviceData.variants.find((v:any) => v.id === variantId);
      if (variant) duration = variant.duration || duration;
    }

    // 2. Calcular los "Timestamps" precisos de Inicio y Fin
    const startObj = new Date(`${date}T${time}:00`);
    if (isNaN(startObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date/time format' }, { status: 400 });
    }
    
    // Evitar reservas accidentales en el pasado
    if (startObj.getTime() < new Date().getTime()) {
      return NextResponse.json({ error: 'Cannot book an appointment in the past' }, { status: 400 });
    }

    const endObj = new Date(startObj.getTime() + duration * 60000);
    const startTimeStr = startObj.toISOString();
    const endTimeStr = endObj.toISOString();

    // 3. Revisión Crítica Anti-Choques (Previene Double Booking si 2 clientes piden a la vez)
    const startOfDay = new Date(`${date}T00:00:00`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59`).toISOString();

    const apptsSnapshot = await adminDb.collection('appointments')
      .where('tenantID', '==', tenantId)
      .where('professionalId', '==', professionalId)
      .where('status', 'in', ['scheduled', 'completed']) 
      .where('startTime', '>=', startOfDay)
      .where('startTime', '<=', endOfDay)
      .get();
      
    const existingAppts = apptsSnapshot.docs.map(doc => doc.data());
    
    // Re-checkear que no haya ninguna reserva robada en los últimos milisegundos
    const hasCollision = existingAppts.some(appt => {
       const apptStart = new Date(appt.startTime).getTime();
       const apptEnd = new Date(appt.endTime).getTime();
       const sStart = startObj.getTime();
       const sEnd = endObj.getTime();
       return (sStart < apptEnd && sEnd > apptStart);
    });

    if (hasCollision) {
       return NextResponse.json({ error: 'Conflict: The requested time slot is no longer available' }, { status: 409 });
    }

    // 4. Crear e Insentar el Turno en la Base de Datos
    const newAppointment = {
      tenantID: tenantId,
      serviceId,
      variantId: variantId || '',
      professionalId,
      clientName,
      clientPhone: clientPhone || '',
      clientEmail,
      startTime: startTimeStr,
      endTime: endTimeStr,
      duration,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    const docRef = await adminDb.collection('appointments').add(newAppointment);

    // 5. Enviar Email de Confirmación (Async, no bloquea la respuesta)
    const tenantData = (await adminDb.collection('tenants').doc(tenantId).get()).data();
    const businessName = tenantData?.companyName || 'Nuestra Empresa';
    
    sendEmail({
      to: clientEmail,
      subject: `Confirmación de Turno - ${businessName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #4f46e5;">¡Turno Agendado con Éxito!</h2>
          <p>Hola <strong>${clientName}</strong>,</p>
          <p>Tu turno para el servicio <strong>${serviceData.name}</strong> ha sido confirmado.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p><strong>Fecha:</strong> ${date}</p>
          <p><strong>Hora:</strong> ${time} hs</p>
          <p><strong>Lugar:</strong> ${tenantData?.address || 'Nuestra oficina'}</p>
          <br>
          <p style="font-size: 0.9rem; color: #666;">Te esperamos puntualmente. Si necesitas cancelar, por favor contáctanos.</p>
          <p style="font-size: 0.8rem; color: #999;">Enviado automáticamente por Stoa desde ${businessName}</p>
        </div>
      `,
      tenantId
    }).catch(err => console.error('Delayed email error:', err));

    // Retorna toda la data por confirmación para la IA
    return NextResponse.json({
      success: true,
      message: 'Appointment successfully scheduled',
      appointment: {
        id: docRef.id,
        ...newAppointment
      }
    });

  } catch (error: any) {
    console.error('API Appointment Creation Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
