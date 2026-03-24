import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { sendEmail } from '@/lib/email';

function timeToMinutes(timeStr: string) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

const getWeekdayKey = (date: Date) => {
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[date.getDay()];
};

export async function POST(req: Request) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    const apiKey = req.headers.get('x-api-key');

    if (!tenantId || !apiKey) {
      return NextResponse.json({ error: 'Missing x-tenant-id or x-api-key headers' }, { status: 401 });
    }

    // Validar API Key
    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) return NextResponse.json({ error: 'Tenant not found' }, { status: 401 });
    const tenantData = tenantDoc.data()!;
    if (tenantData.publicApiKeyPrefix !== apiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    const utcOffsetMinutes: number = tenantData.utcOffsetMinutes ?? 0;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { serviceId, variantId, professionalId, date, time, clientName, clientPhone, clientEmail } = body;

    // Campos obligatorios (professionalId es OPCIONAL)
    if (!serviceId || !date || !time || !clientName || !clientEmail) {
      return NextResponse.json({ error: 'Missing required fields: serviceId, date, time, clientName, clientEmail' }, { status: 400 });
    }

    // 1. Obtener el Servicio y su duración
    const serviceDoc = await adminDb.collection('services').doc(serviceId).get();
    if (!serviceDoc.exists || serviceDoc.data()?.tenantID !== tenantId) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
    const serviceData = serviceDoc.data()!;
    let duration = serviceData.duration || 60;
    if (variantId && serviceData.variants) {
      const variant = serviceData.variants.find((v: any) => v.id === variantId);
      if (variant) duration = variant.duration || duration;
    }

    // 2. Calcular timestamps de inicio y fin
    // Interpret date+time as local business time using tenant timezone offset
    const naiveUtc = new Date(`${date}T${time}:00Z`);
    const startObj = new Date(naiveUtc.getTime() - utcOffsetMinutes * 60000);
    if (isNaN(startObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date/time format' }, { status: 400 });
    }
    if (startObj.getTime() < new Date().getTime()) {
      return NextResponse.json({ error: 'Cannot book an appointment in the past' }, { status: 400 });
    }

    const endObj = new Date(startObj.getTime() + duration * 60000);
    const startTimeStr = startObj.toISOString();
    const endTimeStr = endObj.toISOString();
    const startOfDay = new Date(new Date(`${date}T00:00:00Z`).getTime() - utcOffsetMinutes * 60000).toISOString();
    const endOfDay = new Date(new Date(`${date}T23:59:59Z`).getTime() - utcOffsetMinutes * 60000).toISOString();
    const weekday = getWeekdayKey(startObj);
    const slotStartMin = timeToMinutes(time);
    const slotEndMin = slotStartMin + duration;

    // 3. Resolver el profesional: usar el indicado o asignar uno random disponible
    let resolvedProfessionalId: string = professionalId || '';
    let resolvedProfessionalName = '';

    if (!resolvedProfessionalId) {
      // Auto-asignación: buscar profesionales que hacen este servicio
      const serviceKey = variantId ? `${serviceId}|${variantId}` : serviceId;
      const profsSnapshot = await adminDb.collection('professionals')
        .where('tenantID', '==', tenantId)
        .where('isActive', '==', true)
        .get();

      const allProfs = profsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const assignedProfs = allProfs.filter(p => {
        if (!p.services) return false;
        return p.services.includes(serviceKey) || p.services.includes(serviceId);
      });

      if (assignedProfs.length === 0) {
        return NextResponse.json({ error: 'No professionals available for this service' }, { status: 409 });
      }

      // Obtener citas y bloqueos del día para filtrar disponibilidad
      const apptsSnap = await adminDb.collection('appointments')
        .where('tenantID', '==', tenantId)
        .where('status', 'in', ['scheduled', 'completed'])
        .where('startTime', '>=', startOfDay)
        .where('startTime', '<=', endOfDay)
        .get();
      const existingAppts = apptsSnap.docs.map(d => d.data());

      const blocksSnap = await adminDb.collection('blockedTimes')
        .where('tenantID', '==', tenantId)
        .where('date', '==', date)
        .get();
      const blocks = blocksSnap.docs.map(d => d.data());

      // Día bloqueado para todo el local
      if (blocks.some(b => b.professionalId === 'ALL')) {
        return NextResponse.json({ error: 'The business is fully blocked on this date' }, { status: 409 });
      }

      // Filtrar profesionales que estén disponibles en ese horario específico
      const availableProfs = assignedProfs.filter(prof => {
        // Verificar que trabaja ese día de la semana
        const workDay = prof.workingHours?.[weekday];
        if (!workDay?.isActive) return false;

        // Verificar que el slot cae dentro de su jornada
        const workStart = timeToMinutes(workDay.start);
        const workEnd = timeToMinutes(workDay.end);
        if (slotStartMin < workStart || slotEndMin > workEnd) return false;

        // Verificar que no está bloqueado individualmente ese día
        if (blocks.some(b => b.professionalId === prof.id)) return false;

        // Verificar que no tiene colisión con otra cita
        const hasCollision = existingAppts
          .filter(a => a.professionalId === prof.id)
          .some(appt => {
            const apptStart = new Date(appt.startTime).getTime();
            const apptEnd = new Date(appt.endTime).getTime();
            return startObj.getTime() < apptEnd && endObj.getTime() > apptStart;
          });

        return !hasCollision;
      });

      if (availableProfs.length === 0) {
        return NextResponse.json({ error: 'No professionals available at this date and time for this service' }, { status: 409 });
      }

      // Asignación RANDOM entre los disponibles
      const picked = availableProfs[Math.floor(Math.random() * availableProfs.length)];
      resolvedProfessionalId = picked.id;
      resolvedProfessionalName = picked.name;

    } else {
      // professionalId explícito: anti-colisión clásica
      const apptsSnap = await adminDb.collection('appointments')
        .where('tenantID', '==', tenantId)
        .where('professionalId', '==', resolvedProfessionalId)
        .where('status', 'in', ['scheduled', 'completed'])
        .where('startTime', '>=', startOfDay)
        .where('startTime', '<=', endOfDay)
        .get();
      const existingAppts = apptsSnap.docs.map(d => d.data());

      const hasCollision = existingAppts.some(appt => {
        const apptStart = new Date(appt.startTime).getTime();
        const apptEnd = new Date(appt.endTime).getTime();
        return startObj.getTime() < apptEnd && endObj.getTime() > apptStart;
      });

      if (hasCollision) {
        return NextResponse.json({ error: 'Conflict: The requested time slot is no longer available for this professional' }, { status: 409 });
      }

      // Obtener nombre del profesional
      const profDoc = await adminDb.collection('professionals').doc(resolvedProfessionalId).get();
      resolvedProfessionalName = profDoc.data()?.name || '';
    }

    // 4. Crear el turno en la base de datos
    const newAppointment = {
      tenantID: tenantId,
      serviceId,
      variantId: variantId || '',
      professionalId: resolvedProfessionalId,
      clientName,
      clientPhone: clientPhone || '',
      clientEmail,
      startTime: startTimeStr,
      endTime: endTimeStr,
      duration,
      status: 'scheduled',
      autoAssigned: !professionalId, // Indica si fue asignación automática
      createdAt: new Date().toISOString()
    };

    const docRef = await adminDb.collection('appointments').add(newAppointment);

    // 5. Enviar email de confirmación (async, no bloquea respuesta)
    const businessName = tenantData?.companyName || tenantData?.businessName || 'Nuestra Empresa';

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
          ${resolvedProfessionalName ? `<p><strong>Profesional:</strong> ${resolvedProfessionalName}</p>` : ''}
          <p><strong>Lugar:</strong> ${tenantData?.address || 'Nuestra oficina'}</p>
          <br>
          <p style="font-size: 0.9rem; color: #666;">Te esperamos puntualmente. Si necesitas cancelar, por favor contáctanos.</p>
          <p style="font-size: 0.8rem; color: #999;">Enviado automáticamente por Stoa desde ${businessName}</p>
        </div>
      `,
      tenantId
    }).catch(err => console.error('Delayed email error:', err));

    return NextResponse.json({
      success: true,
      message: 'Appointment successfully scheduled',
      appointment: {
        id: docRef.id,
        ...newAppointment,
        professionalName: resolvedProfessionalName
      }
    });

  } catch (error: any) {
    console.error('API Appointment Creation Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
