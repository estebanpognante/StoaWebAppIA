import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    const apiKey = req.headers.get('x-api-key');

    if (!tenantId || !apiKey) {
      return NextResponse.json({ error: 'Missing x-tenant-id or x-api-key headers' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { serviceId, variantId, professionalId, date, time, clientName, clientPhone } = body;

    // Validación de parámetros críticos requeridos para agendar
    if (!serviceId || !professionalId || !date || !time || !clientName) {
      return NextResponse.json({ error: 'Missing required fields: serviceId, professionalId, date, time, clientName' }, { status: 400 });
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
      startTime: startTimeStr,
      endTime: endTimeStr,
      duration,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    const docRef = await adminDb.collection('appointments').add(newAppointment);

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
